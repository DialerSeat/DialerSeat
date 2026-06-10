import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'

/**
 * Owner accepts a pending team member.
 *
 * Flow branches on whether a pending team_seat_charge exists:
 *
 *   1. Owner_pays code → pending seat_charge row exists →
 *      verify owner has card, create Stripe seat sub, mark charge paid.
 *
 *   2. Agent_pays code → no pending seat_charge → skip Stripe entirely,
 *      just activate. Agent's own personal $35/wk DialerSeat sub gates
 *      access platform-side.
 *
 *   3. Free code → no pending seat_charge → skip Stripe entirely. Free
 *      mode means no per-seat fee; agent's personal sub still required.
 *
 * On Stripe failure during the owner_pays branch: no rollback of the
 * member row happens because we haven't activated it yet — pending
 * stays pending, no charge created. Owner gets a clear error.
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

    // Fetch member + team
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(id, owner_id, name)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const team = (member as any).teams
    if (team.owner_id !== userId) {
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

    // Idempotency guard: if there's already a paid charge for this member,
    // don't double-charge — just activate them.
    const { data: existingPaid } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')
      .maybeSingle()

    let stripeSubId: string | null = null

    if (existingPaid?.stripe_subscription_id) {
      // Idempotent: already charged, skip Stripe call
      stripeSubId = existingPaid.stripe_subscription_id
    } else {
      // Find pending charge to wire up — if none exists, this is the
      // agent_pays or free flow, where no team-level Stripe sub is required.
      const { data: pendingCharge } = await supabaseAdmin
        .from('team_seat_charges')
        .select('id')
        .eq('team_member_id', memberId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingCharge) {
        // ── owner_pays branch: create Stripe sub ──
        const { data: agentUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('clerk_id', member.user_id)
          .maybeSingle()

        const agentEmail = agentUser?.email || member.user_id

        try {
          const result = await createSeatSubscription({
            ownerId: userId,
            agentId: member.user_id,
            agentEmail,
            teamId: team.id,
            teamName: team.name,
            seatChargeId: pendingCharge.id,
            teamMemberId: memberId,
          })

          stripeSubId = result.stripeSubscriptionId

          await supabaseAdmin
            .from('team_seat_charges')
            .update({
              stripe_subscription_id: result.stripeSubscriptionId,
              status: 'paid',
              period_start: result.currentPeriodStart,
              period_end: result.currentPeriodEnd,
            })
            .eq('id', pendingCharge.id)
        } catch (err: any) {
          if (isSeatBillingError(err)) {
            if (err.code === 'no_card' || err.code === 'no_customer') {
              return NextResponse.json(
                { success: false, error: err.message, code: err.code },
                { status: 402 }
              )
            }
          }
          console.error('Stripe seat sub creation failed:', err)
          return NextResponse.json(
            { success: false, error: err.message || 'Stripe charge failed' },
            { status: 502 }
          )
        }
      }
      // ── agent_pays / free branch: no pending charge → fall through
      //    with stripeSubId still null. Member just gets activated below.
    }

    // Flip member to active
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

    // Activate pre-staged access rows
    const { data: activated } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: true })
      .eq('team_member_id', memberId)
      .eq('is_active', false)
      .is('revoked_at', null)
      .select('id')

    return NextResponse.json({
      success: true,
      member: updated,
      stripeSubscriptionId: stripeSubId,
      activatedAccessGrants: activated?.length || 0,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}