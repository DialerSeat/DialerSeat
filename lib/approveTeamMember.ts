import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'
import { activatePendingTeamMember } from '@/lib/teamMembership'
import { syncIfTierChanged } from '@/lib/seatDiscount'
import { findCoveringSeat, markSeatCovered } from '@/lib/coveredSeats'

// ─────────────────────────────────────────────────────────────────────────
// SETTLING A SEAT AND LETTING SOMEBODY IN
//
// This was the body of /api/teams/members/accept, and it moved here the
// moment a second way of admitting people appeared — an owner adding agents
// straight from All Users. Two copies of "raise the charge, retry a failed
// one, skip it if they already pay, refuse the seat if it does not settle"
// is exactly the shape of drift this codebase keeps paying for: the
// disposition strings, the sub-queue filters and the access modes each
// existed twice and each pair disagreed.
//
// So there is one path in and out of a seat, and both callers are thin.
//
// THE RULE IT ENFORCES. No seat without the money. A billing failure leaves
// the member PENDING rather than rejecting them — nothing is lost, the owner
// fixes their card and tries again, and the agent's awaiting-approval banner
// keeps saying exactly where things stand.
// ─────────────────────────────────────────────────────────────────────────

const WEEKLY_SEAT_CENTS = 3500

export interface ApproveOutcome {
  ok: boolean
  memberId: string
  stripeSubscriptionId: string | null
  /** Raw reason the charge failed, `${code}: ${message}`. Null when it did not. */
  billingIssue: string | null
  /** True when the failure was "nothing to charge" rather than "the charge
   *  did not go through" — the two want opposite responses from the owner. */
  noCardOnFile: boolean
  /** The bank wants 3D Secure. Retrying cannot help; somebody has to approve
   *  it once. actionUrl is Stripe's hosted page, which runs the challenge. */
  requiresAction: boolean
  actionUrl: string | null
  activatedAccessGrants: number
  defaultedToTenantId: string | null
}

/**
 * Bill the seat and activate the membership.
 *
 * The member must already exist and be pending; the caller owns proving that
 * the person asking is the team's owner. Everything about money lives here.
 */
export async function approvePendingMember(params: {
  ownerId: string
  memberId: string
  teamId: string
  teamName: string
  agentClerkId: string
  /** Settle the seat without activating — the membership is already active.
   *  Used when promoting a covered seat after the one paying for it ended. */
  skipActivation?: boolean
}): Promise<ApproveOutcome> {
  const { ownerId, memberId, teamId, teamName, agentClerkId, skipActivation } = params

  let billingIssue: string | null = null
  let stripeSubId: string | null = null
  let actionUrl: string | null = null

  const { data: existingPaid } = await supabaseAdmin
    .from('team_seat_charges')
    // The column is stripe_subscription_item_id and it holds a SUBSCRIPTION
    // id. Selecting a name that does not exist made this lookup always come
    // back empty, so approving somebody who already had a seat opened a
    // SECOND subscription and billed the owner twice for one person.
    .select('id, stripe_subscription_item_id')
    .eq('team_member_id', memberId)
    .eq('status', 'paid')
    .maybeSingle()

  if (existingPaid?.stripe_subscription_item_id) {
    stripeSubId = existingPaid.stripe_subscription_item_id
  } else {
    // ── A FAILED CHARGE IS A RETRY, NOT AN ABSENCE ──────────────────────
    // This looked for 'pending' only. The first attempt marks a charge
    // 'failed' when the card is declined, so on the SECOND attempt there was
    // no pending row, the whole billing block was skipped, billingIssue
    // stayed null, and the member was activated — with nobody charged and
    // nothing recording that. It looked like the retry had worked. It had
    // only stopped trying.
    //
    // 'failed' is included, and reset to 'pending' before the attempt so a
    // charge is never left claiming to have failed while it is in flight.
    const { data: retryCharge } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, status')
      .eq('team_member_id', memberId)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // No row at all — an approval-mode join always writes one at redeem, so
    // this is somebody who arrived another way, which is precisely what an
    // owner adding people directly is. Raise it now rather than letting them
    // through unbilled, which is the same hole in a different shape.
    let pendingCharge = retryCharge
    if (!pendingCharge) {
      const { data: created } = await supabaseAdmin
        .from('team_seat_charges')
        .insert({
          team_id: teamId,
          owner_id: ownerId,
          agent_id: agentClerkId,
          team_member_id: memberId,
          amount_cents: WEEKLY_SEAT_CENTS,
          status: 'pending',
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id, status')
        .single()
      pendingCharge = created ?? null
    } else if (pendingCharge.status === 'failed') {
      await supabaseAdmin
        .from('team_seat_charges')
        .update({ status: 'pending', last_attempt_at: new Date().toISOString() })
        .eq('id', pendingCharge.id)
    }

    // Already paying for DialerSeat? Then there is no seat to buy. Raising a
    // charge here would bill the owner for access the agent already funds,
    // and failing that charge would then block an approval that has nothing
    // to do with money.
    const selfFunded = await agentPaysForThemselves(agentClerkId)
    if (selfFunded && pendingCharge) {
      await supabaseAdmin
        .from('team_seat_charges')
        .update({
          status: 'voided',
          void_reason: 'The agent funds their own DialerSeat subscription',
        })
        .eq('id', pendingCharge.id)
      await supabaseAdmin
        .from('team_members')
        .update({ billing_override: 'free' })
        .eq('id', memberId)
    }

    // ── ONE SEAT PER PERSON PER OWNER ───────────────────────────────────
    // This owner may already be paying for this agent on another of their
    // teams. A seat is access to the platform, and a person can only be on
    // one call at a time, so a second team is not a second thing to buy.
    //
    // Only within one owner. A different owner paying for their own team is
    // a separate arrangement and is left alone — they are buying access to
    // THEIR campaigns, and making that depend on what some other owner
    // happens to have bought would be a stranger's billing deciding theirs.
    const covering = selfFunded
      ? null
      : await findCoveringSeat(ownerId, agentClerkId, memberId)

    if (covering) {
      await markSeatCovered(memberId, covering, pendingCharge?.id ?? null)
    }

    if (pendingCharge && !selfFunded && !covering) {
      const { data: agentUser } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('clerk_id', agentClerkId)
        .maybeSingle()

      const agentEmail = agentUser?.email || agentClerkId

      try {
        const result = await createSeatSubscription({
          ownerId,
          agentId: agentClerkId,
          agentEmail,
          teamId,
          teamName,
          seatChargeId: pendingCharge.id,
          teamMemberId: memberId,
        })

        stripeSubId = result.stripeSubscriptionId

        await supabaseAdmin
          .from('team_seat_charges')
          .update({
            stripe_subscription_item_id: result.stripeSubscriptionId,
            status: 'paid',
            period_start: result.currentPeriodStart,
            period_end: result.currentPeriodEnd,
            // What was actually invoiced, not the list price sitting in
            // amount_cents. Without this nothing can answer what a customer
            // pays for a seat.
            charged_cents: result.chargedCents ?? null,
            discount_percent: result.discountPercent ?? null,
          })
          .eq('id', pendingCharge.id)
      } catch (err: any) {
        const reason = isSeatBillingError(err)
          ? `${err.code}: ${err.message}`
          : (err?.message || 'unknown')
        if (isSeatBillingError(err) && err.code === 'requires_action') {
          actionUrl = err.actionUrl ?? null
        }
        console.error(`[approveTeamMember] seat charge failed for member ${memberId}: ${reason}`)
        await supabaseAdmin
          .from('team_seat_charges')
          .update({
            status: 'failed',
            failure_reason: reason,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', pendingCharge.id)
        billingIssue = reason
      }
    }
  }

  if (billingIssue) {
    return {
      ok: false,
      memberId,
      stripeSubscriptionId: null,
      billingIssue,
      noCardOnFile: /^(no_card|no_customer):/.test(billingIssue),
      requiresAction: /^requires_action:/.test(billingIssue),
      actionUrl,
      activatedAccessGrants: 0,
      defaultedToTenantId: null,
    }
  }

  if (skipActivation) {
    return {
      ok: true,
      memberId,
      stripeSubscriptionId: stripeSubId,
      billingIssue: null,
      noCardOnFile: false,
      requiresAction: false,
      actionUrl: null,
      activatedAccessGrants: 0,
      defaultedToTenantId: null,
    }
  }

  const { activatedAccessGrants, defaultedToTenantId } = await activatePendingTeamMember(memberId)

  // Opening a seat is how an owner crosses a volume tier, so it is also where
  // the seats they already had need re-pricing. Only fires on a real boundary.
  await syncIfTierChanged(ownerId)

  return {
    ok: true,
    memberId,
    stripeSubscriptionId: stripeSubId,
    billingIssue: null,
    noCardOnFile: false,
    requiresAction: false,
    actionUrl: null,
    activatedAccessGrants,
    defaultedToTenantId,
  }
}
