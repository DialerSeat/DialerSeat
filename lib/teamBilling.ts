import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import { ensureSeatCoupon, ownerSeatDiscount } from '@/lib/seatDiscount'



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
  /** True when the seat picked up a discount from the OWNER'S Stripe customer
   *  rather than one we chose. Signals a comp that was attached in the wrong
   *  place and is now quietly zeroing out seat revenue. */
  inheritedOwnerDiscount?: boolean
}


interface ResolvedOwner {
  customer: Stripe.Customer
  /** The card to bill this seat to. Passed explicitly on the subscription
   *  because the customer-level default is frequently absent — see below. */
  paymentMethodId: string
}

// ── FINDING THE CARD AN OWNER ACTUALLY PAYS WITH ─────────────────────────
// This checked customer.invoice_settings.default_payment_method and threw
// "no payment method on file" when it was empty. For most paying owners it IS
// empty, and they were being told to fix billing that was already working.
//
// Our own checkout creates subscriptions with
// payment_settings.save_default_payment_method: 'on_subscription', which saves
// the card to the SUBSCRIPTION, not to the customer. Stripe's documented
// resolution order for a subscription invoice is:
//
//   subscription.default_payment_method
//   -> subscription.default_source
//   -> customer.invoice_settings.default_payment_method
//   -> customer.default_source
//
// So an owner paying weekly has a perfectly good card sitting at level one,
// while this function was only ever looking at level three.
//
// A payment method used by a subscription is necessarily attached to the
// customer, so listing the customer's cards finds it. The customer default is
// still preferred when set — that is the card they deliberately nominated —
// and the card found here is passed explicitly on the seat subscription,
// because there is no customer-level default for it to fall back to.
async function resolveOwnerCustomer(ownerId: string): Promise<ResolvedOwner> {
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

  
  const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method
  let paymentMethodId =
    typeof defaultPm === 'string' ? defaultPm : defaultPm?.id ?? null

  if (!paymentMethodId) {
    const cards = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
      limit: 1,
    })
    paymentMethodId = cards.data[0]?.id ?? null
  }

  if (!paymentMethodId) {
    const err: SeatBillingError = {
      code: 'no_card',
      message: 'Owner has no payment method on file. Update billing before accepting team members.',
    }
    throw err
  }

  return { customer: customer as Stripe.Customer, paymentMethodId }
}


export async function createSeatSubscription(
  params: CreateSeatParams
): Promise<SeatBillingSuccess> {
  const { customer, paymentMethodId } = await resolveOwnerCustomer(params.ownerId)

  const description = `Seat: ${params.agentEmail} on ${params.teamName}`

  // ── THE VOLUME DISCOUNT, ON THE ACTUAL CHARGE ─────────────────────────
  // Computed from the same rule the Teams page prints, so what an owner is
  // quoted and what leaves their card come from one place. A new seat is
  // correct from its first invoice; the daily reconcile is what moves the
  // seats they already had when they cross a tier.
  //
  // Never fatal. A coupon lookup failing must not stop a seat being opened —
  // an agent locked out because a discount could not be applied is a far worse
  // outcome than a week at full price, and the reconcile fixes it tomorrow.
  let couponId: string | null = null
  try {
    const { percentOff } = await ownerSeatDiscount(params.ownerId)
    if (percentOff > 0) couponId = await ensureSeatCoupon(percentOff)
  } catch (err: any) {
    console.error('[teamBilling] discount lookup failed, opening seat at full price', err?.message || err)
  }

  // ── THE OWNER'S OWN FREE RIDE MUST NOT TRAVEL TO THE SEATS ────────────
  // Stripe: "When a subscription has no discounts, the customer-level
  // discount, if any, applies to invoices." Seats are created on the OWNER'S
  // customer, so an owner holding a customer-level coupon — a 100%-off comp,
  // say — has that coupon silently applied to every seat they buy. They get
  // their team for nothing and no error is raised anywhere, because a $0
  // invoice settles perfectly happily.
  //
  // It only bites when no volume coupon is set, since a subscription WITH its
  // own discounts does not inherit the customer's. So it hides below the first
  // volume tier and appears to work everywhere it is likely to be tested.
  //
  // A subscription-level "0% off" coupon would block the inheritance, but
  // Stripe requires percent_off to be greater than zero, so there is no
  // no-op coupon to apply. The comp therefore has to live on the owner's
  // PERSONAL SUBSCRIPTION, not on their customer — which is what this
  // codebase's own checkout already does. This detects the bad shape, records
  // it against the charge, and tells an admin, rather than quietly handing out
  // free seats.
  const inheritedDiscount =
    !couponId && (customer as any).discount ? (customer as any).discount : null

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: SEAT_PRICE_ID }],
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    // Named explicitly rather than left to the customer default, which is very
    // often unset — see resolveOwnerCustomer. Without this the first invoice
    // has no card to charge and the seat fails the moment it is created.
    default_payment_method: paymentMethodId,
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

  
  
  
  const periodStart =
    (subscription as any).current_period_start ??
    subscription.items.data[0]?.current_period_start ??
    Math.floor(Date.now() / 1000)
  const periodEnd =
    (subscription as any).current_period_end ??
    subscription.items.data[0]?.current_period_end ??
    Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60

  if (inheritedDiscount) {
    const pct = inheritedDiscount?.coupon?.percent_off ?? null
    console.error(
      '[teamBilling] seat inherited the owner customer-level discount',
      { ownerId: params.ownerId, subscription: subscription.id, percentOff: pct }
    )
    try {
      const { sendAdminPush } = await import('@/lib/pushNotify')
      await sendAdminPush(
        'payment_failed',
        `A seat for ${params.agentEmail} on ${params.teamName} inherited the owner's ` +
        `account-level discount${pct ? ` (${pct}% off)` : ''}, so this seat may bill at $0. ` +
        `The comp belongs on the owner's own subscription, not on their Stripe customer.`,
        { title: 'Seat billed at a discount it should not have' }
      )
    } catch (e) {
      console.error('[teamBilling] inherited-discount alert failed', e)
    }
  }

  return {
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: new Date(periodStart * 1000).toISOString(),
    currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    inheritedOwnerDiscount: !!inheritedDiscount,
  }
}


export async function cancelSeatSubscription(
  stripeSubscriptionId: string | null
): Promise<{ canceled: boolean; reason?: string }> {
  if (!stripeSubscriptionId) {
    return { canceled: false, reason: 'No Stripe subscription on this seat charge' }
  }

  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId, {
      
      prorate: false,
      invoice_now: false,
    } as any)
    return { canceled: true }
  } catch (err: any) {
    
    if (err?.code === 'resource_missing' || err?.message?.includes('already canceled')) {
      return { canceled: true, reason: 'Already canceled in Stripe' }
    }
    throw err
  }
}


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
 * Does this agent already pay for DialerSeat themselves?
 *
 * A seat exists to give platform access to somebody who is not paying for it.
 * Someone with their own active subscription already has that access, so there
 * is nothing for an owner to buy on their behalf — charging for it would bill
 * an owner for something the agent is already funding, and refusing to admit
 * them because the OWNER has no card on file is refusing over a bill that
 * should never have been raised.
 *
 * That was the live failure: approving an already-subscribed agent returned 402
 * "Owner has no payment method on file" and the join simply did not happen.
 */
export async function agentPaysForThemselves(agentClerkId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', agentClerkId)
    .eq('status', 'active')
    .limit(1)

  if (error) {
    // Fail toward charging. Wrongly skipping the charge would give a seat away
    // for free and nothing would ever notice; wrongly raising one is visible
    // and refundable.
    console.error('[teamBilling] self-sub lookup failed', error)
    return false
  }
  return !!data && data.length > 0
}

export function isSeatBillingError(err: any): err is SeatBillingError {
  return err && typeof err === 'object' && 'code' in err && 'message' in err
}