// lib/telephony-idempotency.ts
// =============================================================================
// Idempotency + ordering layer for SignalWire/Twilio call webhooks.
// =============================================================================
// Mirrors lib/stripe-idempotency.ts. SignalWire guarantees AT-LEAST-ONCE webhook
// delivery and does NOT guarantee order, so the same status callback can arrive
// twice, and a stale callback (an early 'ringing' with no duration) can land
// AFTER a newer 'completed' that carried the real duration. The old handlers
// blindly UPDATEd the calls row on every delivery, which is how a duplicate or
// out-of-order event overwrote a real duration with 0 (the "call lasted 0s"
// bug).
//
// This layer gives every call webhook two guarantees:
//   1. DEDUP   — a given (CallSid, webhook, status) transition is processed once.
//                The event_key primary key makes the claim race-safe.
//   2. ORDER   — when SignalWire sends a SequenceNumber, a handler can reject an
//                event whose sequence is <= the highest already applied for that
//                call, so a stale callback can't clobber newer state.
//
// USAGE in a webhook route:
//   const claim = await claimTelephonyEvent({ callSid, webhook: 'status', status, sequenceNo })
//   if (!claim.shouldProcess) return NextResponse.json({ success: true })   // ack, skip
//   try {
//     ...do the work, guarding fields (see guardedCallUpdate)...
//     await markTelephonyEventProcessed(claim.eventKey)
//   } catch (err) {
//     await markTelephonyEventFailed(claim.eventKey, err)
//     throw
//   }
// =============================================================================

import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export type TelephonyWebhook = 'status' | 'amd' | 'recording'

interface ClaimArgs {
  callSid: string
  webhook: TelephonyWebhook
  status: string | null
  sequenceNo?: number | null
}

interface ClaimResult {
  shouldProcess: boolean
  eventKey: string
  reason:
    | 'new'
    | 'already_processed'
    | 'in_progress'
    | 'previously_failed_retry'
    | 'stale_out_of_order'
}

/**
 * Build the idempotency key for a call webhook event. A given transition
 * (this CallSid reaching this status, on this webhook) is processed once.
 */
export function telephonyEventKey(
  callSid: string,
  webhook: TelephonyWebhook,
  status: string | null
): string {
  return `${callSid}:${webhook}:${status ?? 'null'}`
}

/**
 * Attempt to claim a telephony event for processing.
 *
 * Returns shouldProcess=true only for a brand-new event or a retry of a
 * previously-failed one. Returns false for duplicates already processed/in
 * flight, AND for events that are stale relative to ordering (a lower or equal
 * SequenceNumber than one we've already applied for this call).
 *
 * Race-safe: the insert relies on the event_key primary key, so two concurrent
 * deliveries of the same event can't both claim it.
 */
export async function claimTelephonyEvent(args: ClaimArgs): Promise<ClaimResult> {
  const { callSid, webhook, status } = args
  const sequenceNo = args.sequenceNo ?? null
  const eventKey = telephonyEventKey(callSid, webhook, status)
  const supabase = db()

  // ── Ordering guard ──────────────────────────────────────────────────────
  // If this event carries a SequenceNumber, make sure it's newer than the
  // highest sequence we've already PROCESSED for this call+webhook. A stale
  // callback (lower/equal sequence) is acknowledged but not applied, so it can
  // never overwrite newer state. Events without a sequence skip this guard.
  if (sequenceNo !== null) {
    const { data: prior } = await supabase
      .from('telephony_events')
      .select('sequence_no')
      .eq('call_sid', callSid)
      .eq('webhook', webhook)
      .eq('processing_status', 'processed')
      .not('sequence_no', 'is', null)
      .order('sequence_no', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prior && typeof prior.sequence_no === 'number' && sequenceNo <= prior.sequence_no) {
      return { shouldProcess: false, eventKey, reason: 'stale_out_of_order' }
    }
  }

  // ── Claim via race-safe insert ──────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from('telephony_events')
    .insert({
      event_key: eventKey,
      call_sid: callSid,
      webhook,
      status,
      sequence_no: sequenceNo,
      processing_status: 'received',
      attempts: 1,
    })

  if (!insertErr) {
    return { shouldProcess: true, eventKey, reason: 'new' }
  }

  // Insert failed — most likely a duplicate (PK conflict). Inspect the row.
  const { data: existing } = await supabase
    .from('telephony_events')
    .select('processing_status, attempts')
    .eq('event_key', eventKey)
    .maybeSingle()

  if (!existing) {
    // Non-duplicate insert failure — surface to logs, don't process.
    console.error('[telephony-idempotency] insert failed but no existing row', {
      event_key: eventKey,
      error: insertErr.message,
    })
    return { shouldProcess: false, eventKey, reason: 'in_progress' }
  }

  if (existing.processing_status === 'processed') {
    return { shouldProcess: false, eventKey, reason: 'already_processed' }
  }

  if (existing.processing_status === 'failed') {
    // A previously-failed event was redelivered. Bump attempts and retry.
    await supabase
      .from('telephony_events')
      .update({
        processing_status: 'received',
        attempts: existing.attempts + 1,
        error_message: null,
      })
      .eq('event_key', eventKey)
    return { shouldProcess: true, eventKey, reason: 'previously_failed_retry' }
  }

  // 'received' or 'skipped' — another invocation owns it right now.
  return { shouldProcess: false, eventKey, reason: 'in_progress' }
}

export async function markTelephonyEventProcessed(eventKey: string): Promise<void> {
  const supabase = db()
  const { error } = await supabase
    .from('telephony_events')
    .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_key', eventKey)
  if (error) {
    console.error('[telephony-idempotency] failed to mark processed', {
      event_key: eventKey,
      error: error.message,
    })
  }
}

export async function markTelephonyEventFailed(eventKey: string, err: unknown): Promise<void> {
  const supabase = db()
  const message = err instanceof Error ? err.message : String(err)
  const { error } = await supabase
    .from('telephony_events')
    .update({ processing_status: 'failed', error_message: message.slice(0, 1000) })
    .eq('event_key', eventKey)
  if (error) {
    console.error('[telephony-idempotency] failed to mark failed', {
      event_key: eventKey,
      error: error.message,
    })
  }
}

/**
 * Mark an event as deliberately skipped (e.g. a status we don't act on).
 * Distinct from 'processed' so dashboards can tell real work from noise.
 */
export async function markTelephonyEventSkipped(eventKey: string): Promise<void> {
  const supabase = db()
  await supabase
    .from('telephony_events')
    .update({ processing_status: 'skipped', processed_at: new Date().toISOString() })
    .eq('event_key', eventKey)
}
