import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'
import { reconcileCoveredSeats } from '@/lib/coveredSeats'
import { syncIfTierChanged } from '@/lib/seatDiscount'

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
    const ownerId = (member as any).teams.owner_id

    const { data: activeCharges } = await supabaseAdmin
      .from('team_seat_charges')
      // ── THE COLUMN IS stripe_subscription_item_id ──────────────────────
      // Selecting a column that does not exist makes PostgREST reject the whole
      // query, so `charges` came back null, the cancel loop never ran, and the
      // Stripe subscription outlived the membership.
      //
      // Removing somebody therefore took away their access and kept billing the
      // owner $35 a week for them — silently, indefinitely, and in the owner's
      // disfavour. On a floor with normal churn that is an owner paying for
      // people who left months ago.
      .select('id, stripe_subscription_item_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')
      // ── ONLY WHAT THIS OWNER IS ACTUALLY PAYING FOR ────────────────────
      // Explicit rather than implied. A 'paid' charge against this membership
      // is by construction one this owner raised, but the cancel below ends a
      // live Stripe subscription and that is not a place to rely on "by
      // construction". Naming the owner means a charge belonging to anybody
      // else can never be reached from here, however the data shifts later.
      //
      // Nothing here can touch the agent's OWN DialerSeat subscription. That
      // lives in `subscriptions`, is billed to their card, and is not read by
      // this route at all — a self-funded agent's charge was voided when they
      // joined, so there is no 'paid' row to match and nothing is cancelled.
      .eq('owner_id', ownerId)

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

    // Same rule from the other side: if the seat just cancelled was the one
    // covering this person's other memberships with this owner, promote one
    // of them rather than leaving the owner with unbilled active seats.
    const { promotedMemberId } = await reconcileCoveredSeats(ownerId, member.user_id)

    // A seat ending can drop this owner below a volume tier they were being
    // discounted for. Only fires on an actual boundary.
    await syncIfTierChanged(ownerId, { removed: true })

    return NextResponse.json({
      success: true,
      stripeCancellations: stripeCancelResults,
      promotedMemberId,
    })
  } catch (error: any) {
    console.error('Remove member error:', error)
    return apiError(error, { route: 'teams/members/remove' })
  }
}