import { after } from 'next/server'
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
  // A voicemail drop was played into a lead's answering machine at the beep.
  | 'voicemail_dropped'
  // Any Telnyx event the dispatcher has no case for. The raw event type goes
  // in `status`. Recorded rather than discarded because silently dropping
  // these is what made detect_beep impossible to diagnose — the events that
  // would have explained the failure were the ones being thrown away.
  | 'unhandled'
  | 'recording_ready'
  // Agent used the mid-call recording toggle. Distinct from
  // 'recording_ready', which is Telnyx telling us a finished recording is
  // available — these two record the agent's INTENT, which is what matters
  // for consent questions after the fact.
  | 'recording_started'
  | 'recording_stopped'
  | 'reaped'
  // The predictive controller claimed a lead and then failed to place its
  // call. Recorded rather than logged to the console because a tick that
  // claims and places nothing is otherwise indistinguishable, from every table
  // in the database, from a tick that was never asked to dial — which is what
  // made "predictive has never placed a call" so slow to pin down.
  | 'fanout_placement_failed'
  // A predictive tick that fired no calls, with the controller's own reason.
  // Excludes the "at target" steady state — see runPredictiveController.
  | 'fanout_idle'

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

// ── THE FORENSIC TRAIL WAS BEING DROPPED ───────────────────────────────────
// Every caller in the webhook and dialer path invokes this as
// `void logCallEvent(...)`, usually on the line before the response returns.
// That is correct in intent — logging must never block a live call — but on
// Vercel a promise nobody awaits is not a promise that finishes. The instance
// is free to freeze the moment the response is sent, and the insert dies with
// it.
//
// So the trail was lossy in exactly the situation it was built for: under load,
// on the hot path, during the failures the event types above were added to
// explain. Several of those comments describe how hard something was to
// diagnose. This is part of why.
//
// `after()` is the fix rather than `await`: it hands the work to the runtime to
// finish AFTER the response is flushed, so the caller still does not wait and
// the insert still happens. Doing it here rather than at the ~15 call sites
// keeps the change out of the call-path files entirely — every existing
// `void logCallEvent(...)` becomes correct without being touched.
async function insertEvent(input: CallEventInput): Promise<void> {
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

export async function logCallEvent(input: CallEventInput): Promise<void> {
  try {
    // A callback, not a promise: passing a promise would start the insert
    // immediately, and if after() then rejected for being outside a request
    // scope the fallback below would insert the same row a second time.
    after(() => insertEvent(input))
  } catch {
    // Outside a request scope — a background tick or a script — after() throws
    // and there is no response to come after. Nothing is holding the process
    // open on our behalf, so await it here instead.
    await insertEvent(input)
  }
}
