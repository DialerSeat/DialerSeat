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

export function telephonyEventKey(
  callSid: string,
  webhook: TelephonyWebhook,
  status: string | null
): string {
  return `${callSid}:${webhook}:${status ?? 'null'}`
}

export async function claimTelephonyEvent(args: ClaimArgs): Promise<ClaimResult> {
  const { callSid, webhook, status } = args
  const sequenceNo = args.sequenceNo ?? null
  const eventKey = telephonyEventKey(callSid, webhook, status)
  const supabase = db()

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

  const { data: existing } = await supabase
    .from('telephony_events')
    .select('processing_status, attempts')
    .eq('event_key', eventKey)
    .maybeSingle()

  if (!existing) {

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

export async function markTelephonyEventSkipped(eventKey: string): Promise<void> {
  const supabase = db()
  await supabase
    .from('telephony_events')
    .update({ processing_status: 'skipped', processed_at: new Date().toISOString() })
    .eq('event_key', eventKey)
}
