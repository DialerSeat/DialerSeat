// lib/stripe-idempotency.ts
// Idempotency layer for Stripe webhook processing.
//
// Usage in webhook route:
//   const claim = await claimStripeEvent(event)
//   if (!claim.shouldProcess) return NextResponse.json({ received: true })
//   try {
//     await doTheActualWork(event)
//     await markStripeEventProcessed(event.id)
//   } catch (err) {
//     await markStripeEventFailed(event.id, err)
//     throw  // let Stripe retry
//   }

import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface ClaimResult {
  shouldProcess: boolean
  reason: 'new' | 'already_processed' | 'in_progress' | 'previously_failed_retry'
}

/**
 * Attempt to claim a Stripe event for processing.
 *
 * Returns shouldProcess=true ONLY if this is a brand-new event or a retry
 * of a previously-failed event. Returns false for already-processed events
 * (Stripe retried after we already succeeded — common).
 *
 * Race-safe: the insert relies on the event_id primary key, so two concurrent
 * webhook invocations can't both claim the same event.
 */
export async function claimStripeEvent(event: Stripe.Event): Promise<ClaimResult> {
  const supabase = db()

  // Try to insert a new row. If it conflicts (event already seen), we'll
  // check status to decide whether to reprocess.
  const { error: insertErr } = await supabase
    .from('stripe_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      processing_status: 'received',
      attempts: 1,
    })

  if (!insertErr) {
    return { shouldProcess: true, reason: 'new' }
  }

  // Insert failed — likely duplicate (PK conflict). Check existing row.
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('processing_status, attempts')
    .eq('event_id', event.id)
    .maybeSingle()

  if (!existing) {
    // Insert failed for a non-duplicate reason. Don't process; surface to logs.
    console.error('[stripe-idempotency] insert failed but no existing row', {
      event_id: event.id,
      error: insertErr.message,
    })
    return { shouldProcess: false, reason: 'in_progress' }
  }

  if (existing.processing_status === 'processed') {
    return { shouldProcess: false, reason: 'already_processed' }
  }

  if (existing.processing_status === 'failed') {
    // Stripe retried a previously-failed event. Bump attempts and try again.
    await supabase
      .from('stripe_events')
      .update({
        processing_status: 'received',
        attempts: existing.attempts + 1,
        error_message: null,
      })
      .eq('event_id', event.id)
    return { shouldProcess: true, reason: 'previously_failed_retry' }
  }

  // status === 'received' or 'skipped' — another invocation is processing it
  return { shouldProcess: false, reason: 'in_progress' }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const supabase = db()
  const { error } = await supabase
    .from('stripe_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)

  if (error) {
    console.error('[stripe-idempotency] failed to mark processed', {
      event_id: eventId,
      error: error.message,
    })
  }
}

export async function markStripeEventFailed(
  eventId: string,
  err: unknown
): Promise<void> {
  const supabase = db()
  const message = err instanceof Error ? err.message : String(err)
  const { error } = await supabase
    .from('stripe_events')
    .update({
      processing_status: 'failed',
      error_message: message.slice(0, 1000),
    })
    .eq('event_id', eventId)

  if (error) {
    console.error('[stripe-idempotency] failed to mark failed', {
      event_id: eventId,
      error: error.message,
    })
  }
}

/**
 * Mark an event as deliberately skipped (event type we don't handle).
 * Different from 'processed' so dashboards can distinguish noise from real work.
 */
export async function markStripeEventSkipped(eventId: string): Promise<void> {
  const supabase = db()
  await supabase
    .from('stripe_events')
    .update({
      processing_status: 'skipped',
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
}