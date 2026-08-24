import Stripe from 'stripe'

// =============================================================================
// A TRIAL WITHOUT A CARD IS NOT A SUBSCRIPTION
// =============================================================================
// /billing creates the Stripe subscription on MOUNT, before the card form is
// even filled in — that is what produces the client secret the PaymentElement
// needs. Under `payment_behavior: 'default_incomplete'` that used to be
// harmless: no payment meant status `incomplete`, and `incomplete` grants
// nothing.
//
// Adding trial_period_days changed the status that comes back. There is
// nothing to charge during a trial, so Stripe returns `trialing` immediately,
// and `trialing` IS in ENTITLED_STATUSES. Loading the billing page was enough
// to be entitled. Signing up and pressing Back twice landed in the dashboard
// with an active trial and no card — found in testing, ~9 seconds between
// account creation and a trialing subscription.
//
// Stripe is explicit that this status carries no card guarantee. From their
// trials documentation, on a subscription with nothing to charge: "the
// subscription status is `trialing` ... ideal for 'no-card-required' or
// standard free trial flows." So `trialing` means "not being billed right
// now", never "has paid" and never "will be able to pay".
//
// The fix is to keep the old shape: until the card is confirmed, this is an
// abandoned checkout, and an abandoned checkout is `incomplete`. That word is
// already understood by every entitlement check in the codebase, so nothing
// downstream needed teaching — which is the reason for mapping the status
// rather than adding a column and a new condition everywhere that reads one.
//
// NOTE ON THE OTHER FAILURE DIRECTION. Being too strict here locks out a
// paying customer, which is worse than the hole it closes. Two things prevent
// that: the customer-level lookup below (Stripe may attach the confirmed card
// to the customer rather than the subscription), and /api/stripe/sync, which
// the success page calls so access does not wait on webhook delivery.
// =============================================================================

/**
 * Does this subscription have a card behind it?
 *
 * Checks the subscription first, then the customer's invoice default. A
 * SetupIntent confirmed against a subscription's `pending_setup_intent` can
 * land the payment method in either place depending on how it was created, and
 * a false negative here is a lockout — so when the subscription looks empty it
 * is worth the extra retrieve to be sure.
 */
export async function subscriptionHasCard(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<boolean> {
  if (subscription.default_payment_method) return true

  const customer = subscription.customer

  // Already expanded — no need to spend a call.
  if (typeof customer !== 'string') {
    if (customer && !customer.deleted) {
      return !!(customer as Stripe.Customer).invoice_settings?.default_payment_method
    }
    return false
  }

  try {
    const full = await stripe.customers.retrieve(customer)
    if (full.deleted) return false
    if (full.invoice_settings?.default_payment_method) return true

    // Last resort: a card attached but never made the default still means
    // they completed checkout, and refusing them would be the lockout this
    // whole file is trying to avoid.
    const methods = await stripe.paymentMethods.list({ customer, limit: 1 })
    return methods.data.length > 0
  } catch (err: any) {
    // Fail toward NOT entitling. An API blip must not become free access —
    // /api/stripe/sync and the next webhook both get another chance.
    console.error('[trialCard] card lookup failed for', subscription.id, err?.message || err)
    return false
  }
}

/**
 * The status to persist for this subscription.
 *
 * Identical to Stripe's own status in every case except the one above: a
 * trial with no card is recorded as `incomplete`, because that is what it is.
 */
export async function persistableStatus(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<string> {
  if (subscription.status !== 'trialing') return subscription.status
  const hasCard = await subscriptionHasCard(stripe, subscription)
  if (hasCard) return 'trialing'

  console.warn(
    `[trialCard] ${subscription.id} is trialing with no card — recording incomplete`
  )
  return 'incomplete'
}
