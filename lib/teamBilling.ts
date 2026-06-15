import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

/**
 * Shared Stripe billing helpers for team seats.
 *
 * Design decisions (locked in spec):
 *   1. ONE Stripe subscription per seat (per agent per team).
 *      - 1:1 mapping with team_seat_charges rows.
 *      - Per-seat cancellation, per-seat refund, isolated failures.
 *   2. Reuse owner's existing stripe_customer_id (same card on file).
 *   3. If owner has no card → fail loud, do not create the sub.
 *   4. Subscription description AND metadata are populated for clean audit:
 *      description: "Seat: agent@example.com on Premium Team"
 *      metadata: { agent_id, agent_email, team_id, team_name, seat_charge_id }
 *   5. No proration on cancellation (Q2=B): owner pays out the week.
 *
 * v2: adds ownerCanBeCharged() — a non-throwing card check used to gate
 *     single-use partner seat links at mint time (see /api/teams/codes/create).
 *     It reuses resolveOwnerCustomer so the mint-time gate and the redeem-time
 *     charge can never disagree about whether the owner is billable.
 */

const SEAT_PRICE_ID = process.env.STRIPE_PRICE_ID!

export interface CreateSeatParams {
  ownerId: string           // clerk_id of paying owner
  agentId: string           // clerk_id of agent occupying the seat
  agentEmail: string
  teamId: string
  teamName: string
  seatChargeId: string      // team_seat_charges.id
  teamMemberId: string
}

export interface SeatBillingError {
  code: 'no_customer' | 'no_card' | 'stripe_error' | 'unknown'
  message: string
}

export interface SeatBillingSuccess {
  stripeSubscriptionId: string
  currentPeriodStart: string
  currentPeriodEnd: string
}

/**
 * Resolves an owner's stripe_customer_id and verifies they have a default
 * payment method on file. Returns the customer or throws.
 */
async function resolveOwnerCustomer(ownerId: string): Promise<Stripe.Customer> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, email')
    .eq('clerk_id', ownerId)
    .maybeSingle()

  if (!user?.stripe_customer_id) {
    const err: SeatBillingError = {
      code: 'no_customer',
      message: 'Owner has no Stripe customer record. They must subscribe to their own plan first.',
    }
    throw err
  }

  const customer = await stripe.customers.retrieve(user.stripe_customer_id)

  if (customer.deleted) {
    const err: SeatBillingError = {
      code: 'no_customer',
      message: 'Owner Stripe customer was deleted.',
    }
    throw err
  }

  // Verify default payment method exists
  const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method
  if (!defaultPm) {
    const err: SeatBillingError = {
      code: 'no_card',
      message: 'Owner has no payment method on file. Update billing before accepting team members.',
    }
    throw err
  }

  return customer as Stripe.Customer
}

/**
 * Creates a Stripe subscription for a seat charge.
 * Tags the sub with rich metadata + a human-readable description so the
 * owner's Stripe Dashboard reads like a team roster.
 *
 * Throws SeatBillingError if owner has no card / customer.
 */
export async function createSeatSubscription(
  params: CreateSeatParams
): Promise<SeatBillingSuccess> {
  const customer = await resolveOwnerCustomer(params.ownerId)

  const description = `Seat: ${params.agentEmail} on ${params.teamName}`

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: SEAT_PRICE_ID }],
    description,
    metadata: {
      seat_charge_id: params.seatChargeId,
      agent_id: params.agentId,
      agent_email: params.agentEmail,
      team_id: params.teamId,
      team_name: params.teamName,
      team_member_id: params.teamMemberId,
      sub_kind: 'team_seat',  // disambiguates from personal subs in webhook router
    },
    payment_behavior: 'error_if_incomplete',
    proration_behavior: 'none',
  })

  // Stripe types: current_period_start/end live on the subscription items in
  // newer API versions (Dahlia included). Fall back to subscription-level if
  // present for compatibility.
  const periodStart =
    (subscription as any).current_period_start ??
    subscription.items.data[0]?.current_period_start ??
    Math.floor(Date.now() / 1000)
  const periodEnd =
    (subscription as any).current_period_end ??
    subscription.items.data[0]?.current_period_end ??
    Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60

  return {
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: new Date(periodStart * 1000).toISOString(),
    currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
  }
}

/**
 * Cancels a seat subscription immediately.
 * Per Q2=B: no proration / no refund. Owner pays out the current period.
 *
 * If the seat's stripe_subscription_id is null (e.g. legacy pending row from
 * Batch 3 that never got Stripe-wired), this is a no-op.
 */
export async function cancelSeatSubscription(
  stripeSubscriptionId: string | null
): Promise<{ canceled: boolean; reason?: string }> {
  if (!stripeSubscriptionId) {
    return { canceled: false, reason: 'No Stripe subscription on this seat charge' }
  }

  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId, {
      // No prorate — owner already paid this period
      prorate: false,
      invoice_now: false,
    } as any)
    return { canceled: true }
  } catch (err: any) {
    // If sub was already canceled or doesn't exist, treat as success
    if (err?.code === 'resource_missing' || err?.message?.includes('already canceled')) {
      return { canceled: true, reason: 'Already canceled in Stripe' }
    }
    throw err
  }
}

/**
 * Returns whether an owner can currently be charged for a seat — i.e. they
 * have a Stripe customer with a default payment method on file. Reuses the
 * exact check createSeatSubscription performs (resolveOwnerCustomer), so a
 * code minted while this returns true won't later fail on no_card at redeem.
 *
 * Never throws: converts the SeatBillingError into a typed result the caller
 * can branch on without try/catch. Used by /api/teams/codes/create to gate
 * single-use owner-pays partner links at mint time.
 */
export async function ownerCanBeCharged(
  ownerId: string
): Promise<{ ok: true } | { ok: false; code: SeatBillingError['code']; message: string }> {
  try {
    await resolveOwnerCustomer(ownerId)
    return { ok: true }
  } catch (err: any) {
    if (isSeatBillingError(err)) {
      return { ok: false, code: err.code, message: err.message }
    }
    return { ok: false, code: 'unknown', message: err?.message || 'Billing check failed' }
  }
}

/**
 * Type guard for SeatBillingError thrown from helpers above.
 */
export function isSeatBillingError(err: any): err is SeatBillingError {
  return err && typeof err === 'object' && 'code' in err && 'message' in err
}