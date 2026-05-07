import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner removes an active member from a team.
 * Requires typed "remove" confirmation per destructive-action pattern.
 *
 * - Sets team_members.status to 'removed'
 * - Sets all team_campaign_access rows for this member to is_active: false
 *   (audit trail preserved with revoked_at timestamp)
 * - Stripe seat charge cleanup (cancel sub, decide on refund) deferred to Batch 4
 *
 * Per spec: removal is instant, owner eats the rest of the week's $35 (Q2=B).
 *
 * Body:
 *   memberId: uuid (required)
 *   confirm:  'remove' (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { memberId, confirm } = body

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 })
    }

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm removal' },
        { status: 400 }
      )
    }

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
        { success: false, error: 'Only the team owner can remove members' },
        { status: 403 }
      )
    }

    if (member.status === 'removed') {
      return NextResponse.json(
        { success: false, error: 'Member is already removed' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Set member to removed
    await supabaseAdmin
      .from('team_members')
      .update({ status: 'removed', removed_at: now })
      .eq('id', memberId)

    // Revoke all active campaign access for this member
    await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .eq('team_member_id', memberId)
      .eq('is_active', true)

    // Stripe sub cancellation handled in Batch 4

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove member error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}