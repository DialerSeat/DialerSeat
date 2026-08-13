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
  // Telnyx's call.machine.greeting.ended — the greeting finished. Nothing
  // acts on it today; it is recorded because it is the timing signal a
  // voicemail-drop feature would be built on.
  | 'amd_greeting_ended'
  | 'bridged'
  | 'completed'
  | 'failed'
  | 'abandoned'
  | 'disposition_set'
  | 'hangup_requested'
  // A hangup we issued did NOT take, after retries. Recorded because this
  // failure was invisible for its whole existence: 18 of 128 machine
  // detections kept running — 17.8s average, once 122s — and the only trace
  // was a console warning. As an event it becomes a rate you can query
  // instead of a symptom a user has to report.
  | 'hangup_failed'
  | 'recording_ready'
  // Agent used the mid-call recording toggle. Distinct from
  // 'recording_ready', which is Telnyx telling us a finished recording is
  // available — these two record the agent's INTENT, which is what matters
  // for consent questions after the fact.
  | 'recording_started'
  | 'recording_stopped'
  | 'reaped'

interface CallEventInput {
  event_type: CallEventType
  call_id?: string | null
  call_control_id?: string | null
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
      call_control_id: input.call_control_id ?? null,
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
