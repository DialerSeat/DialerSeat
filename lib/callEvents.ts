import { getServiceClient } from '@/lib/supabase'

// Append-only call event logger. This is a forensic trail, NOT a control path —
// it must NEVER throw or block the caller. Every call into the dialer/webhook
// path can emit events freely; a logging failure is swallowed (and console'd)
// so it can never break a live call.

export type CallEventType =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'amd_result'
  | 'bridged'
  | 'completed'
  | 'failed'
  | 'abandoned'
  | 'disposition_set'
  | 'hangup_requested'
  | 'recording_ready'
  | 'reaped'

interface CallEventInput {
  event_type: CallEventType
  call_id?: string | null
  signalwire_call_id?: string | null
  user_id?: string | null
  campaign_id?: string | null
  lead_id?: string | null
  status?: string | null
  source?: 'webhook' | 'dialer' | 'system' | 'reaper'
  detail?: Record<string, unknown> | null
}

export async function logCallEvent(input: CallEventInput): Promise<void> {
  try {
    const db = getServiceClient('call-events')
    const { error } = await db.from('call_events').insert({
      event_type: input.event_type,
      call_id: input.call_id ?? null,
      signalwire_call_id: input.signalwire_call_id ?? null,
      user_id: input.user_id ?? null,
      campaign_id: input.campaign_id ?? null,
      lead_id: input.lead_id ?? null,
      status: input.status ?? null,
      source: input.source ?? 'system',
      detail: input.detail ?? null,
    })
    if (error) {
      console.error('[call-events] insert failed (non-fatal):', error.message)
    }
  } catch (err) {
    // Never let logging break the call path.
    console.error('[call-events] unexpected error (non-fatal):', err)
  }
}
