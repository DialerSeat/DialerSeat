import { getServiceClient } from '@/lib/supabase'

// =============================================================================
// TELNYX WEBHOOK IDEMPOTENCY
// =============================================================================
// Telnyx retries webhook delivery. Several handlers in /api/calls/events have
// side effects that must not run twice — hanging up a leg on an AMD machine
// result, writing a duration, kicking off a recording sync, advancing a
// dialer session. Individual handlers already guard some of this ad hoc
// (answered_at is written once, duration won't be recomputed), but each guard
// is a separate thing that has to be remembered by whoever adds the next
// handler.
//
// This is the same insert-first pattern as lib/stripe-idempotency.ts: the
// primary key IS the lock, so two concurrent deliveries of the same event
// cannot both win — one insert succeeds, the other conflicts.
//
// TWO DIFFERENCES FROM THE STRIPE VERSION, both because of volume:
//
//   1. At target scale this table takes millions of rows a day, so it is
//      narrow and swept on a retention window (see sweepTelnyxEvents). It is
//      a lock, not an audit log — call_events is the record of what happened.
//
//   2. It FAILS OPEN. If the dedupe table can't be read or written, the event
//      is processed anyway. For Stripe, double-processing risks double-billing
//      and failing closed is right. Here, dropping a call.hangup because a
//      bookkeeping table was unavailable would leave an agent wedged on a call
//      that already ended — strictly worse than handling it twice, which the
//      per-handler guards already largely tolerate.
// =============================================================================

const supabase = getServiceClient('telnyxIdempotency')

/** Rows older than this are swept. Long enough to outlast any Telnyx retry. */
export const TELNYX_EVENT_RETENTION_HOURS = 24

export type ClaimReason =
  | 'new'
  | 'already_processed'
  | 'in_progress'
  | 'previously_failed_retry'
  | 'dedupe_unavailable'

export interface ClaimResult {
  shouldProcess: boolean
  reason: ClaimReason
}

/**
 * Try to take ownership of an event. `shouldProcess: false` means some other
 * delivery of this same event already has it, or already finished it.
 */
export async function claimTelnyxEvent(
  eventId: string | null | undefined,
  eventType: string
): Promise<ClaimResult> {
  // No id on the payload — nothing to dedupe against. Process it; that is the
  // behaviour that existed before this module.
  if (!eventId) return { shouldProcess: true, reason: 'dedupe_unavailable' }

  const { error: insertErr } = await supabase
    .from('telnyx_events')
    .insert({ event_id: eventId, event_type: eventType, processing_status: 'received', attempts: 1 })

  if (!insertErr) return { shouldProcess: true, reason: 'new' }

  const { data: existing, error: readErr } = await supabase
    .from('telnyx_events')
    .select('processing_status, attempts')
    .eq('event_id', eventId)
    .maybeSingle()

  if (readErr || !existing) {
    // The insert failed for something other than a duplicate, or we can't read
    // back. Fail open — see the header note on why this differs from Stripe.
    console.error('[telnyxIdempotency] claim inconclusive, processing anyway:', eventId, insertErr.message)
    return { shouldProcess: true, reason: 'dedupe_unavailable' }
  }

  if (existing.processing_status === 'processed') {
    return { shouldProcess: false, reason: 'already_processed' }
  }

  if (existing.processing_status === 'failed') {
    await supabase
      .from('telnyx_events')
      .update({ processing_status: 'received', attempts: existing.attempts + 1, error_message: null })
      .eq('event_id', eventId)
    return { shouldProcess: true, reason: 'previously_failed_retry' }
  }

  return { shouldProcess: false, reason: 'in_progress' }
}

export async function markTelnyxEventProcessed(eventId: string | null | undefined): Promise<void> {
  if (!eventId) return
  await supabase
    .from('telnyx_events')
    .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId)
}

export async function markTelnyxEventFailed(
  eventId: string | null | undefined,
  err: unknown
): Promise<void> {
  if (!eventId) return
  const message = err instanceof Error ? err.message : String(err)
  await supabase
    .from('telnyx_events')
    .update({ processing_status: 'failed', error_message: message.slice(0, 1000) })
    .eq('event_id', eventId)
}

/**
 * Delete rows past the retention window.
 *
 * Called from the stale-call-reaper cron rather than given its own schedule —
 * that one already runs every 10 minutes for exactly this class of janitorial
 * work, and one more cron entry is one more thing to forget.
 */
export async function sweepTelnyxEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - TELNYX_EVENT_RETENTION_HOURS * 60 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('telnyx_events')
    .delete()
    .lt('created_at', cutoff)
    .select('event_id')

  if (error) {
    console.error('[telnyxIdempotency] sweep failed:', error.message)
    return 0
  }
  return data?.length ?? 0
}
