import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner accepts a pending member.
 *
 * - Flips team_members.status from 'pending' to 'active'
 * - Activates any pre-staged team_campaign_access rows (is_active: false → true)
 * - Marks team_seat_charges row (if any) as 'pending' Stripe charge
 *
 * Stripe charging is deferred to Batch 4. For now this just sets the data
 * up so the charge route can pick it up.
 *
 * Body:
 *   memberId: uuid (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memberId } = body

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 })
    }

    // Verify ownership through the team
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(owner_id)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    if ((member as any).teams.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can accept members' },
        { status: 403 }
      )
    }

    if (member.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Member is ${member.status}, not pending` },
        { status: 400 }
      )
    }

    // Flip status to active
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('team_members')
      .update({
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // Activate any pre-staged campaign access rows for this member
    const { data: activated } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: true })
      .eq('team_member_id', memberId)
      .eq('is_active', false)
      .is('revoked_at', null)
      .select('id, campaign_id')

    // Stripe charge wiring lives in Batch 4 — for now the seat_charges row
    // stays with status='pending'. When Batch 4 ships, that row gets picked
    // up and turned into a real Stripe subscription.

    return NextResponse.json({
      success: true,
      member: updated,
      activatedAccessGrants: activated?.length || 0,
      stripeChargePending: true,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}