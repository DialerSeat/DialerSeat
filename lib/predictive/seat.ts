// =============================================================================
// THE SEAT — one agent line for the whole predictive session
// =============================================================================
// Placed when the agent presses START, answered by their browser like any
// agent leg, then put in a conference of its own. Every answered lead joins
// that room and leaves it again; the seat itself stays up until the engine is
// stopped and nothing is left ringing. See docs/PREDICTIVE.md §1.
//
// State lives on agent_sessions:
//   predictive_seat_status           null → 'placing' → 'live'
//   predictive_seat_call_control_id  the leg
//   predictive_seat_conference_id    the room
//
// Every transition is a conditional update, so two heartbeats or a heartbeat
// and a webhook arriving together cannot place two seats or clear a new one.
// =============================================================================

import { getServiceClient } from '@/lib/supabase'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import { agentSipUriForClerkId, resolveCredentialConnectionId } from '@/lib/agentSipCredentials'
import { hangupCallControlId } from '@/lib/placeOutboundCall'
import { logCallEvent } from '@/lib/callEvents'
import { ensureSipUriCallingEnabled, isSipUriRejection } from '@/lib/telnyxSipUriCalling'
import { dialSeat, createSeatRoom } from '@/lib/predictive/telnyx'

const db = getServiceClient('predictive/seat')

/** A seat still 'placing' after this long is presumed lost and re-placed. */
export const SEAT_PLACING_GRACE_MS = 20_000
/** Consecutive failures before the engine stops re-placing until re-armed. */
export const SEAT_FAILURE_LIMIT = 3
/** Telnyx ends a conference at four hours. The seat is rotated before that. */
export const SEAT_ROTATE_AFTER_MS = 3.5 * 60 * 60 * 1000
/** A heartbeat older than this means the browser is not there to talk. */
export const HEARTBEAT_FRESH_MS = 15_000
/** How far back a zero-duration row still counts as a line in flight. */
export const IN_FLIGHT_WINDOW_MS = 90_000

export const SESSION_COLUMNS =
  'id, user_id, team_id, campaign_id, state, current_call_id, last_heartbeat, ' +
  'predictive_armed, predictive_seat_call_control_id, predictive_seat_status, ' +
  'predictive_seat_conference_id, predictive_seat_placed_at, predictive_seat_live_at, ' +
  'predictive_seat_failures, predictive_tick_lock, predictive_paused_until'

export interface PredictiveSession {
  id: string
  user_id: string
  team_id: string | null
  campaign_id: string | null
  state: string | null
  current_call_id: string | null
  last_heartbeat: string | null
  predictive_armed: boolean | null
  predictive_seat_call_control_id: string | null
  predictive_seat_status: 'placing' | 'live' | null
  predictive_seat_conference_id: string | null
  predictive_seat_placed_at: string | null
  predictive_seat_live_at: string | null
  predictive_seat_failures: number | null
  predictive_tick_lock: string | null
  predictive_paused_until: string | null
}

export function seatIsLive(s: PredictiveSession | null | undefined): boolean {
  return !!s
    && s.predictive_seat_status === 'live'
    && !!s.predictive_seat_call_control_id
    && !!s.predictive_seat_conference_id
}

export function heartbeatFresh(s: PredictiveSession | null | undefined, now = Date.now()): boolean {
  if (!s?.last_heartbeat) return false
  const t = Date.parse(s.last_heartbeat)
  return Number.isFinite(t) && now - t <= HEARTBEAT_FRESH_MS
}

export async function readSession(sessionId: string): Promise<PredictiveSession | null> {
  const { data } = await db
    .from('agent_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle()
  return (data as unknown as PredictiveSession) ?? null
}

export async function sessionBySeat(callControlId: string): Promise<PredictiveSession | null> {
  const { data } = await db
    .from('agent_sessions')
    .select(SESSION_COLUMNS)
    .eq('predictive_seat_call_control_id', callControlId)
    .maybeSingle()
  return (data as unknown as PredictiveSession) ?? null
}

/** The session whose agent is on this call, whichever seat that is. */
export async function sessionHoldingCall(callRowId: string): Promise<PredictiveSession | null> {
  const { data } = await db
    .from('agent_sessions')
    .select(SESSION_COLUMNS)
    .eq('current_call_id', callRowId)
    .maybeSingle()
  return (data as unknown as PredictiveSession) ?? null
}

export async function linesInFlight(sessionId: string): Promise<Array<{ id: string; lead_id: string | null; phone_number: string | null }>> {
  const { data } = await db
    .from('calls')
    .select('id, lead_id, phone_number')
    .eq('dial_group_id', sessionId)
    .eq('duration', 0)
    .gte('created_at', new Date(Date.now() - IN_FLIGHT_WINDOW_MS).toISOString())
  return (data || []) as Array<{ id: string; lead_id: string | null; phone_number: string | null }>
}

export interface EnsureSeatResult {
  state: 'live' | 'placing' | 'failed'
  reason: string
}

async function recordFailure(s: PredictiveSession, clerkId: string, reason: string): Promise<EnsureSeatResult> {
  const failures = (s.predictive_seat_failures ?? 0) + 1
  await db
    .from('agent_sessions')
    .update({
      predictive_seat_status: null,
      predictive_seat_call_control_id: null,
      predictive_seat_conference_id: null,
      predictive_seat_failures: failures,
    })
    .eq('id', s.id)
  void logCallEvent({
    event_type: 'predictive_seat',
    user_id: clerkId,
    status: 'failed',
    source: 'system',
    detail: { session_id: s.id, reason, failures },
  })
  console.error(`[predictive/seat] ${s.id} seat failed (${failures}): ${reason}`)
  return { state: 'failed', reason: `your line could not connect: ${reason}` }
}

/**
 * Make sure this session has a seat, placing one if it has none. Idempotent:
 * safe to call on every heartbeat.
 */
export async function ensureSeat(sessionId: string, clerkId: string): Promise<EnsureSeatResult> {
  const s = await readSession(sessionId)
  if (!s) return { state: 'failed', reason: 'no dialer session yet' }
  if (seatIsLive(s)) return { state: 'live', reason: 'line connected' }

  const placedAt = s.predictive_seat_placed_at ? Date.parse(s.predictive_seat_placed_at) : NaN
  const placingFresh =
    s.predictive_seat_status === 'placing' &&
    Number.isFinite(placedAt) &&
    Date.now() - placedAt < SEAT_PLACING_GRACE_MS
  if (placingFresh) return { state: 'placing', reason: 'connecting your line' }

  if ((s.predictive_seat_failures ?? 0) >= SEAT_FAILURE_LIMIT) {
    return {
      state: 'failed',
      reason: `your line failed to connect ${s.predictive_seat_failures} times in a row, press STOP then START to try again`,
    }
  }

  // Taken atomically: only one request places a seat, whatever else arrives.
  const staleBefore = new Date(Date.now() - SEAT_PLACING_GRACE_MS).toISOString()
  const { data: took } = await db
    .from('agent_sessions')
    .update({
      predictive_seat_status: 'placing',
      predictive_seat_placed_at: new Date().toISOString(),
      predictive_seat_call_control_id: null,
      predictive_seat_conference_id: null,
      predictive_seat_live_at: null,
    })
    .eq('id', sessionId)
    .or(`predictive_seat_status.is.null,and(predictive_seat_status.eq.placing,predictive_seat_placed_at.lt.${staleBefore})`)
    .select('id')
    .maybeSingle()
  if (!took) return { state: 'placing', reason: 'connecting your line' }

  // A seat that never came up must not be left ringing the browser.
  if (s.predictive_seat_call_control_id) {
    void hangupCallControlId(s.predictive_seat_call_control_id)
  }

  const env = resolveTelnyxConfigOrLog('predictive/seat')
  const from = process.env.TELNYX_PHONE_NUMBER
  if (!env || !from) return recordFailure(s, clerkId, 'the carrier is not configured')

  const to = await agentSipUriForClerkId(clerkId, env)
  const place = () => dialSeat({
    clerkId, sessionId, connectionId: env.connectionId, webhookUrl: env.webhookUrl, to, from,
  })
  let r = await place()

  // Same self-heal every agent leg uses: Telnyx disables SIP URI calling by
  // default and reports it as a phone-number format error.
  if (!r.ok && isSipUriRejection(r.errors)) {
    const target = (await resolveCredentialConnectionId(env)) || env.connectionId
    if ((await ensureSipUriCallingEnabled(target, env.apiKey)) === 'enabled') r = await place()
  }
  if (!r.ok || !r.callControlId) return recordFailure(s, clerkId, r.error || 'the carrier refused the call')

  await db
    .from('agent_sessions')
    .update({ predictive_seat_call_control_id: r.callControlId })
    .eq('id', sessionId)
    .eq('predictive_seat_status', 'placing')

  void logCallEvent({
    event_type: 'predictive_seat',
    call_control_id: r.callControlId,
    user_id: clerkId,
    status: 'placing',
    source: 'system',
    detail: { session_id: sessionId },
  })
  return { state: 'placing', reason: 'connecting your line' }
}

/**
 * The browser answered its seat. Open the room.
 *
 * Matched by the leg id first. The answer can beat the write that records it
 * (the browser answers in under a second), so a session still 'placing' for
 * this agent adopts the leg as a fallback.
 */
export async function onSeatAnswered(callControlId: string, clerkId: string | null): Promise<void> {
  let s = await sessionBySeat(callControlId)

  if (!s && clerkId) {
    const { data: user } = await db.from('users').select('id').eq('clerk_id', clerkId).maybeSingle()
    if (user?.id) {
      const { data: adopted } = await db
        .from('agent_sessions')
        .update({ predictive_seat_call_control_id: callControlId })
        .eq('user_id', user.id)
        .eq('predictive_seat_status', 'placing')
        .is('predictive_seat_call_control_id', null)
        .select(SESSION_COLUMNS)
        .maybeSingle()
      s = (adopted as unknown as PredictiveSession) ?? null
    }
  }

  if (!s || !s.predictive_armed) {
    // Nobody is waiting for this line any more (stopped while it rang). A seat
    // leg has no lead on it, so ending it at once costs nothing but the few
    // agent-leg seconds it has lived.
    await hangupCallControlId(callControlId)
    if (s) {
      await db
        .from('agent_sessions')
        .update({ predictive_seat_status: null, predictive_seat_call_control_id: null })
        .eq('id', s.id)
        .eq('predictive_seat_call_control_id', callControlId)
    }
    return
  }

  const room = await createSeatRoom(callControlId, s.id)
  if (!room.ok || !room.conferenceId) {
    await hangupCallControlId(callControlId)
    await recordFailure(s, clerkId ?? '', `the room could not be opened: ${room.error}`)
    return
  }

  await db
    .from('agent_sessions')
    .update({
      predictive_seat_status: 'live',
      predictive_seat_conference_id: room.conferenceId,
      predictive_seat_live_at: new Date().toISOString(),
      predictive_seat_failures: 0,
    })
    .eq('id', s.id)
    .eq('predictive_seat_call_control_id', callControlId)

  void logCallEvent({
    event_type: 'predictive_seat',
    call_control_id: callControlId,
    user_id: clerkId,
    status: 'live',
    source: 'webhook',
    detail: { session_id: s.id, conference_id: room.conferenceId },
  })
}

/**
 * The seat leg ended. Clear it, and hand back the call it was carrying, if
 * any, so the caller can release that lead properly rather than leave it in
 * an empty room.
 */
export async function onSeatHangup(
  callControlId: string,
  hangupCause?: string
): Promise<{ session: PredictiveSession | null; strandedCallId: string | null }> {
  const s = await sessionBySeat(callControlId)
  if (!s) return { session: null, strandedCallId: null }

  // A seat that ended without ever going live never reached the browser, or
  // the browser could not answer it (a blocked microphone, a dead socket).
  // That counts toward the failure limit, or it would be placed again every
  // thirty seconds for as long as the engine stayed armed.
  const neverLive = s.predictive_seat_status !== 'live'
  await db
    .from('agent_sessions')
    .update({
      predictive_seat_status: null,
      predictive_seat_call_control_id: null,
      predictive_seat_conference_id: null,
      predictive_seat_live_at: null,
      ...(neverLive ? { predictive_seat_failures: (s.predictive_seat_failures ?? 0) + 1 } : {}),
    })
    .eq('id', s.id)
    .eq('predictive_seat_call_control_id', callControlId)

  void logCallEvent({
    event_type: 'predictive_seat',
    call_control_id: callControlId,
    status: 'ended',
    source: 'webhook',
    detail: { session_id: s.id, hangup_cause: hangupCause ?? null, carrying_call: s.current_call_id },
  })
  return { session: s, strandedCallId: s.current_call_id }
}

/**
 * Release the seat once the engine is stopped and nothing is left: no call
 * with the agent and no line still ringing. A person who answers a line that
 * was already ringing when STOP was pressed still reaches the agent.
 */
export async function releaseSeatIfIdle(sessionId: string, why: string): Promise<boolean> {
  const s = await readSession(sessionId)
  if (!s?.predictive_seat_call_control_id) return false
  if (s.predictive_armed) return false
  if (s.current_call_id) return false
  if ((await linesInFlight(sessionId)).length > 0) return false

  const ended = await hangupCallControlId(s.predictive_seat_call_control_id)
  void logCallEvent({
    event_type: 'predictive_seat',
    call_control_id: s.predictive_seat_call_control_id,
    status: 'released',
    source: 'system',
    detail: { session_id: sessionId, why, hangup_sent: ended },
  })
  return ended
}

/**
 * Hang up a seat that is close to Telnyx's four-hour conference limit, while
 * the agent is idle between rounds. The next tick places a fresh one.
 */
export async function rotateSeatIfOld(s: PredictiveSession): Promise<boolean> {
  if (!seatIsLive(s) || !s.predictive_seat_live_at) return false
  const liveAt = Date.parse(s.predictive_seat_live_at)
  if (!Number.isFinite(liveAt) || Date.now() - liveAt < SEAT_ROTATE_AFTER_MS) return false
  if (s.current_call_id) return false

  await hangupCallControlId(s.predictive_seat_call_control_id as string)
  void logCallEvent({
    event_type: 'predictive_seat',
    call_control_id: s.predictive_seat_call_control_id,
    status: 'rotated',
    source: 'system',
    detail: { session_id: s.id, live_for_ms: Date.now() - liveAt },
  })
  return true
}
