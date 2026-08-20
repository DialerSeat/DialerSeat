import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { apiError } from '@/lib/apiError'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

const PAGE_LIMIT = 100

interface RetryOutcome {
  scanned: number
  attempted: number
  paid: number
  failed: number
  skippedCancelling: number
}

async function retryStatus(
  status: 'past_due' | 'unpaid',
  out: RetryOutcome
): Promise<void> {
  for await (const sub of stripe.subscriptions.list({
    status,
    limit: PAGE_LIMIT,
    expand: ['data.latest_invoice'],
  })) {
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
    }

    await retryStatus('past_due', out)
    await retryStatus('unpaid', out)

    if (out.paid > 0) {
      console.log(`[billing-retry] recovered ${out.paid} of ${out.attempted} attempted`)
    }

    return NextResponse.json({ success: true, ...out })
  } catch (error: any) {
    console.error('billing-retry error:', error)
    return apiError(error, { route: 'cron/billing-retry' })
  }
}
