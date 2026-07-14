import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { activatePendingTeamMember } from '@/lib/teamMembership'
import { apiError } from '@/lib/apiError'

// Handles one specific edge case in the agent-pays seat flow: someone
// redeems an agent-pays code but turns out to already be an active,
// paying DialerSeat customer. The normal path (create a new subscription,
// let the webhook activate the pending membership once it's confirmed
// paid) doesn't apply here — they're not creating a new subscription, so
// no webhook event will ever carry the pending_team_member_id metadata.
// Since /api/stripe/status already confirmed they're an active payer
// before this gets called, it's safe to activate immediately.
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const teamMemberId = (body?.teamMemberId as string)?.trim()
    if (!teamMemberId) {
      return NextResponse.json({ success: false, error: 'teamMemberId required' }, { status: 400 })
    }

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id, status')
      .eq('id', teamMemberId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'No pending membership found' }, { status: 404 })
    }

    const result = await activatePendingTeamMember(teamMemberId)

    const { data: fullMember } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('id', teamMemberId)
      .maybeSingle()

    if (fullMember) {
      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      await supabaseAdmin
        .from('team_agent_payments')
        .update({
          status: 'active',
          stripe_subscription_id: existingSub?.stripe_subscription_id ?? null,
        })
        .eq('team_id', fullMember.team_id)
        .eq('agent_id', userId)
        .eq('status', 'pending')
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('activate-existing-subscriber error:', error)
    return apiError(error, { route: 'teams/activate-existing-subscriber' })
  }
}
