import type Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { logBillingEvent } from '@/lib/billingEvents'
import { lookupUserIdentity } from '@/lib/userDisplayName'
import { pausedAccessRunning } from '@/lib/entitlement'

// =============================================================================
// PAUSE, RESUME, CANCEL, RENEW — WITH STRIPE AS THE THING CHECKED, NOT TRUSTED
// =============================================================================
// Hussein paused his Pro plan on 17 Sept. Our row says so (paused_at is only
// ever written after Stripe accepts the pause), and Stripe still charged him
// $35 on 23 and 30 Sept, both renewals paid in full. Whatever lifted the
// pause on Stripe's side, nothing here noticed: we wrote the marker once and
// never looked again.
//
// So every action below writes to Stripe and then READS the subscription
// back, and the reconciler (reconcilePausedSubscriptions) puts the pause back
// wherever our record and Stripe disagree. paused_at is the record of what
// the customer asked for; Stripe is made to match it.
// =============================================================================

const supabase = getServiceClient('subscriptionControl')

export type SubscriptionAction = 'pause' | 'resume' | 'cancel' | 'renew'

export interface SubscriptionActionResult {
  stripeSubscriptionId: string
  ok: boolean
  error?: string
  /** What Stripe holds after the change, read back rather than assumed. */
  stripe?: { status: string; paused: boolean; cancelAtPeriodEnd: boolean }
}

function planOf(plan: string | null | undefined): 'pro' | 'wl' | null {
  return plan === 'pro' || plan === 'wl' ? plan : null
}

// =============================================================================
// A PAUSE KEEPS THE PAID DAYS; A RESUME PAYS FOR THE NEXT ONES
// =============================================================================
// Stripe's pause_collection keeps the plan 'active' and keeps rolling its
// period forward each week, voiding every invoice. It never ends access on its
// own, and un-pausing does not bill until the old renewal day, so a resume in
// the middle of a voided week got the rest of that week free.
//
// Joshua's rule, 8 Oct: a paused plan keeps the days already paid for, then is
// read-only until Resume is pressed AND paid. Resume charges a full week on the
// spot and the new week starts at that moment.
// =============================================================================

/** Invoices for a cycle are created at the period's start; this absorbs clock skew. */
const PERIOD_START_SLACK_SEC = 300

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Metadata on the invoice a resume pays, naming the subscription it restarted. */
export const RESUME_INVOICE_KEY = 'dialerseat_resumed_subscription'

/** Which subscription an invoice belongs to. */
function invoiceSubscriptionOf(invoice: Stripe.Invoice): string | null {
  const s = invoice.parent?.subscription_details?.subscription
  if (!s) return null
  return typeof s === 'string' ? s : s.id
}

/** The current period, which this API version keeps on the item. */
function periodOf(sub: Stripe.Subscription): { startSec: number | null; endSec: number | null } {
  const item = sub.items?.data?.[0]
  return {
    startSec: item?.current_period_start ?? null,
    endSec: item?.current_period_end ?? null,
  }
}

/**
 * How long a pause made now leaves access open: to the end of the current
 * period if that period was paid for, otherwise not at all.
 *
 * "Paid for" is asked of Stripe, not inferred from the status. The period's
 * own invoice counts, and so does the invoice a resume paid, which Stripe does
 * not attach to the subscription (resumePausedSubscription).
 */
export async function paidThroughAtPause(sub: Stripe.Subscription): Promise<string> {
  const now = Date.now()
  const { startSec, endSec } = periodOf(sub)
  if (!startSec || !endSec || endSec * 1000 <= now) return new Date(now).toISOString()

  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const paid = await stripe.invoices.list({
    customer,
    status: 'paid',
    created: { gte: startSec - PERIOD_START_SLACK_SEC },
    limit: 20,
  })
  const covered = paid.data.some(
    inv => invoiceSubscriptionOf(inv) === sub.id || inv.metadata?.[RESUME_INVOICE_KEY] === sub.id
  )
  return new Date(covered ? endSec * 1000 : now).toISOString()
}

export interface ResumeResult {
  /** Stripe's status for the plan afterwards. */
  status: string
  /** Charged up front because the paid days had run out. 0 when they had not. */
  chargedCents: number
  /** The card was refused. Nothing changed: still paused, nothing owed. */
  declined?: string
  /**
   * Paid, but Stripe refused to restart the plan. The week is theirs anyway
   * (given as paid days on the pause), and somebody has to finish it by hand.
   */
  restartFailed?: string
}

function isCardError(err: unknown): boolean {
  const e = err as { type?: string; rawType?: string } | null
  return e?.type === 'StripeCardError' || e?.rawType === 'card_error'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function setMarker(id: string, pausedAt: string | null, accessUntil: string | null) {
  await supabase
    .from('subscriptions')
    .update({ paused_at: pausedAt, paused_access_until: accessUntil })
    .eq('stripe_subscription_id', id)
}

/**
 * Resume a paused plan.
 *
 * Paid days left: un-pause and charge nothing. The next renewal falls on the
 * day it always would have.
 *
 * Paid days over: charge one week now and restart the plan's week from now.
 * How depends on the subscription's billing mode, because Stripe treats an
 * anchor reset differently in each (docs: billing-cycle "Reset the billing
 * period", billing-mode/compare "Cancel out equivalent prorations"):
 *
 *   classic   billing_cycle_anchor=now with proration_behavior=none invoices
 *             one full period immediately, no credit. error_if_incomplete
 *             means a declined card leaves the update unapplied.
 *   flexible  the same update invoices NOTHING. So the week is charged on its
 *             own invoice first, and the anchor is moved only once that has
 *             been paid. Moving it first would be a free week.
 *
 * Our marker is cleared before Stripe is un-paused, because the reconciler
 * re-pauses any plan our row says is paused, and is put back if Stripe refuses.
 */
export async function resumePausedSubscription(row: {
  stripe_subscription_id: string
  paused_at: string | null
  paused_access_until?: string | null
}): Promise<ResumeResult> {
  const id = row.stripe_subscription_id
  const restore = () => setMarker(id, row.paused_at, row.paused_access_until ?? null)

  // No pause on our side means no record of what was paid, so nothing is
  // charged: this only clears a pause Stripe holds that we never asked for.
  if (!row.paused_at) {
    const s = await stripe.subscriptions.update(id, { pause_collection: null })
    return { status: s.status, chargedCents: 0 }
  }

  if (pausedAccessRunning(row)) {
    await setMarker(id, null, null)
    try {
      const s = await stripe.subscriptions.update(id, { pause_collection: null })
      return { status: s.status, chargedCents: 0 }
    } catch (err) {
      await restore()
      throw err
    }
  }

  const sub = await stripe.subscriptions.retrieve(id)
  const mode = sub.billing_mode?.type as string | undefined
  if (mode !== 'classic' && mode !== 'flexible') {
    // Guessing wrong is either a double charge or a free week. Neither.
    throw new Error(`Subscription ${id} has billing mode "${mode}"; nothing was charged.`)
  }

  // Anything still collectable on this plan would be charged on top of the
  // week being bought now. A pause made before a renewal finalised leaves one.
  for (const status of ['open', 'draft'] as const) {
    const owed = await stripe.invoices.list({ subscription: id, status, limit: 20 })
    for (const inv of owed.data) {
      if (status === 'open') await stripe.invoices.voidInvoice(inv.id)
      else await stripe.invoices.del(inv.id)
      console.log(`[subscriptionControl] resume of ${id}: cleared ${status} invoice ${inv.id}`)
    }
  }

  if (mode === 'classic') {
    await setMarker(id, null, null)
    try {
      const s = await stripe.subscriptions.update(id, {
        pause_collection: null,
        billing_cycle_anchor: 'now',
        proration_behavior: 'none',
        payment_behavior: 'error_if_incomplete',
        expand: ['latest_invoice'],
      })
      const inv = s.latest_invoice && typeof s.latest_invoice !== 'string' ? s.latest_invoice : null
      return { status: s.status, chargedCents: inv?.amount_paid ?? 0 }
    } catch (err) {
      await restore()
      if (isCardError(err)) return { status: sub.status, chargedCents: 0, declined: errorText(err) }
      throw err
    }
  }

  // ── flexible ────────────────────────────────────────────────────────────
  // What the next renewal would charge, discounts included, is what a week
  // costs this customer. A fully comped plan comes out at 0 and pays nothing.
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const preview = await stripe.invoices.createPreview({ customer, subscription: id })
  const amount = preview.total ?? 0
  const pm = typeof sub.default_payment_method === 'string'
    ? sub.default_payment_method
    : sub.default_payment_method?.id

  let chargedCents = 0
  if (amount > 0) {
    // Not attached to the subscription on purpose: an invoice that is would
    // run through the webhook as a plan event. The metadata is what ties it
    // back, for paidThroughAtPause and for anyone reading Stripe.
    const draft = await stripe.invoices.create({
      customer,
      collection_method: 'charge_automatically',
      auto_advance: false,
      pending_invoice_items_behavior: 'exclude',
      currency: preview.currency,
      ...(pm ? { default_payment_method: pm } : {}),
      description: 'DialerSeat weekly plan, resumed',
      metadata: { [RESUME_INVOICE_KEY]: id },
    })
    await stripe.invoiceItems.create({
      customer,
      invoice: draft.id,
      amount,
      currency: preview.currency,
      description: 'One week, starting when the plan was resumed',
    })
    await stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false })
    try {
      const paid = await stripe.invoices.pay(draft.id, { off_session: true })
      chargedCents = paid.amount_paid ?? amount
    } catch (err) {
      // Nobody can pay a void invoice, so this cannot be collected later on
      // top of a resume that does go through.
      try {
        await stripe.invoices.voidInvoice(draft.id)
      } catch (voidErr) {
        console.error(`[subscriptionControl] could not void unpaid resume invoice ${draft.id}`, voidErr)
      }
      if (isCardError(err)) return { status: sub.status, chargedCents: 0, declined: errorText(err) }
      throw err
    }
  }

  await setMarker(id, null, null)
  try {
    const s = await stripe.subscriptions.update(id, {
      pause_collection: null,
      billing_cycle_anchor: 'now',
      proration_behavior: 'none',
    })
    return { status: s.status, chargedCents }
  } catch (err) {
    // They have paid for a week, so they get it: still paused in Stripe, with
    // the week as paid days on the pause. Reported, so it is finished by hand.
    await setMarker(id, row.paused_at, new Date(Date.now() + WEEK_MS).toISOString())
    console.error(`[subscriptionControl] ${id} paid ${chargedCents} to resume but Stripe would not restart it`, err)
    return { status: sub.status, chargedCents, restartFailed: errorText(err) }
  }
}

/** Every subscription of this person that can still bill. */
async function liveSubscriptions(clerkId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status, plan, paused_at, paused_access_until, cancel_at_period_end')
    .eq('user_id', clerkId)
    .in('status', ['active', 'past_due', 'trialing', 'unpaid'])
    .order('created_at', { ascending: false })
  return data || []
}

async function readBack(subId: string) {
  const s = await stripe.subscriptions.retrieve(subId)
  return {
    status: s.status,
    paused: !!s.pause_collection,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
  }
}

/**
 * Apply one action to every live subscription this person has. All of them,
 * not the newest: a customer with two (Hussein had two from one sign-up) is
 * exactly the case where acting on one leaves the other billing.
 */
export async function applySubscriptionAction(
  clerkId: string,
  action: SubscriptionAction,
  source: 'admin' | 'customer'
): Promise<SubscriptionActionResult[]> {
  const subs = await liveSubscriptions(clerkId)
  const results: SubscriptionActionResult[] = []

  for (const sub of subs) {
    const id = sub.stripe_subscription_id as string
    let chargedCents: number | null = null
    try {
      if (action === 'pause') {
        // Always written to Stripe, even when our row already says paused:
        // that row being right and Stripe being wrong is the failure this
        // file exists for.
        // Read before pausing: the paid days are judged on the period as it
        // stands now. A plan already marked paused keeps the date it has.
        const accessUntil = sub.paused_at
          ? null
          : await paidThroughAtPause(await stripe.subscriptions.retrieve(id))
        await stripe.subscriptions.update(id, { pause_collection: { behavior: 'void' } })
        if (!sub.paused_at) {
          await setMarker(id, new Date().toISOString(), accessUntil)
        }
      } else if (action === 'resume') {
        // Same rule as the customer's button: paid days left resume for free,
        // paid days over charge a week first. Clears and restores our marker.
        const r = await resumePausedSubscription(sub)
        chargedCents = r.chargedCents
        if (r.declined) throw new Error(`Card declined, still paused: ${r.declined}`)
        if (r.restartFailed) {
          throw new Error(`Charged ${(r.chargedCents / 100).toFixed(2)} but Stripe would not restart the plan: ${r.restartFailed}`)
        }
      } else if (action === 'cancel') {
        await stripe.subscriptions.update(id, { cancel_at_period_end: true })
        await supabase.from('subscriptions')
          .update({ cancel_at_period_end: true })
          .eq('stripe_subscription_id', id)
      } else {
        // renew: undo a scheduled cancel, keep the same subscription.
        await stripe.subscriptions.update(id, { cancel_at_period_end: false })
        await supabase.from('subscriptions')
          .update({ cancel_at_period_end: false })
          .eq('stripe_subscription_id', id)
      }

      const after = await readBack(id)
      results.push({ stripeSubscriptionId: id, ok: true, stripe: after })

      // The webhook logs scheduled cancels itself; pause and resume are only
      // logged where they are made, so here.
      if (action === 'pause' || action === 'resume') {
        const { name, email } = await lookupUserIdentity(clerkId)
        await logBillingEvent({
          event_type: action, clerk_id: clerkId, user_name: name, user_email: email,
          plan: planOf(sub.plan), stripe_subscription_id: id,
          ...(chargedCents ? { amount_cents: chargedCents } : {}),
          detail: { source, ...(chargedCents ? { charged_at_resume: true } : {}) },
        })
      }
    } catch (err) {
      results.push({
        stripeSubscriptionId: id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

/**
 * Make Stripe match every pause we hold. Run hourly, and also called by the
 * webhook for the one subscription an event is about. Returns what it fixed.
 */
export async function reconcilePausedSubscriptions(
  onlySubscriptionId?: string
): Promise<Array<{ stripeSubscriptionId: string; clerkId: string; repaused: boolean; error?: string }>> {
  let q = supabase
    .from('subscriptions')
    .select('stripe_subscription_id, user_id')
    .not('paused_at', 'is', null)
    .in('status', ['active', 'past_due', 'trialing', 'unpaid'])
  if (onlySubscriptionId) q = q.eq('stripe_subscription_id', onlySubscriptionId)
  const { data } = await q

  const out: Array<{ stripeSubscriptionId: string; clerkId: string; repaused: boolean; error?: string }> = []
  for (const row of data || []) {
    const id = row.stripe_subscription_id as string
    try {
      const s = await stripe.subscriptions.retrieve(id)
      if (s.pause_collection) continue
      if (s.status === 'canceled' || s.status === 'incomplete_expired') continue
      await stripe.subscriptions.update(id, { pause_collection: { behavior: 'void' } })
      out.push({ stripeSubscriptionId: id, clerkId: row.user_id as string, repaused: true })
      console.warn(`[subscriptionControl] ${id} was paused here but billing in Stripe; pause re-applied`)
    } catch (err) {
      out.push({
        stripeSubscriptionId: id, clerkId: row.user_id as string, repaused: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}
