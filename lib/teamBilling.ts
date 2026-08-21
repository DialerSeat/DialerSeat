import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import { ensureSeatCoupon, resolveSeatDiscount } from '@/lib/seatDiscount'



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
  // resolveSeatDiscount, not ownerSeatDiscount: an owner may already hold an
  // account-level comp, and a subscription coupon would DISPLACE it rather
  // than stack. Applying the volume tier blindly makes a comped owner's seats
  // jump from free to $33.25 the moment they earn the 5% — punishing them for
  // crossing the threshold the tier exists to reward. This returns 0 when the
  // comp is already better, which leaves the inheritance alone.
  let couponId: string | null = null
  let discountReason = 'unknown'
  try {
    const decision = await resolveSeatDiscount(params.ownerId)
    discountReason = decision.reason
    if (decision.applyPercentOff > 0) {
      couponId = await ensureSeatCoupon(decision.applyPercentOff)
    }
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
  const inheritedDiscountPeek = (customer as any).discount || null

  // A comp reaching the seat is now a DECISION, not an accident: when
  // resolveSeatDiscount finds the account comp beats the volume tier it
  // deliberately applies nothing, so the inheritance stands and the owner
  // keeps the better rate. That case is silent — alerting on it would fire on
  // every seat a comped owner opens.
  //
  // What is still worth saying out loud is a discount arriving that we did NOT
  // choose and could not read: a fixed-amount comp, for instance, which cannot
  // be compared against a percentage and so never wins the comparison above.
  // That one changes what a seat earns without anybody deciding it should.
  const inheritedDiscount =
    !couponId && inheritedDiscountPeek && discountReason !== 'comp_is_better'
      ? inheritedDiscountPeek
      : null

  const subscription = await stripe.subscriptions.create({
    expand: ['latest_invoice'],
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

  // ── A DISCOUNTED SEAT IS STILL A BILLED SEAT ──────────────────────────
  // Seats are created on the owner's Stripe customer, and Stripe applies a
  // customer-level discount to any subscription that has no discount of its
  // own. So an owner holding a comp has it reach their seats too.
  //
  // That is expected Stripe behaviour rather than a defect here, and the
  // account owner has confirmed it is acceptable: a comp that covers the
  // owner covering their seats as well is a pricing decision, not a leak.
  //
  // An earlier revision REFUSED such a seat, on the reasoning that a seat
  // billed at zero is a billing failure. That went further than what was
  // asked for and would have blocked a comped owner from adding anyone at
  // all. The actual requirement is narrower and is enforced elsewhere: a
  // member does not go active until a charge has SUCCEEDED. A $0 invoice on a
  // deliberately discounted customer succeeds.
  //
  // Still surfaced, because "expected" and "intended on this account" are not
  // the same thing — the next owner to acquire a stray customer-level coupon
  // should not discover it from a revenue report.
  const inv: any = (subscription as any).latest_invoice
  const billedCents = inv && typeof inv.total === 'number' ? inv.total : null
  const subtotalCents = inv && typeof inv.subtotal === 'number' ? inv.subtotal : null

  if (inheritedDiscount) {
    const pct = inheritedDiscount?.coupon?.percent_off ?? null
    console.error(
      '[teamBilling] seat inherited the owner customer-level discount',
      { ownerId: params.ownerId, subscription: subscription.id, percentOff: pct }
    )
    try {
      const { sendAdminPush } = await import('@/lib/pushNotify')
      const billed = billedCents !== null ? `$${(billedCents / 100).toFixed(2)}` : 'an unknown amount'
      const full = subtotalCents !== null ? `$${(subtotalCents / 100).toFixed(2)}` : 'full price'
      await sendAdminPush(
        'payment_failed',
        `Seat for ${params.agentEmail} on ${params.teamName} billed ${billed} instead of ${full}` +
        `${pct ? ` (${pct}% off)` : ''} from a discount on the owner's Stripe customer that ` +
        `could not be compared against their volume tier — most likely a fixed-amount coupon. ` +
        `The seat opened normally; worth a look at which rate they should be on.`,
        { title: 'Seat took an account discount we did not choose' }
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