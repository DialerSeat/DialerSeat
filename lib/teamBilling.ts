import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import {
  ensureSeatCoupon,
  resolveSeatDiscount,
  seatIsFullyComped,
  type SeatDiscountDecision,
} from '@/lib/seatDiscount'



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
  code: 'no_customer' | 'no_card' | 'requires_action' | 'stripe_error' | 'unknown'
  message: string
  /** requires_action only: where the owner goes to authenticate the payment.
   *  Stripe's hosted invoice page handles the 3DS challenge itself, so this is
   *  the whole fix — no card form of ours is involved. */
  actionUrl?: string | null
}

export interface SeatBillingSuccess {
  stripeSubscriptionId: string
  currentPeriodStart: string
  currentPeriodEnd: string
  /** True when the seat picked up a discount from the OWNER'S Stripe customer
   *  rather than one we chose. Signals a comp that was attached in the wrong
   *  place and is now quietly zeroing out seat revenue. */
  inheritedOwnerDiscount?: boolean
  /** What Stripe actually invoiced, in cents. Null when the invoice could not
   *  be read. This is the number worth storing — the list price is already
   *  known and is not what anybody paid. */
  chargedCents?: number | null
  /** Percent off that produced it. */
  discountPercent?: number | null
}


interface ResolvedOwner {
  customer: Stripe.Customer
  /** The card to bill this seat to. Passed explicitly on the subscription
   *  because the customer-level default is frequently absent — see below.
   *
   *  Null when there is none. Whether that is fatal is NOT decided here: a
   *  fully comped owner invoices at $0 and needs no card at all, and this
   *  function cannot see the comp. The caller decides. */
  paymentMethodId: string | null
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
const NO_CARD: SeatBillingError = {
  code: 'no_card',
  message: 'Owner has no payment method on file. Update billing before accepting team members.',
}

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

  return { customer: customer as Stripe.Customer, paymentMethodId }
}


/**
 * subscriptions.create, with SCA told apart from a decline.
 *
 * Everything else is rethrown untouched — this exists to classify one error,
 * not to swallow the rest.
 */
async function createSubscriptionOrExplainAction(
  params: Stripe.SubscriptionCreateParams
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.create(params)
  } catch (err: any) {
    const needsAction =
      err?.code === 'subscription_payment_intent_requires_action' ||
      /requires_action|requires additional user action/i.test(err?.message || '')

    if (!needsAction) throw err

    // The invoice Stripe just created carries the hosted page that performs
    // the challenge. Best effort: if it cannot be read, the message alone is
    // still far more actionable than "payment failed".
    let actionUrl: string | null = null
    try {
      const subId = err?.raw?.subscription || err?.subscription
      if (typeof subId === 'string') {
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] })
        const inv: any = (sub as any).latest_invoice
        actionUrl = inv?.hosted_invoice_url ?? null
      }
    } catch {
      // Leave it null.
    }

    const seatErr: SeatBillingError = {
      code: 'requires_action',
      message:
        'The bank asked the cardholder to authenticate this payment (3D Secure). ' +
        'It cannot be completed automatically: it has to be approved once, by hand.',
      actionUrl,
    }
    throw seatErr
  }
}

export async function createSeatSubscription(
  params: CreateSeatParams
): Promise<SeatBillingSuccess> {
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
  //
  // Resolved BEFORE the owner's card, because it decides whether a card is
  // needed at all — see the block below.
  let couponId: string | null = null
  let discountReason = 'unknown'
  let decision: SeatDiscountDecision | null = null
  try {
    decision = await resolveSeatDiscount(params.ownerId)
    discountReason = decision.reason
    if (decision.applyPercentOff > 0) {
      couponId = await ensureSeatCoupon(decision.applyPercentOff)
    }
  } catch (err: any) {
    console.error('[teamBilling] discount lookup failed, opening seat at full price', err?.message || err)
  }

  const { customer, paymentMethodId } = await resolveOwnerCustomer(params.ownerId)

  // ── A FREE SEAT DOES NOT NEED A CARD ──────────────────────────────────
  // The card check used to run first and unconditionally, so an owner on a
  // 100% comp was told "there is no working payment method on your account,
  // so this seat could not be billed" — about a seat that would have invoiced
  // $0.00. The discount was never consulted, because it was read afterwards.
  //
  // Now it is read first. When the comp covers the seat entirely there is
  // nothing to charge, so the seat opens with no payment method named and
  // Stripe settles the $0 invoice immediately.
  //
  // A comp that is NOT 'forever' means a later week's invoice becomes real
  // while there is still no card on file. That is deliberately not blocked
  // here: the seat is free today, and a future charge failing is exactly what
  // the daily enforcement job already exists to chase — it retries, and
  // suspends the seat on its own if the grace period runs out. Refusing the
  // seat now would be refusing over a bill nobody is owed yet.
  const fullyComped = decision !== null && seatIsFullyComped(decision)
  if (!paymentMethodId && !fullyComped) throw NO_CARD
  if (!paymentMethodId && fullyComped) {
    console.log(
      `[teamBilling] opening a fully comped seat with no card on file`,
      { ownerId: params.ownerId, compDuration: decision?.compDuration }
    )
  }

  // ── THE OWNER'S RATE IS THE SEAT'S RATE ───────────────────────────────
  // Whatever discount an owner holds now reaches the seats they pay for —
  // the volume tier, a customer-level comp, or a comp on their own plan. That
  // is a deliberate pricing decision by the account owner: an owner at 100%
  // has a team at 100%, and an owner at 5% has a team at 5%.
  //
  // Stripe delivers only one of those by itself: "When a subscription has no
  // discounts, the customer-level discount, if any, applies to invoices."
  // A discount on the owner's own PLAN reaches nothing else, because a coupon
  // on one subscription has never applied to another — so resolveSeatDiscount
  // copies that one onto the seat instead, and the nightly reconcile removes
  // it again when the owner stops holding it.
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

  // ── A CARD NEEDING AUTHENTICATION IS NOT A DECLINED CARD ──────────────
  // Stripe raises subscription_payment_intent_requires_action when the bank
  // wants 3D Secure. Nothing about retrying changes that: the charge is
  // off-session, and the whole point of "requires action" is that somebody has
  // to be present. Left as a generic failure it becomes an invisible dead end
  // — the agent stays pending, the nightly retry fails identically forever,
  // and the owner is told their payment "did not go through" with no mention
  // that they could fix it in one click.
  //
  // Stripe's hosted invoice page runs the challenge itself, so the fix is a
  // URL. No card details touch this application.
  const subscription = await createSubscriptionOrExplainAction({
    expand: ['latest_invoice'],
    customer: customer.id,
    items: [{ price: SEAT_PRICE_ID }],
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    // Named explicitly rather than left to the customer default, which is very
    // often unset — see resolveOwnerCustomer. Without this the first invoice
    // has no card to charge and the seat fails the moment it is created.
    // Omitted entirely when there is no card, which only reaches here on a
    // fully comped owner: naming null would be rejected, and a $0 invoice has
    // nothing to charge anyway.
    ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
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
    // ── error_if_incomplete, AND WHAT THAT MEANS FOR SCA ────────────────
    // A seat must not open on a payment that has not actually cleared, so an
    // incomplete subscription is an error rather than a pending seat.
    //
    // The consequence is that a card requiring 3D Secure fails outright. That
    // is correct — but it is NOT a decline, and it must not be treated as one:
    // retrying the same off-session charge can never satisfy "requires
    // action", so a blind retry loop burns its whole window on something
    // structurally impossible while the agent sits pending. The catch below
    // separates the two.
    // ── A SEAT BILLS FROM DAY ONE ──────────────────────────────────────
    // Stated explicitly rather than left to the default, because the default
    // is not ours to rely on: a free period configured on the PRICE in the
    // Stripe dashboard would silently apply to every subscription created
    // against it, and seats use the same price as everything else.
    //
    // The product no longer offers a free period at all, so this is belt and
    // braces rather than policy. It stays because the failure it prevents is
    // silent, and because the dashboard is a place someone can change a price
    // without touching this repo.
    trial_period_days: 0,
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
        `could not be compared against their volume tier, most likely a fixed-amount coupon. ` +
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
    // Already read above to decide whether to alert on an unexpected
    // discount, and previously thrown away. It is the only record of what
    // this customer actually pays.
    chargedCents: billedCents,
    discountPercent: decision ? decision.effectivePercentOff : null,
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
    const { paymentMethodId } = await resolveOwnerCustomer(ownerId)
    if (paymentMethodId) return { ok: true }

    // No card. Same rule as createSeatSubscription: that only matters if the
    // seat would actually be billed. resolveOwnerCustomer no longer decides
    // this on its own, so without the check below a cardless owner would pass
    // a pre-flight that then fails at the real thing.
    const decision = await resolveSeatDiscount(ownerId)
    if (seatIsFullyComped(decision)) return { ok: true }

    return { ok: false, code: NO_CARD.code, message: NO_CARD.message }
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
    // ── 'active' ONLY ────────────────────────────────────────────────────
    // Self-funding means somebody is actually paying. 'active' is the only
    // status where that is true; past_due is a failed charge and the legacy
    // 'trialing' rows are all expired. Widening this would hand the owner a
    // free seat on the strength of an agent subscription nobody is paying.
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