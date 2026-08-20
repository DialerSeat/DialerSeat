import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { apiError } from '@/lib/apiError'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// This walks every past_due and unpaid subscription and spends a Stripe round
// trip on each. At the ten-second default it was being killed partway through,
// which is the failure that matters here — see the note on ordering below.
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────
// KEEP TRYING THE CARD — EVERY DAY, EVERY SUBSCRIPTION
//
// A declined card is almost never someone deciding to leave. It is an expiry,
// a fraud hold, a bank that did not like a 3am charge. The only thing that
// should end billing is the customer cancelling, deliberately, themselves.
//
// Stripe's own dunning does retry — but it stops. Smart Retries run at most 8
// attempts over at most 2 months, and the docs are explicit: "After the final
// payment attempt, we make no further payment attempts." So a subscription that
// survives the retry window sits there unpaid forever with nobody chasing it.
// This job is what carries on afterwards.
//
// ── A DASHBOARD SETTING THIS DEPENDS ON ─────────────────────────────────
// Stripe's end-of-retry behaviour is configured at
// Billing > Revenue recovery > Retries, NOT through the API, and it has three
// options: cancel the subscription, mark it unpaid, or leave it past_due.
// If it is set to CANCEL, Stripe deletes the subscription when its retry window
// closes and this job has nothing left to pay. It must be "leave past-due" (or
// "mark unpaid") for retry-until-they-cancel to actually hold.
//
// Applies sitewide: personal plans, Manager+, and team seats alike. They are all
// just subscriptions with an unpaid invoice, and there is no reason one kind of
// customer should be chased and another written off.
// ─────────────────────────────────────────────────────────────────────────

// Stripe's maximum page size, and the auto-paginating iterator below walks
// every page — so this bounds a round trip, not the number of subscriptions
// retried. Nothing to raise.
const PAGE_LIMIT = 100

// ── WHY A CLOCK, AND WHY IT IS REPORTED ────────────────────────────────────
// The iterator is unbounded, so on a large enough backlog this job runs until
// the platform kills it. That alone would only make it slow — what makes it
// unfair is that Stripe returns subscriptions newest-first and offers no sort
// order for them. Truncation therefore always falls on the OLDEST past-due
// accounts: precisely the ones that have been failing longest and are closest
// to having their seats suspended by the enforcement job.
//
// Stopping cleanly and saying how many were missed turns that from a silent
// bias into a number. If notReached is ever persistently above zero, the fix is
// a stored cursor so each run resumes where the last stopped, rather than a
// bigger timeout.
const TIME_BUDGET_MS = 45_000

interface RetryOutcome {
  scanned: number
  attempted: number
  paid: number
  failed: number
  skippedCancelling: number
  /** Statuses abandoned partway because the time budget ran out. */
  notReached: string[]
}

async function retryStatus(
  status: 'past_due' | 'unpaid',
  out: RetryOutcome,
  outOfTime: () => boolean
): Promise<void> {
  for await (const sub of stripe.subscriptions.list({
    status,
    limit: PAGE_LIMIT,
    expand: ['data.latest_invoice'],
  })) {
    if (outOfTime()) {
      out.notReached.push(status)
      console.warn(
        `[billing-retry] time budget spent partway through '${status}' after ` +
        `${out.scanned} subscription(s); the oldest were not reached`
      )
      return
    }
    out.scanned++

    // They asked to stop. Chasing somebody who has already cancelled is how you
    // earn a chargeback, and it contradicts the one rule this whole job exists
    // to protect: cancelling is what halts billing.
    if (sub.cancel_at_period_end) {
      out.skippedCancelling++
      continue
    }

    const invoice = sub.latest_invoice as Stripe.Invoice | string | null
    if (!invoice || typeof invoice === 'string') continue
    // 'open' already means finalized and not yet paid in this API version —
    // there is no separate paid flag to consult on the Invoice type.
    if (invoice.status !== 'open') continue

    out.attempted++
    try {
      await stripe.invoices.pay(invoice.id as string)
      out.paid++
      console.log(`[billing-retry] recovered invoice ${invoice.id} on sub ${sub.id}`)
    } catch (err: any) {
      // Expected most days — the card is still declining. Logged at info level
      // rather than error so a normal outcome does not read as a fault.
      out.failed++
      console.log(
        `[billing-retry] still failing for sub ${sub.id}: ${err?.code || err?.message || 'unknown'}`
      )
    }
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const out: RetryOutcome = {
      scanned: 0,
      attempted: 0,
      paid: 0,
      failed: 0,
      skippedCancelling: 0,
      notReached: [],
    }

    const startedAt = Date.now()
    const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS

    // past_due first: those subscriptions are still inside Stripe's own retry
    // window, so a recovery here prevents the seat suspension that would
    // otherwise follow. 'unpaid' has already exhausted it.
    await retryStatus('past_due', out, outOfTime)
    await retryStatus('unpaid', out, outOfTime)

    if (out.paid > 0) {
      console.log(`[billing-retry] recovered ${out.paid} of ${out.attempted} attempted`)
    }

    return NextResponse.json({ success: true, ...out })
  } catch (error: any) {
    console.error('billing-retry error:', error)
    return apiError(error, { route: 'cron/billing-retry' })
  }
}
