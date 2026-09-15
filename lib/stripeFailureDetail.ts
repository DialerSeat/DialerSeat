import type Stripe from 'stripe'

// =============================================================================
// WHAT STRIPE ACTUALLY SAYS WENT WRONG
// =============================================================================
// The browser gets a sanitised error: a code and a short message safe to show a
// cardholder. Stripe's SERVER side knows considerably more, and none of it was
// being kept.
//
// The two places the real story lives:
//
//   paymentIntent.last_payment_error   code, decline_code, type, message, and
//                                      the payment method that was tried --
//                                      brand, last4, funding, issuing country.
//
//   charge.outcome                     Stripe's own verdict, in plain English.
//     seller_message   written FOR THE MERCHANT, e.g. "The bank returned the
//                      decline code insufficient_funds." This is the single
//                      most useful field and it never reaches the browser.
//     network_status   declined_by_network vs not_sent_to_network -- the
//                      difference between the bank refusing and Stripe's own
//                      rules blocking it before it ever left.
//     reason           machine-readable cause.
//     risk_level       whether Stripe's fraud scoring was involved, which is
//                      the case where a real customer is blocked by us rather
//                      than by their bank.
//     type             'issuer_declined', 'blocked', 'invalid'.
//
// ── WHY network_status IS THE ONE THAT DECIDES WHAT TO FIX ──────────────────
// declined_by_network means the bank said no: nothing to fix on this side, and
// the customer needs a different card. not_sent_to_network means Stripe or a
// radar rule stopped it here -- a customer who would have paid, blocked by our
// own configuration. Those look identical to the cardholder and identical in
// the subscriptions table, and they have opposite remedies.

export interface StripeFailureDetail {
  /** Stripe's explanation written for the merchant, not the cardholder. */
  sellerMessage: string | null
  /** 'declined_by_network' | 'not_sent_to_network' | 'approved_by_network'. */
  networkStatus: string | null
  /** Machine-readable outcome reason. */
  outcomeReason: string | null
  /** 'issuer_declined' | 'blocked' | 'invalid' | 'authorized'. */
  outcomeType: string | null
  /** 'normal' | 'elevated' | 'highest' — set when fraud scoring was involved. */
  riskLevel: string | null
  /** Stripe error code, e.g. 'card_declined'. */
  code: string | null
  /** The issuer's specific reason, e.g. 'insufficient_funds'. */
  declineCode: string | null
  /** The cardholder-facing message. */
  message: string | null
  /** Card brand, e.g. 'visa'. */
  cardBrand: string | null
  cardLast4: string | null
  /** 'credit' | 'debit' | 'prepaid' — prepaid cards decline far more often. */
  cardFunding: string | null
  /** Issuing country. A mismatch with the billing country is a common block. */
  cardCountry: string | null
  /** Where the payment intent ended up. */
  paymentIntentStatus: string | null
}

const EMPTY: StripeFailureDetail = {
  sellerMessage: null, networkStatus: null, outcomeReason: null, outcomeType: null,
  riskLevel: null, code: null, declineCode: null, message: null,
  cardBrand: null, cardLast4: null, cardFunding: null, cardCountry: null,
  paymentIntentStatus: null,
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/**
 * Pull everything Stripe will say about a failed payment.
 *
 * `charge` is optional because a payment that never reached the network has no
 * charge at all — and that absence is itself informative, so a missing charge
 * must produce partial detail rather than nothing.
 */
export function extractStripeFailureDetail(
  intent: Stripe.PaymentIntent | null | undefined,
  charge?: Stripe.Charge | null,
): StripeFailureDetail {
  if (!intent) return { ...EMPTY }

  const err = intent.last_payment_error
  const pm = (err?.payment_method ?? null) as Stripe.PaymentMethod | null
  const card = pm?.card ?? null
  const outcome = charge?.outcome ?? null

  return {
    sellerMessage: str(outcome?.seller_message),
    networkStatus: str(outcome?.network_status),
    outcomeReason: str(outcome?.reason),
    outcomeType: str(outcome?.type),
    riskLevel: str(outcome?.risk_level),
    code: str(err?.code),
    declineCode: str(err?.decline_code),
    message: str(err?.message),
    cardBrand: str(card?.brand),
    cardLast4: str(card?.last4),
    cardFunding: str(card?.funding),
    cardCountry: str(card?.country),
    paymentIntentStatus: str(intent.status),
  }
}

/**
 * One sentence a human can act on, for a push notification or a log line.
 *
 * Leads with seller_message when Stripe provided one, because Stripe already
 * wrote the sentence and wrote it better than a template would. Falls back
 * through decline_code and code so something useful is always produced.
 */
export function summariseStripeFailure(d: StripeFailureDetail): string {
  const card = d.cardBrand && d.cardLast4
    ? `${d.cardBrand} ••${d.cardLast4}${d.cardFunding ? ` (${d.cardFunding})` : ''}`
    : 'card'

  const why =
    d.sellerMessage
    || (d.declineCode ? `declined: ${d.declineCode}` : null)
    || d.code
    || d.message
    || 'no reason given by Stripe'

  // Named explicitly because it inverts who has to act. Everything else is
  // the customer's bank; this one is us.
  const blockedByUs = d.networkStatus === 'not_sent_to_network'
    ? ' — BLOCKED BEFORE REACHING THE BANK (our rules, not theirs)'
    : ''

  const risk = d.riskLevel && d.riskLevel !== 'normal'
    ? ` [risk: ${d.riskLevel}]`
    : ''

  return `${card}: ${why}${blockedByUs}${risk}`
}
