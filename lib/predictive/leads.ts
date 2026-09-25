// =============================================================================
// PREDICTIVE — what happens to a lead leg once it is placed
// =============================================================================
// Called from the Telnyx webhook (app/api/calls/events) and the agent's hangup
// (app/api/calls/hangup), and only ever for predictive lead legs
// (dial_source 'controller_fanout'). Every other mode's legs never reach here.
//
// The rules, from docs/PREDICTIVE.md:
//   - an answered lead joins the seat of the agent who dialed it, else a free
//     teammate's who is on predictive on the same team campaign
//   - nobody free: wait for the detector (≤1.8 s), then a machine is ended
//     silently and a person hears the abandon message with its press-9 opt-out
//   - no leg we end is ended inside the 9-second rule, and no ringing leg is
//     ever cut: ringing legs end on their own timeout
//   - 1x/2x/3x: a lead nobody reached is owed another dial until its repeats
//     are spent (repeatOwed in lib/predictive/pacing, which is the same
//     shouldRedial progressive uses)
// =============================================================================

import { after } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { hangupCallControlId } from '@/lib/placeOutboundCall'
import { logCallEvent } from '@/lib/callEvents'
import { getPlatformConfig } from '@/lib/platformConfig'
import { remainingHoldMs, billingElapsedMs } from '@/lib/complianceHold'
import {
  buildTsrAbandonMessage, ABANDON_OPT_OUT_DIGIT, ABANDON_OPT_OUT_WAIT_MS,
} from '@/lib/tsrAbandonMessage'
import { addSuppression } from '@/lib/suppression'
import { classifyLeg, repeatOwed, type LegOutcome } from '@/lib/predictive/pacing'
import { joinSeatRoom, leaveSeatRoom, gatherOptOut } from '@/lib/predictive/telnyx'
import { isTeamSharedCampaign } from '@/lib/teamOverflow'
import { sellerIdentityForCampaigns } from '@/lib/sellerIdentity'
import {
  readSession, sessionHoldingCall, seatIsLive, heartbeatFresh, clerkIdForUser,
  SESSION_COLUMNS, HEARTBEAT_FRESH_MS, type PredictiveSession,
} from '@/lib/predictive/seat'

const db = getServiceClient('predictive/leads')

/**
 * How long an answer with nobody free waits for the detector before the
 * message plays. A person's "hello?" ends about a second after answer, and the
 * rule's two seconds run from the END of it, so 1.8 s from answer keeps the
 * message inside the rule while giving the detector time to spare a machine.
 */
export const SURPLUS_DECISION_MS = 1800

/** If Telnyx never reports the message finished, the leg ends this long after it started. */
export const ABANDON_SAFETY_MS = 25_000

const ROBOT = new Set(['machine', 'fax_detected'])
const NO_SESSION = '00000000-0000-0000-0000-000000000000'


export const LEAD_COLUMNS =
  'id, call_control_id, dial_group_id, dial_source, campaign_id, team_id, user_id, lead_id, ' +
  'phone_number, answered_at, amd_result, abandon_message_at, was_abandoned, duration, disposition'

export interface LeadLeg {
  id: string
  call_control_id: string
  dial_group_id: string | null
  dial_source: string | null
  campaign_id: string | null
  team_id: string | null
  user_id: string | null
  lead_id: string | null
  phone_number: string | null
  answered_at: string | null
  amd_result: string | null
  abandon_message_at: string | null
  was_abandoned: boolean | null
  duration: number | null
  disposition: string | null
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function readLeadLeg(where: { id?: string; callControlId?: string }): Promise<LeadLeg | null> {
  let q = db.from('calls').select(LEAD_COLUMNS)
  if (where.id) q = q.eq('id', where.id)
  else if (where.callControlId) q = q.eq('call_control_id', where.callControlId)
  else return null
  const { data } = await q.maybeSingle()
  return (data as unknown as LeadLeg) ?? null
}

/**
 * End an answered leg, but never inside the 9-second rule: 8 s + U[0, 2.5) s
 * from answer (lib/complianceHold). No answer stamp holds the full floor.
 */
export async function holdThenHangup(
  callControlId: string,
  answeredAt: string | null,
  why: string
): Promise<boolean> {
  const cfg = await getPlatformConfig()
  const holdSeconds = cfg.amd_hold_seconds_after_machine ?? 8
  const remaining = holdSeconds > 0 ? remainingHoldMs(holdSeconds, billingElapsedMs(answeredAt)) : 0
  if (remaining > 0) await sleep(remaining)
  const ok = await hangupCallControlId(callControlId)
  if (!ok) {
    void logCallEvent({
      event_type: 'hangup_failed',
      call_control_id: callControlId,
      status: why,
      source: 'webhook',
      detail: { after: 'predictive_hold' },
    })
  }
  return ok
}

async function claimAndJoin(s: PredictiveSession, leg: LeadLeg): Promise<boolean> {
  if (!seatIsLive(s) || !heartbeatFresh(s)) return false

  const { data: claim } = await db
    .from('agent_sessions')
    .update({ current_call_id: leg.id, state: 'on_call', updated_at: new Date().toISOString() })
    .eq('id', s.id)
    .is('current_call_id', null)
    .eq('predictive_seat_status', 'live')
    .select('id')
    .maybeSingle()
  if (!claim) return false

  const joined = await joinSeatRoom(s.predictive_seat_conference_id as string, leg.call_control_id)
  if (!joined.ok) {
    await db
      .from('agent_sessions')
      .update({ current_call_id: null, state: 'ready' })
      .eq('id', s.id)
      .eq('current_call_id', leg.id)
    void logCallEvent({
      event_type: 'predictive_route',
      call_control_id: leg.call_control_id,
      status: 'join_failed',
      source: 'webhook',
      detail: { session_id: s.id, status: joined.status, error: joined.error },
    })
    // A room that is not there any more (a seat that dropped, a conference at
    // its four-hour limit) cannot take anybody. End the seat so the next
    // heartbeat places a fresh one instead of every answer failing here.
    //
    // The session is cleared as well as the leg hung up: if the seat's own
    // hangup webhook was lost, the row would otherwise say 'live' about a room
    // that no longer exists, and nothing would ever place a new one.
    if (joined.status === 404 && s.predictive_seat_call_control_id) {
      await db
        .from('agent_sessions')
        .update({
          predictive_seat_status: null,
          predictive_seat_call_control_id: null,
          predictive_seat_conference_id: null,
          predictive_seat_live_at: null,
        })
        .eq('id', s.id)
        .eq('predictive_seat_call_control_id', s.predictive_seat_call_control_id)
      void hangupCallControlId(s.predictive_seat_call_control_id)
    }
    return false
  }

  // handled_by names the agent whose seat took the call. It is what lets a
  // teammate handed a surplus answer poll, end and disposition a call that was
  // dialed on someone else's session (see /api/calls/check, /api/calls/hangup
  // and /api/leads/dispose). Written only here, by the server, at the join.
  const handledBy = await clerkIdForUser(s.user_id)
  await db
    .from('calls')
    .update({ bridged_at: new Date().toISOString(), ...(handledBy ? { handled_by: handledBy } : {}) })
    .eq('id', leg.id)
  return true
}

// ── A TEAMMATE ON THE SAME LIST TAKES THE SURPLUS ─────────────────────────
// Only when every one of these holds, because each is a promise to the person
// who just said hello: the campaign is shared by a team; the teammate is on
// that same team and that same campaign; they are running predictive
// themselves (armed, their own seat live), free (no call, on the queue
// panel), and their browser is alive. Whoever has waited longest goes first.
async function overflowToTeammate(leg: LeadLeg, originSessionId: string | null): Promise<PredictiveSession | null> {
  if (!leg.team_id || !leg.campaign_id) return null
  if (!(await isTeamSharedCampaign(leg.campaign_id))) return null

  const { data } = await db
    .from('agent_sessions')
    .select(SESSION_COLUMNS)
    .eq('team_id', leg.team_id)
    .eq('campaign_id', leg.campaign_id)
    .eq('dialer_mode', 'predictive')
    .eq('predictive_armed', true)
    .eq('predictive_seat_status', 'live')
    .is('current_call_id', null)
    .in('state', ['ready', 'dialing'])
    .gte('last_heartbeat', new Date(Date.now() - HEARTBEAT_FRESH_MS).toISOString())
    .neq('id', originSessionId || NO_SESSION)
    .order('last_heartbeat', { ascending: true })
    .limit(20)

  for (const s of (data || []) as unknown as PredictiveSession[]) {
    if (await claimAndJoin(s, leg)) return s
  }
  return null
}

// The agent who dialed first; a teammate on the same list second. The legal
// line count assumes one agent, so a teammate taking a surplus answer only
// ever lowers the abandon rate below what the count already allowed for.
async function routeToAgentSeat(leg: LeadLeg): Promise<{ how: 'joined' | 'overflow'; session: PredictiveSession } | null> {
  const own = leg.dial_group_id ? await readSession(leg.dial_group_id) : null
  if (own && await claimAndJoin(own, leg)) return { how: 'joined', session: own }
  const mate = await overflowToTeammate(leg, own?.id ?? null)
  if (mate) return { how: 'overflow', session: mate }
  return null
}

/**
 * A predictive lead just answered. Connect them to the agent if their seat is
 * free; if not, decide their fate once the detector has had its moment.
 */
export async function routeAnsweredLead(leg: LeadLeg): Promise<'joined' | 'overflow' | 'surplus'> {
  const routed = await routeToAgentSeat(leg)
  if (routed) {
    void logCallEvent({
      event_type: 'predictive_route',
      call_control_id: leg.call_control_id,
      campaign_id: leg.campaign_id,
      lead_id: leg.lead_id,
      status: routed.how,
      source: 'webhook',
      detail: { session_id: routed.session.id, origin_session: leg.dial_group_id },
    })
    return routed.how
  }

  void logCallEvent({
    event_type: 'predictive_route',
    call_control_id: leg.call_control_id,
    campaign_id: leg.campaign_id,
    lead_id: leg.lead_id,
    status: 'surplus',
    source: 'webhook',
    detail: { origin_session: leg.dial_group_id },
  })

  const answeredMs = leg.answered_at ? Date.parse(leg.answered_at) : Date.now()
  after(async () => {
    const wait = SURPLUS_DECISION_MS - (Date.now() - answeredMs)
    if (wait > 0) await sleep(wait)
    await settleSurplus(leg.id, 'no seat free at answer')
  })
  return 'surplus'
}

/**
 * The last word on an answered lead nobody has taken: one more look for a
 * free seat, then the abandon message. A machine never gets here: the verdict
 * path ends it first, and this re-reads the verdict before saying anything.
 */
export async function settleSurplus(callRowId: string, why: string): Promise<void> {
  const leg = await readLeadLeg({ id: callRowId })
  if (!leg || (leg.duration ?? 0) > 0) return
  if (leg.abandon_message_at) return
  if (leg.amd_result && ROBOT.has(leg.amd_result)) return
  if (await sessionHoldingCall(leg.id)) return

  const routed = await routeToAgentSeat(leg)
  if (routed) {
    void logCallEvent({
      event_type: 'predictive_route',
      call_control_id: leg.call_control_id,
      campaign_id: leg.campaign_id,
      lead_id: leg.lead_id,
      status: `${routed.how}_late`,
      source: 'webhook',
      detail: { session_id: routed.session.id, why },
    })
    return
  }

  await playAbandonMessage(leg, why)
}

/**
 * 16 CFR 310.4(b)(4)(iii) and 47 CFR 64.1200(a)(7)(i): nobody could take this
 * person, so say who called and offer the opt-out. Counted as abandoned.
 */
async function playAbandonMessage(leg: LeadLeg, why: string): Promise<void> {
  const { data: latched } = await db
    .from('calls')
    .update({
      abandon_message_at: new Date().toISOString(),
      was_abandoned: true,
      disposition: 'ABANDONED',
    })
    .eq('id', leg.id)
    .is('abandon_message_at', null)
    .select('id')
    .maybeSingle()
  if (!latched) return

  // The campaign OWNER's details, set once in Settings (lib/sellerIdentity):
  // on a team campaign that is the team owner, whoever dialed.
  const seller = leg.campaign_id
    ? (await sellerIdentityForCampaigns([leg.campaign_id])).get(leg.campaign_id)
    : undefined
  const msg = buildTsrAbandonMessage({
    name: seller?.name,
    callbackNumber: seller?.callbackNumber,
  })

  if (!msg.ok || !msg.text) {
    void logCallEvent({
      event_type: 'tsr_abandon_message',
      call_control_id: leg.call_control_id,
      campaign_id: leg.campaign_id,
      status: 'not_configured',
      source: 'webhook',
      detail: { reason: msg.reason ?? null, why },
    })
    // Nothing can lawfully be said, and the person is still owed a line that
    // does not drop inside the 9-second rule.
    await holdThenHangup(leg.call_control_id, leg.answered_at, 'abandoned without a message')
    return
  }

  const g = await gatherOptOut({
    callControlId: leg.call_control_id,
    text: msg.text,
    optOutDigit: ABANDON_OPT_OUT_DIGIT,
    waitMs: ABANDON_OPT_OUT_WAIT_MS,
  })
  void logCallEvent({
    event_type: 'tsr_abandon_message',
    call_control_id: leg.call_control_id,
    campaign_id: leg.campaign_id,
    status: g.ok ? 'played' : 'speak_failed',
    source: 'webhook',
    detail: { why, error: g.error },
  })

  if (!g.ok) {
    await holdThenHangup(leg.call_control_id, leg.answered_at, 'abandon message failed to start')
    return
  }

  // call.gather.ended ends the leg. This only catches a webhook that never came.
  after(async () => {
    await sleep(ABANDON_SAFETY_MS)
    const { data } = await db.from('calls').select('duration').eq('id', leg.id).maybeSingle()
    if (data && (data.duration ?? 0) === 0) await hangupCallControlId(leg.call_control_id)
  })
}

/**
 * The abandon message finished, or the person pressed a key, or the detector
 * decided it was a machine after all. Returns false for a gather that is not
 * one of ours.
 */
export async function onGatherEnded(
  callControlId: string,
  digits: string | null | undefined,
  status: string | null | undefined
): Promise<boolean> {
  const leg = await readLeadLeg({ callControlId })
  if (!leg?.abandon_message_at) return false

  if (status === 'cancelled_amd') {
    // Telnyx stopped the message because the detector heard a machine. A
    // machine is not a person, so this was never an abandoned call.
    await db
      .from('calls')
      .update({ was_abandoned: false, disposition: 'VOICEMAIL' })
      .eq('id', leg.id)
    await holdThenHangup(callControlId, leg.answered_at, 'machine during the abandon message')
    return true
  }

  if (digits && digits.includes(ABANDON_OPT_OUT_DIGIT) && leg.phone_number) {
    // 64.1200(a)(7)(i)(B): record the number on the seller's do-not-call list
    // and end the call at once. The whole account's list, not one campaign's:
    // the person asked the SELLER to stop, and over-suppressing is the safe
    // direction when an account calls for more than one.
    const result = await addSuppression({
      phone: leg.phone_number,
      userId: leg.user_id,
      campaignId: leg.campaign_id,
      scope: 'user',
      reason: `Pressed ${ABANDON_OPT_OUT_DIGIT} at the abandon message`,
      source: 'predictive_abandon',
    })
    if (leg.lead_id) {
      await db
        .from('leads')
        .update({
          status: 'dnc',
          disposition: 'DO NOT CALL',
          last_call_disposition: 'DO NOT CALL',
          claimed_at: null,
          claimed_by_session_id: null,
        })
        .eq('id', leg.lead_id)
    }
    void logCallEvent({
      event_type: 'predictive_opt_out',
      call_control_id: callControlId,
      campaign_id: leg.campaign_id,
      lead_id: leg.lead_id,
      status: result.ok ? 'suppressed' : 'suppression_failed',
      source: 'webhook',
      detail: { error: result.error ?? null },
    })
    await hangupCallControlId(callControlId)
    return true
  }

  // Message and wait are well past the 9-second rule by now, so this holds
  // nothing in practice; it is here so the rule has no exception.
  await holdThenHangup(callControlId, leg.answered_at, 'abandon message finished')
  return true
}

/**
 * A machine verdict on a predictive lead: free whoever it reached, now. The
 * webhook then holds and hangs up the leg exactly as it does in every mode.
 */
export async function releaseMachineFromSeat(leg: { id: string; call_control_id: string }): Promise<void> {
  const holder = await sessionHoldingCall(leg.id)
  if (holder?.predictive_seat_conference_id) {
    const left = await leaveSeatRoom(holder.predictive_seat_conference_id, leg.call_control_id)
    if (!left.ok) {
      console.error(`[predictive/leads] leave failed for ${leg.call_control_id}: ${left.error}`)
    }
  }
  // A message that began before the verdict was said to a machine.
  await db
    .from('calls')
    .update({ was_abandoned: false })
    .eq('id', leg.id)
    .not('abandon_message_at', 'is', null)
}

/**
 * A person (or an uncertain verdict) on a predictive lead. If nobody has them
 * yet, settle it now rather than waiting out the decision window.
 */
export async function onPersonVerdict(callRowId: string): Promise<void> {
  if (await sessionHoldingCall(callRowId)) return
  await settleSurplus(callRowId, 'person verdict with no seat')
}

/**
 * The agent ended the call (skip or terminate). Free them from the room first;
 * the caller then holds the lead to the 9-second rule and hangs it up.
 */
export async function releaseLeadFromAgent(leg: { id: string; call_control_id: string }): Promise<void> {
  const holder = await sessionHoldingCall(leg.id)
  if (holder?.predictive_seat_conference_id) {
    const left = await leaveSeatRoom(holder.predictive_seat_conference_id, leg.call_control_id)
    if (!left.ok) {
      console.error(`[predictive/leads] agent release failed for ${leg.call_control_id}: ${left.error}`)
    }
  }
}

/**
 * The agent's seat dropped while a lead was on it. The lead is alone in an
 * empty room: end it, held to the 9-second rule, rather than leave it there.
 */
export async function releaseStrandedLead(callRowId: string): Promise<void> {
  const leg = await readLeadLeg({ id: callRowId })
  if (!leg || (leg.duration ?? 0) > 0) return
  await db
    .from('agent_sessions')
    .update({ current_call_id: null })
    .eq('current_call_id', callRowId)
  after(async () => {
    await holdThenHangup(leg.call_control_id, leg.answered_at, 'agent line dropped mid-call')
  })
}


/**
 * A predictive lead leg ended. Decide whether its lead is owed another dial
 * (1x/2x/3x) or is done, and say which, so the webhook can do the lead's own
 * bookkeeping.
 */
export async function onPredictiveLegEnded(leg: {
  dial_group_id: string | null
  lead_id: string | null
  answered_at: string | null
  amd_result: string | null
  hangup_cause?: string | null
}): Promise<{ outcome: LegOutcome; repeatOwed: boolean }> {
  const outcome = classifyLeg(leg)
  if (!leg.dial_group_id || !leg.lead_id) return { outcome, repeatOwed: false }

  const { data: batch } = await db
    .from('predictive_batch')
    .select('attempts, max_attempts')
    .eq('session_id', leg.dial_group_id)
    .eq('lead_id', leg.lead_id)
    .maybeSingle()
  if (!batch) return { outcome, repeatOwed: false }

  const owed = repeatOwed(outcome, batch.attempts, batch.max_attempts)

  if (owed) {
    await db
      .from('predictive_batch')
      .update({ state: 'waiting', last_outcome: outcome, updated_at: new Date().toISOString() })
      .eq('session_id', leg.dial_group_id)
      .eq('lead_id', leg.lead_id)
  } else {
    await db
      .from('predictive_batch')
      .delete()
      .eq('session_id', leg.dial_group_id)
      .eq('lead_id', leg.lead_id)
  }
  return { outcome, repeatOwed: owed }
}
