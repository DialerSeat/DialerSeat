import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// LEAVING A TEAM YOU DID NOT CREATE
//
// The sidebar offered one action for a selected team — Delete — and offered
// it whether or not the viewer owned the thing. An agent pressing it hit
// /api/teams/[id]/delete, which refuses anybody who is not the owner, so the
// only outcome available to an agent on somebody else's team was an error.
// The action they actually wanted has never existed.
//
// SAME SIDE EFFECTS AS BEING REMOVED, because it is the same event seen from
// the other side. Access is revoked, the membership is marked removed, and an
// owner-funded seat subscription is cancelled — an owner should not keep
// paying $35 a week for somebody who walked out, any more than for somebody
// they let go.
//
// AN OWNER CANNOT LEAVE THEIR OWN TEAM. There would be nobody left to pay for
// it or administer it, and "leave" would quietly mean "abandon a team that
// still bills you". Deleting it is the honest action, and they already have
// that one.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const teamId = typeof body?.teamId === 'string' ? body.teamId : ''
    const confirm = body?.confirm

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 })
    }

    // The server's own guard against an unconfirmed call. The dialog already
    // made the person type LEAVE; this is not a second question for them.
    if (confirm !== 'leave') {
      return NextResponse.json(
        { success: false, error: 'Type "leave" to confirm' },
        { status: 400 }
      )
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (team.owner_id === userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'You own this team, so there is nothing to leave. Delete it instead.',
        },
        { status: 400 }
      )
    }

    // Pending counts. Somebody waiting on approval who changes their mind is
    // leaving too, and refusing them would leave a request the owner has to
    // decline on their behalf.
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .maybeSingle()

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'You are not on this team.' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // Owner-funded seats end with the membership. Same read as the remove
    // route, and for the same reason it was fixed there: a subscription that
    // outlives the seat bills the owner for somebody who is gone.
    const { data: activeCharges } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_item_id')
      .eq('team_member_id', member.id)
      .eq('status', 'paid')

    const stripeCancelResults: Array<{ chargeId: string; canceled: boolean; reason?: string }> = []

    for (const charge of activeCharges || []) {
      try {
        const result = await cancelSeatSubscription(charge.stripe_subscription_item_id)
        stripeCancelResults.push({ chargeId: charge.id, ...result })

        await supabaseAdmin
          .from('team_seat_charges')
          .update({ status: 'voided' })
          .eq('id', charge.id)
      } catch (err: any) {
        console.error('[teams/leave] Stripe cancel failed for charge', charge.id, err)
        stripeCancelResults.push({ chargeId: charge.id, canceled: false, reason: err?.message })
      }
    }

    // A pending seat charge is voided rather than cancelled — there is no
    // subscription behind it yet, and leaving it 'pending' would leave the
    // enforcement job retrying a charge for a membership that has ended.
    await supabaseAdmin
      .from('team_seat_charges')
      .update({ status: 'voided' })
      .eq('team_member_id', member.id)
      .in('status', ['pending', 'failed'])

    await supabaseAdmin
      .from('team_members')
      .update({ status: 'removed', removed_at: now })
      .eq('id', member.id)

    await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .eq('team_member_id', member.id)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      teamId,
      teamName: team.name,
      wasPending: member.status === 'pending',
      stripeCancellations: stripeCancelResults,
    })
  } catch (error: any) {
    console.error('Leave team error:', error)
    return apiError(error, { route: 'teams/leave' })
  }
}
