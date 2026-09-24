import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

// =============================================================================
// A PLAN WHOSE RENEWAL FAILED
// =============================================================================
// When a renewal card declines, the plan sits at past_due (or unpaid) while
// Stripe retries, and the account is read-only. RESUBSCRIBE used to dead-end
// there: checkout saw a live subscription and refused, so the only way back
// was a retry that happened to clear.
//
// Checkout now ends that plan and starts a fresh one (see
// app/api/stripe/create-subscription). The webhook has to tell that apart
// from somebody cancelling, or it would treat a customer coming BACK as one
// leaving: a "cancelled" push, a cancel row in the ledger, their team seats
// handed to the owner, a Manager+ brand switched off. Stripe keeps the comment
// passed when a subscription is cancelled for the life of the object, so that
// comment is the mark.
//
// The plan must not unlock anything on its way out either. A cancelled plan
// normally keeps access to its period end because that week was paid for, and
// nobody is refunded. A failed renewal's week was never paid, so its access
// ends when the plan does. The same holds when Stripe cancels a plan itself
// after its last retry fails.
// =============================================================================

/** Written to cancellation_details.comment when checkout replaces a failed plan. */
export const REPLACED_FAILED_PLAN = 'dialerseat: replaced at checkout after a failed renewal'

export function isReplacedFailedPlan(sub: Stripe.Subscription): boolean {
  return sub.cancellation_details?.comment === REPLACED_FAILED_PLAN
}

/** Ended because a payment failed: Stripe gave up retrying, or checkout replaced it. */
export function endedOnFailedPayment(sub: Stripe.Subscription): boolean {
  return (
    sub.status === 'canceled' &&
    (sub.cancellation_details?.reason === 'payment_failed' || isReplacedFailedPlan(sub))
  )
}

/**
 * The moment access ends for a plan that ended on a failed payment, as an ISO
 * string to store as current_period_end. Null leaves the period end alone:
 * for every other plan, and for one whose latest invoice turns out to be paid
 * after all (a retry that cleared just before the cancel), whose week WAS
 * paid for.
 *
 * Throws if Stripe can't be asked. The webhook lets that fail the event so
 * Stripe delivers it again, rather than guessing in either direction.
 */
export async function unpaidAccessEnd(sub: Stripe.Subscription): Promise<string | null> {
  if (!endedOnFailedPayment(sub)) return null
  const latest = sub.latest_invoice
  const invoice = typeof latest === 'string' ? await stripe.invoices.retrieve(latest) : latest
  if (invoice?.status === 'paid') return null
  const endedSec = sub.ended_at ?? sub.canceled_at ?? Math.floor(Date.now() / 1000)
  return new Date(endedSec * 1000).toISOString()
}

// ── A FAILED PLAN IS ENDED, NOT LEFT OWING ──────────────────────────────────
// Order matters. Stripe works out a subscription's status from its latest
// invoice that is not void, so voiding a past_due plan's invoice first would
// flip the plan back to active for a moment, and the webhook would take that
// for a payment. Cancelling first means it stays cancelled whatever happens to
// its invoices afterwards.
//
// Cancelling alone is not enough. Stripe stops retrying, but the invoice stays
// open and can still be paid by hand, from the link in Stripe's own reminder
// email for one. Paid on top of the new plan, that is two charges for the same
// week. Nobody can pay a void invoice.
//
// `toClose` also holds plans ended earlier: by a previous checkout whose void
// did not complete, or by Stripe after its final retry. Anything they still
// have open is voided too, on every checkout, until nothing is.
//
// Returns the id of a plan whose renewal cleared in the instant before it was
// cancelled. That week WAS paid, and the plan now runs to the end of it (see
// unpaidAccessEnd), so a new plan on top would charge for the same days twice.
export async function closeFailedPlans(
  failedRenewals: Stripe.Subscription[],
  toClose: Stripe.Subscription[]
): Promise<{ paidMeanwhile: string } | null> {
  for (const sub of failedRenewals) {
    try {
      await stripe.subscriptions.cancel(sub.id, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: REPLACED_FAILED_PLAN },
      })
    } catch (err) {
      // A second tab can get here first. Already cancelled is the outcome
      // this wanted, so only anything else is a failure.
      const current = await stripe.subscriptions.retrieve(sub.id)
      if (current.status !== 'canceled') throw err
    }

    const latestId =
      typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id
    if (latestId) {
      const latest = await stripe.invoices.retrieve(latestId)
      if (latest.status === 'paid') return { paidMeanwhile: sub.id }
    }
  }

  for (const sub of toClose) {
    for (const status of ['open', 'uncollectible'] as const) {
      const owed = await stripe.invoices.list({ subscription: sub.id, status, limit: 100 })
      for (const invoice of owed.data) {
        await stripe.invoices.voidInvoice(invoice.id)
        console.log(`[failedPlan] voided ${invoice.id} (${status}) on failed plan ${sub.id}`)
      }
    }
  }

  return null
}
