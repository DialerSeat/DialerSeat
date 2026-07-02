import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

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

    const { data: activeCharges } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')

    const stripeCancelResults: Array<{ chargeId: string; canceled: boolean; reason?: string }> = []

    for (const charge of activeCharges || []) {
      try {
        const result = await cancelSeatSubscription(charge.stripe_subscription_id)
        stripeCancelResults.push({ chargeId: charge.id, ...result })

        await supabaseAdmin
          .from('team_seat_charges')
          .update({ status: 'voided' })
          .eq('id', charge.id)
      } catch (err: any) {
        console.error('Stripe cancel failed for charge', charge.id, err)
        stripeCancelResults.push({
          chargeId: charge.id,
          canceled: false,
          reason: err.message,
        })
      }
    }

    await supabaseAdmin
      .from('team_members')
      .update({ status: 'removed', removed_at: now })
      .eq('id', memberId)

    await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .eq('team_member_id', memberId)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      stripeCancellations: stripeCancelResults,
    })
  } catch (error: any) {
    console.error('Remove member error:', error)
    return apiError(error, { route: 'teams/members/remove' })
  }
}