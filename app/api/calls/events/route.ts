import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTelnyxWebhook } from '@/lib/verifyTelnyxWebhook'
import {
  claimTelnyxEvent,
  markTelnyxEventProcessed,
  markTelnyxEventFailed,
} from '@/lib/telnyxIdempotency'
import { recordAmdResult, markCallAbandoned } from '@/lib/dialerPacing'
import { logCallEvent } from '@/lib/callEvents'
import { checkDailySpend } from '@/lib/dailySpendAlarm'
import { buildTsrAbandonMessage } from '@/lib/tsrAbandonMessage'
import { sampleBalanceAfterCall } from '@/lib/telnyxBalance'
import {
  hangupCallControlId, bridgeCallControlIds, buildClientState, parseClientState,
} from '@/lib/placeOutboundCall'
import { handleOverflowAnsweredCall } from '@/lib/teamOverflow'
import { abortSiblingFanoutLines } from '@/lib/predictiveController'
import { startTelnyxRecording } from '@/lib/telnyxRecording'
import { remainingHoldMs, HOLD_SPREAD_SECONDS } from '@/lib/complianceHold'
import { lifetimeAttemptCap } from '@/lib/dialerConstants'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import {
  agentSipUriForUserId, agentSipUriForClerkId, resolveCredentialConnectionId,
} from '@/lib/agentSipCredentials'
import { ensureSipUriCallingEnabled, isSipUriRejection } from '@/lib/telnyxSipUriCalling'
import { getPlatformConfig } from '@/lib/platformConfig'
import { recordDestinationRate } from '@/lib/destinationRates'
import { refundUsage } from '@/lib/numberPool'

// =============================================================================
// UNIFIED CALL CONTROL EVENTS WEBHOOK — replaces status + amd-result
// =============================================================================
// Under native Call Control, ONE webhook_url receives every event type for
// a call (call.initiated, call.answered, call.hangup,
// call.machine.detection.ended, ...), dispatched by data.event_type. This
// replaces SignalWire's split StatusCallback / AsyncAmdStatusCallback
// design — there's no separate "status" endpoint anymore.
//
// BEHAVIOR BY EVENT (see TELNYX-MIGRATION-DESIGN.md for the full spec this
// implements):
//
//   call.answered
//     - user_dial calls: nothing to do. bridge_on_answer already bridged
//       the lead to the pre-dialed agent leg automatically — no action
//       needed here, the agent already has the call.
//     - controller_fanout calls: this is the moment we learn a human (or
//       at least something) picked up. We don't yet know if it's a human
//       or a machine — AMD is still running. So we do NOT bridge yet here.
//       We wait for call.machine.detection.ended to decide. (Native AMD
//       fires the machine-detection webhook shortly after answer; there's
//       a brief window where the call is answered-but-undetermined. Audio
//       isn't bridged to anyone during that window for fanout calls — the
//       lead just hears ring/silence for a beat, same tradeoff the
//       original SignalWire background-AMD design accepted.)
//
//   call.machine.detection.ended (payload.result: 'human' | 'machine' | 'not_sure')
//     - result === 'machine':
//         SILENT INSTANT SKIP. Hang up immediately. NO disposition is
//         written. NO disposition prompt. The dialer (client-side, power/
//         progressive auto-chain; predictive server-driven) just moves on
//         to the next lead. This is a deliberate product decision — see
//         design doc item 5. Only two things ever produce a disposition:
//         the agent hanging up, or the lead hanging up (handled in
//         call.hangup below, not here).
//     - result === 'human' or 'not_sure' (Telnyx's own recommendation:
//       treat not_sure as human):
//         - user_dial: nothing to do, already bridged at answer.
//         - controller_fanout: NOW we decide routing. Claim a ready agent
//           on the originating campaign if one's still available; if the
//           agent that triggered this dial has gone busy in the meantime,
//           this is "excess" overdial — hand off to lib/teamOverflow.ts,
//           which either bridges to another ready team agent (team-shared
//           campaigns) or hangs up (solo campaigns).
//
//   call.hangup
//     - Always logged. This is one of the exactly-two places a
//       disposition becomes relevant — the actual disposition VALUE is
//       still chosen by the agent in the UI (dialer page's disposition
//       sheet), this webhook just marks the call as ended so the client's
//       polling (/api/calls/check) sees status flip to 'completed' and
//       surfaces the sheet. We do not auto-assign a disposition string
//       here for ordinary hangups — only the AMD-machine path bypasses
//       disposition entirely, and it does so by never reaching this event
//       with anything to disposition (the call was already hung up by us
//       in the machine-detection branch above).
// =============================================================================

interface TelnyxWebhookPayload {
  data: {
    event_type: string
    id: string
    occurred_at: string
    payload: {
      call_control_id: string
      call_leg_id: string
      call_session_id: string
      client_state?: string
      connection_id?: string
      from?: string
      to?: string
      direction?: string        // 'incoming' | 'outgoing'
      result?: string          // call.machine.detection.ended
      hangup_cause?: string    // call.hangup
      hangup_source?: string   // call.hangup
      recording_urls?: { mp3?: string; wav?: string } // call.recording.saved
      recording_id?: string    // call.recording.saved — the STABLE id; see below
      recording_started_at?: string
      recording_ended_at?: string
    }
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const bad = verifyTelnyxWebhook(req, rawBody)
  if (bad) return bad

  let body: TelnyxWebhookPayload
  try {
    body = JSON.parse(rawBody)
  } catch {
    console.warn('[calls/events] non-JSON body, ignoring')
    return NextResponse.json({ ok: true })
  }

  const eventType = body?.data?.event_type
  const payload = body?.data?.payload
  const callControlId = payload?.call_control_id

  if (!eventType || !callControlId) {
    console.warn('[calls/events] missing event_type or call_control_id', body)
    return NextResponse.json({ ok: true })
  }

  // ── IDEMPOTENCY ──────────────────────────────────────────────────────────
  // Telnyx retries delivery, and this dispatcher has handlers with real side
  // effects — hanging up a leg on an AMD machine result, writing duration,
  // triggering a recording sync. Individual handlers guard some of that ad
  // hoc; this makes it structural, so the next handler added is covered
  // without its author having to remember.
  //
  // Fails OPEN by design (see lib/telnyxIdempotency.ts): a bookkeeping table
  // being unavailable must never cause a dropped call.hangup, which would
  // leave an agent wedged on a call that already ended.
  const eventId = body?.data?.id
  const claim = await claimTelnyxEvent(eventId, eventType)
  if (!claim.shouldProcess) {
    // 200, not an error — this is Telnyx doing exactly what it should, and a
    // non-2xx would just earn another retry of an event we already handled.
    return NextResponse.json({ ok: true, deduped: claim.reason })
  }

  try {
    switch (eventType) {
      case 'call.initiated':
        void logCallEvent({
          event_type: 'initiated',
          call_control_id: callControlId,
          source: 'webhook',
        })
        if (payload.direction === 'incoming') {
          await handleInboundCallInitiated(callControlId)
        }
        break

      case 'call.answered':
        if (payload.direction === 'incoming') {
          await handleInboundCallAnswered(callControlId)
        } else {
          await handleCallAnswered(callControlId)
        }
        break

      // Premium emits a DIFFERENT event name. Handled here so switching
      // amd_detector to 'premium' cannot silently stop AMD working — without
      // this the verdict would never reach handleAmdResult and every machine
      // would go straight through to an agent.
      // The greeting finished — the beep. Only detect_beep and the premium
      // detectors emit this, and we run 'detect', so in practice it never
      // arrives. Logged rather than acted on: it is the timing signal any
      // future voicemail feature would need, and having it on record is what
      // let the detect_beep question be settled with data rather than guesses.
      case 'call.machine.greeting.ended':
      case 'call.machine.premium.greeting.ended':
        void logCallEvent({
          event_type: 'amd_greeting_ended',
          call_control_id: callControlId,
          status: payload.result ?? null,
          source: 'webhook',
        })
        break

      case 'call.machine.premium.detection.ended':
      case 'call.machine.detection.ended':
        await handleAmdResult(callControlId, payload.result || 'not_sure')
        break

      case 'call.hangup':
        await handleHangup(callControlId, payload.hangup_cause, payload.hangup_source)
        break

      case 'call.cost':
        await handleCallCost(callControlId, payload as unknown as Record<string, unknown>)
        break

      // ── TELNYX ALREADY TELLS US WHEN A CALL BRIDGES ────────────────────
      // This sat in `unhandled` — 3,189 of them in eight days — while
      // `bridged_at` was inferred instead, in the `user_dial` branch of
      // handleCallAnswered, from the explicit bridge command we send there.
      //
      // Fan-out never runs that branch, so every fan-out bridge was invisible:
      // 137 answered controller_fanout legs, 0 with bridged_at, and the
      // obvious reading of that was that predictive answers prospects into
      // silence. It does not. Telnyx sent call.bridged for 136 of those 137 —
      // link_to and bridge_on_answer work exactly as intended on that path.
      //
      // So stamp it from the carrier's own event rather than from our
      // inference of it. Purely additive: it writes a timestamp when one is
      // missing and issues no commands, which is why it is safe on a path
      // whose behaviour is otherwise untouched.
      case 'call.bridged':
        await handleCallBridged(callControlId)
        break

      case 'call.recording.saved':
        await handleRecordingSaved(
          callControlId,
          payload.recording_urls,
          payload.recording_id,
          payload.recording_started_at,
          payload.recording_ended_at,
        )
        break

      // ── KNOWN, UNDERSTOOD, AND DELIBERATELY NOT STORED ─────────────────
      // These are OUR OWN compliance hold, echoed back at us. When AMD returns
      // `machine` the agent's leg is released and `park_after_unbridge: 'self'`
      // parks the lead leg for amd_hold_seconds_after_machine; Telnyx reports
      // that as call.hold, then call.unhold when it ends.
      //
      // Measured before silencing them: 412 hold periods in eight days,
      // averaging 8.4 seconds, 276 of them on machine verdicts — which is the
      // 9-second hold, working exactly as designed. See COST-FINDINGS §1s.
      //
      // 465 rows a day between them, in a table that is already 44% of the
      // database. The `default` branch below exists to catch events nobody has
      // looked at yet; these have been looked at. Silencing a KNOWN event is
      // not the same as the blindness that made detect_beep undiagnosable —
      // that was unknown events vanishing. Anything still unrecognised keeps
      // landing in `unhandled` exactly as before.
      case 'call.hold':
      case 'call.unhold':
        break

      default:
        // ── RECORDED, NOT DISCARDED ──────────────────────────────────────
        // These used to vanish silently, and that blindness is exactly why
        // detect_beep could not be diagnosed: two live tests showed detection
        // failing, and the events that would have said WHY were dropped here
        // without trace.
        //
        // Writing the raw Telnyx type into `status` makes one test call
        // answer the question outright — which events a detector actually
        // emits, in what order, and whether a machine verdict arrives at all.
        //
        // Cheap: a handful of rows per call, and `detail` carries the result
        // field when the event has one, which is the payload that matters for
        // any detection event.
        void logCallEvent({
          event_type: 'unhandled',
          call_control_id: callControlId,
          status: eventType,
          source: 'webhook',
          detail: payload.result ? { result: payload.result } : null,
        })
        break
    }
    // Marked processed only after the dispatch completed without throwing, so
    // a genuine failure leaves the row 'received' -> retryable rather than
    // permanently suppressing the event.
    await markTelnyxEventProcessed(eventId)
  } catch (err) {
    console.error(`[calls/events] handler error for ${eventType}:`, err)
    // Recorded as failed so a Telnyx retry is allowed to have another go,
    // instead of being deduped away against a half-finished attempt.
    await markTelnyxEventFailed(eventId, err)
    // Always 200 — Telnyx retries on non-2xx, and retrying a handler that
    // already partially executed (e.g. already hung up a call) can cause
    // duplicate side effects. Errors are logged for us to see, not
    // surfaced to Telnyx as a delivery failure.
  }

  return NextResponse.json({ ok: true })
}

/**
 * Join the agent to the lead, exactly once.
 *
 * PREDICTIVE FAN-OUT ONLY. An agent-attended call (user_dial) is bridged by
 * Telnyx itself via bridge_on_answer at the instant of pickup — nothing here
 * touches it, because anything that waits for a webhook first is by definition
 * dead air. See the bridge comment in lib/placeOutboundCall.ts for the
 * measurements behind that.
 *
 * Fan-out is the genuinely different case: those lines are placed with no
 * agent attached at all, so there is nobody to hear silence, and routing
 * really does have to wait for a verdict.
 *
 * The conditional update keeps it idempotent: `.is('bridged_at', null)` means
 * only the first caller gets rows back, and only that caller issues the bridge
 * command, so a duplicate webhook is a no-op rather than a second bridge.
 */
async function bridgeAgentOntoLead(
  leadCallControlId: string,
  reason: string
): Promise<'bridged' | 'already' | 'no-agent' | 'failed'> {
  const { data: claimed } = await supabaseAdmin
    .from('calls')
    .update({ bridged_at: new Date().toISOString() })
    .eq('call_control_id', leadCallControlId)
    .is('bridged_at', null)
    .select('agent_call_control_id')

  if (!claimed || claimed.length === 0) return 'already'

  const agentLeg = claimed[0]?.agent_call_control_id
  if (!agentLeg) return 'no-agent'

  const ok = await bridgeCallControlIds(leadCallControlId, agentLeg)
  if (!ok) {
    // Put it back so a later verdict can retry rather than the call being
    // permanently marked as bridged when it is not.
    await supabaseAdmin
      .from('calls')
      .update({ bridged_at: null })
      .eq('call_control_id', leadCallControlId)
    return 'failed'
  }

  console.log(`[calls/events] bridged agent onto ${leadCallControlId} (${reason})`)
  return 'bridged'
}

// ── DEFERRED AGENT LEG: PLACED WHEN THE LEAD ANSWERS ──────────────────────
// Normally both legs go out together and Telnyx bridges them at pickup, which
// is what makes an answered call open without dead air. The price is an agent
// leg live for the entire time the lead's phone rings, on every dial including
// the ones nobody answers — 317 such legs, 176 billed minutes, 17% of a clean
// session's carrier spend on 14 Sept, buying nothing.
//
// With platform_config.dial_agent_on_answer on, the lead is dialed alone and
// this places the agent's leg the moment they pick up. The browser auto-answers
// in about 0.4 seconds; the configured line covers that gap.
//
// THE TRADE, STATED PLAINLY: this moves where failure lands. Today a dead agent
// socket fails BEFORE the lead's phone rings and nobody is disturbed. Here the
// lead answers first and the agent is discovered unreachable afterwards — an
// abandoned call in the sense the FTC means it. Agent-leg failure ran 10-20%
// during the socket problems on 14 Sept. Abandoned sits at 2.9% against a 20%
// threshold, so there is room, but this is the change that spends it. Every
// failure path below therefore ENDS THE LEAD'S CALL rather than leaving a
// person listening to nothing.
//
// user_dial only. Fan-out has its own agent-leg path which is already marked
// unverified in this file, and wiring a second deferral through it would be
// changing two things at once on the code that had seven people hearing
// silence.
async function placeAgentLegForAnsweredLead(
  leadCallControlId: string,
  callRow: { id: string; user_id: string | null; pool_number_id: string | null }
): Promise<void> {
  const env = resolveTelnyxConfigOrLog('placeAgentLegForAnsweredLead')
  if (!env || !callRow.user_id) {
    console.error(
      `[calls/events] cannot place deferred agent leg for ${leadCallControlId} ` +
      `(env=${!!env}, user=${callRow.user_id}); hanging up rather than leaving dead air`
    )
    await hangupCallControlId(leadCallControlId)
    return
  }

  // Said BEFORE the agent leg is dialled, not after. The speak command is
  // queued on the lead's call and starts playing while the dial is in flight,
  // so the two overlap instead of adding up. Empty message plays nothing.
  const { connecting_message: connectingMessage } = await getPlatformConfig()
  if (connectingMessage && connectingMessage.trim().length > 0) {
    void callControlAction(leadCallControlId, 'speak', {
      payload: connectingMessage,
      voice: 'female',
    })
  }

  // The caller ID the lead already sees, so the agent's screen and the
  // prospect's handset agree. Falls back to the platform number.
  let fromNumber = process.env.TELNYX_PHONE_NUMBER || ''
  if (callRow.pool_number_id) {
    const { data: poolRow } = await supabaseAdmin
      .from('phone_numbers')
      .select('phone_number')
      .eq('id', callRow.pool_number_id)
      .maybeSingle()
    if (poolRow?.phone_number) fromNumber = poolRow.phone_number
  }

  const agentSipUri = await agentSipUriForClerkId(callRow.user_id, env)
  if (!agentSipUri || !fromNumber) {
    console.error(
      `[calls/events] no agent SIP URI or caller id for ${leadCallControlId}; hanging up`
    )
    await hangupCallControlId(leadCallControlId)
    return
  }

  try {
    const res = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: env.connectionId,
        // STAMPED AS OURS, and it matters twice. /api/dialer/abort finds legs
        // to hang up by client_state, so an unstamped agent leg is invisible
        // to the kill switch — the fan-out path carries exactly that bug and
        // says so. And parseClientState is what lets the inbound handler tell
        // one of our own legs from a stranger's call, which is the gate the
        // reverted inbound rejection should have used instead of `direction`.
        client_state: buildClientState({
          u: callRow.user_id, s: 'deferred_agent_leg',
        }),
        to: agentSipUri,
        from: fromNumber,
        webhook_url: env.webhookUrl,
        // Short on purpose. The browser auto-answers in ~0.4s, so anything
        // past a few seconds means it is not going to — and every one of
        // those seconds is a person holding a silent line.
        timeout_secs: 12,
      }),
    })
    const body = await res.json()
    const agentLegId: string | undefined = body?.data?.call_control_id

    if (!res.ok || !agentLegId) {
      console.error(
        `[calls/events] deferred agent leg dial FAILED for ${leadCallControlId}:`,
        JSON.stringify(body).slice(0, 300)
      )
      await hangupCallControlId(leadCallControlId)
      return
    }

    // Written before the bridge so the agent leg's own call.answered webhook —
    // which can arrive within a few hundred milliseconds — can find its lead.
    await supabaseAdmin
      .from('calls')
      .update({ agent_call_control_id: agentLegId })
      .eq('id', callRow.id)

    console.log(`[calls/events] deferred agent leg ${agentLegId} placed for ${leadCallControlId}`)
  } catch (err) {
    console.error('[calls/events] deferred agent leg threw:', err)
    await hangupCallControlId(leadCallControlId)
  }
}

async function handleCallAnswered(callControlId: string): Promise<void> {
  void logCallEvent({
    event_type: 'answered',
    call_control_id: callControlId,
    source: 'webhook',
  })

  // ── RECORD THE ACTUAL ANSWER ─────────────────────────────────────────────
  // This is the ONLY moment we learn a human picked up the phone, and until
  // now nothing persisted it — /api/calls/check inferred "in progress" from
  // duration = 0, which is equally true while the phone is still ringing. So
  // the dialer flipped to CONNECTED and showed the lead profile and scripts
  // within ~1.5s of dialing, well before the lead answered.
  //
  // Safe against the agent leg: this webhook fires for BOTH legs, but the
  // calls row is keyed by the lead leg's call_control_id and no row exists
  // for the agent leg — so the agent's browser auto-answering updates
  // nothing. Only a real lead answer can set this.
  //
  // Written once. A duplicate/late call.answered (Telnyx retries) must not
  // move the timestamp forward, or the on-screen call timer would jump.
  try {
    await supabaseAdmin
      .from('calls')
      .update({ answered_at: new Date().toISOString() })
      .eq('call_control_id', callControlId)
      .is('answered_at', null)
  } catch (err) {
    console.error(`[calls/events] failed to record answered_at for ${callControlId}:`, err)
  }

  // ── FAN-OUT CONNECTS AT PICKUP, NOT AT THE VERDICT ────────────────────────
  // Deliberate product decision, made with the tradeoff understood.
  //
  // Fan-out used to wait for AMD before bridging anyone. That is better for
  // detection — a detector classifying an already-joined call is unreliable,
  // which is why this codebase moved AMD ahead of the bridge in the first
  // place — but it means a prospect who answers hears roughly four seconds of
  // silence before anyone arrives, and hears nothing at all if the verdict
  // comes back 'machine'. Live testing produced exactly that: answered, dead
  // air, no connection.
  //
  // Connecting at pickup inverts the priority. The agent is on the line the
  // moment the prospect says hello, and AMD becomes an after-the-fact filter:
  // a 'machine' verdict still fires the existing machine branch, which
  // releases the agent, returns them to the queue, and holds the lead's leg
  // for the compliance window as before.
  //
  // The cost is real and accepted: standard AMD is less reliable once bridged,
  // so more voicemails will reach agents on predictive. Premium detection
  // would give both, and is deliberately NOT used here.
  //
  // Only fan-out lines reach this. user_dial is already bridged by
  // bridge_on_answer, and re-bridging a live call would drop the audio the
  // agent is using.
  // ── IS THIS THE DEFERRED AGENT LEG ANSWERING? ──────────────────────────
  // When dial_agent_on_answer is on there is no bridge_on_answer, so the two
  // legs are connected here, explicitly, the moment the agent's browser picks
  // up. Checked FIRST and by agent_call_control_id, because an agent leg has
  // no calls row of its own — the lookup below would find nothing and return.
  //
  // bridged_at is claimed inside bridgeAgentOntoLead with `.is(null)`, so a
  // duplicate or redelivered webhook cannot bridge twice.
  try {
    const { data: asAgentLeg } = await supabaseAdmin
      .from('calls')
      .select('id, call_control_id, bridged_at, answered_at')
      .eq('agent_call_control_id', callControlId)
      .maybeSingle()

    if (asAgentLeg?.call_control_id && !asAgentLeg.bridged_at) {
      const outcome = await bridgeAgentOntoLead(
        asAgentLeg.call_control_id,
        'deferred agent leg answered'
      )
      if (outcome === 'failed' || outcome === 'no-agent') {
        console.error(
          `[calls/events] deferred bridge ${outcome} for lead ` +
          `${asAgentLeg.call_control_id}; hanging up rather than leaving dead air`
        )
        await hangupCallControlId(asAgentLeg.call_control_id)
      }
      return
    }
  } catch (err) {
    console.error('[calls/events] deferred agent-leg bridge check failed:', err)
  }

  try {
    const { data: row } = await supabaseAdmin
      .from('calls')
      // campaign_id carries the seller identity for the TSR no-agent message.
      .select('id, dial_source, dial_group_id, agent_call_control_id, bridged_at, user_id, pool_number_id, campaign_id')
      .eq('call_control_id', callControlId)
      .maybeSingle()

    // ── A PREDICTIVE SURPLUS LINE ANSWERED WITH NOBODY BEHIND IT ──────────
    // THE case 16 CFR 310.4(b)(4)(iii) exists for, and the one that gates
    // multi-line predictive.
    //
    // Fan-out places one agent leg PER LINE, all INVITEing the same browser.
    // The browser can answer exactly one. When two lines answer, the second
    // line's agent leg is never picked up — Telnyx still bridges it via
    // link_to, so the prospect is joined to a leg that is merely ringing. That
    // is silence, and an abandoned call.
    //
    // Detected by asking whether the agent leg has an `answered` event of its
    // own. It is not a timer: if the browser had taken the leg, the event
    // exists by the time the LEAD's answer webhook is being processed, because
    // the agent leg has been ringing since before the lead's phone did.
    //
    // Measured today at a ceiling of one line this never fires — 137 of 137
    // answered fan-out legs had their agent leg answered. It exists so the
    // ceiling CAN be raised.
    if (row && row.dial_source === 'controller_fanout' && row.agent_call_control_id) {
      const { data: agentAnswered } = await supabaseAdmin
        .from('call_events')
        .select('id')
        .eq('call_control_id', row.agent_call_control_id)
        .eq('event_type', 'answered')
        .limit(1)

      if (!agentAnswered || agentAnswered.length === 0) {
        console.warn(
          `[calls/events] fan-out line ${callControlId} answered but its agent leg ` +
          `${row.agent_call_control_id} was never picked up — playing the TSR ` +
          `no-agent message rather than bridging into a ringing leg`
        )
        await speakTsrAbandonMessage(callControlId, row.campaign_id)
        await hangupCallControlId(callControlId).catch(() => {})
        return
      }
    }

    // ── THE LEAD JUST ANSWERED AND HAS NO AGENT LEG YET ────────────────────
    // Only possible with dial_agent_on_answer on, because every other path
    // dials both legs together. This is the moment the agent is summoned —
    // the prospect is on the line and the clock is running, which is why the
    // spoken line goes out first and the dial overlaps it.
    //
    // Guarded on dial_source so a fan-out line, whose agent leg is placed by a
    // different and still-unverified path, can never fall in here.
    if (row && !row.agent_call_control_id && row.dial_source === 'user_dial') {
      const { dial_agent_on_answer: deferred } = await getPlatformConfig()
      if (deferred) {
        await placeAgentLegForAnsweredLead(callControlId, {
          id: row.id,
          user_id: row.user_id as string | null,
          pool_number_id: row.pool_number_id as string | null,
        })
        return
      }
    }

    // ── CONNECT THE LEGS AT ANSWER, NOT AT THE VERDICT ──────────────────────
    // The dial already asks for this: bridge_on_answer is set whenever there
    // is an agent leg. This does not replace that — it makes sure of it.
    //
    // The requirement is that the agent hears the prospect the moment they
    // pick up, before AMD has decided human or machine, accepting a sliver of
    // voicemail as the price. Whether bridge_on_answer alone delivers that
    // while answering_machine_detection is running is not something Telnyx
    // documents either way, and the stored rows cannot tell "audio arrived
    // late" from "audio arrived on time" after the fact.
    //
    // So the bridge is also issued here, explicitly, at answer. Two properties
    // make that safe rather than reckless:
    //
    //   It runs at most once. bridgeAgentOntoLead claims the row with a
    //   conditional `.is('bridged_at', null)` update, so a duplicate webhook
    //   or a later verdict-path call finds nothing to do.
    //
    //   It cannot make things worse. If Telnyx already bridged at answer, the
    //   command is refused or is a no-op; the failure is swallowed and the
    //   call carries on. Unlike the fan-out path, a failure here never hangs
    //   up — the agent is already on this call.
    //
    // It also leaves evidence. bridged_at was null on every user_dial row
    // because nothing recorded it; from now on it is stamped at answer, so the
    // gap between answered_at and bridged_at is measurable instead of
    // argued about.
    if (row?.dial_source === 'user_dial' && row.agent_call_control_id && !row.bridged_at) {
      try {
        const outcome = await bridgeAgentOntoLead(callControlId, 'pickup (user_dial)')
        void logCallEvent({
          event_type: 'bridged',
          call_control_id: callControlId,
          source: 'webhook',
          status: outcome,
          detail: { dial_source: row.dial_source, call_row: row.id, at: 'answer' },
        })
        // The agent is on the call now, so this is the moment a recording is
        // supposed to begin. Awaited rather than fired and forgotten: the
        // first seconds of a conversation are the ones worth having.
        if (outcome === 'bridged' || outcome === 'already') {
          await startRecordingIfOwedAtBridge(callControlId, row.id)
        }
      } catch (err) {
        // Never let this take down a live call the agent is already talking on.
        console.error(`[calls/events] pickup bridge for ${callControlId} threw`, err)
      }
    }

    if (row?.dial_source === 'controller_fanout' && row.dial_group_id && !row.agent_call_control_id) {
      const { data: session } = await supabaseAdmin
        .from('agent_sessions')
        .select('id, user_id, state, current_call_id, last_heartbeat')
        .eq('id', row.dial_group_id)
        .maybeSingle()

      const beatFresh = session
        ? Date.now() - new Date(session.last_heartbeat).getTime() <= 15_000
        : false

      // ── EVERY WAY THIS CAN DECLINE, ON THE RECORD ─────────────────────────
      // This path had five guards and every one of them exited silently. A
      // prospect answered, no agent was ever attached, and nothing anywhere
      // said which condition refused — the calls row showed agent_leg false
      // and that was the entire story available.
      //
      // One row per fan-out answer. That is a handful an hour, and it is the
      // difference between knowing and guessing.
      await logCallEvent({
        event_type: 'fanout_placement_failed',
        call_control_id: callControlId,
        source: 'webhook',
        status: session && beatFresh ? 'pickup_bridge_attempt' : 'pickup_bridge_declined',
        detail: {
          reason: !session
            ? 'no agent_sessions row for this dial_group_id'
            : !beatFresh
              ? 'agent heartbeat older than 15s'
              : 'proceeding to claim',
          session_found: !!session,
          beat_fresh: beatFresh,
          session_state: session?.state ?? null,
          session_current_call: session?.current_call_id ?? null,
          this_call_row: row.id,
        },
      })

      // ── NOBODY IS COMING: SAY WHO CALLED ────────────────────────────
      // No agent session, or a heartbeat older than 15s, means this answered
      // line has no representative and will not get one. Until now it heard
      // silence and died, which is an abandoned call under 310.4(b)(1)(iv).
      //
      // 310.4(b)(4)(iii) turns that same call into a compliant one, and it is
      // the clause that lets predictive run above a single line at all.
      if (!session || !beatFresh) {
        await speakTsrAbandonMessage(callControlId, row.campaign_id)
        await hangupCallControlId(callControlId).catch(() => {})
      }

      if (session && beatFresh) {
        // Same atomic claim the verdict path uses: only one answered line can
        // take a given agent, so a second simultaneous pickup loses the race
        // and falls through to overflow routing on its own verdict.
        const claim = await supabaseAdmin
          .from('agent_sessions')
          .update({ current_call_id: row.id, state: 'on_call', updated_at: new Date().toISOString() })
          .eq('id', session.id)
          .or(`current_call_id.is.null,current_call_id.eq.${row.id}`)
          .select('id')
          .maybeSingle()

        if (!claim.data) {
          // Lost the claim — another answered line already took this agent, or
          // the session was pinned to a call that never cleared. Silent until
          // now, and indistinguishable from the bridge simply not running.
          await logCallEvent({
            event_type: 'fanout_placement_failed',
            call_control_id: callControlId,
            source: 'webhook',
            status: 'pickup_claim_lost',
            detail: {
              reason: 'agent already pinned to another call',
              session_current_call: session.current_call_id,
              this_call_row: row.id,
            },
          })

          // The classic predictive over-dial: two lines answered, one agent.
          // THIS is the call 310.4(b)(4)(iii) exists for — the person said
          // hello and there is genuinely nobody to hand them to.
          await speakTsrAbandonMessage(callControlId, row.campaign_id)
          await hangupCallControlId(callControlId).catch(() => {})
        }

        if (claim.data) {
          const dialed = await dialAndBridgeAgentForFanout(callControlId, session.user_id)
          if (!dialed) {
            // Could not reach the agent — give the session back rather than
            // pinning it to a call nobody is on.
            await supabaseAdmin
              .from('agent_sessions')
              .update({ current_call_id: null, state: 'ready' })
              .eq('id', session.id)

            // And the prospect is still on the line with nobody coming.
            await speakTsrAbandonMessage(callControlId, row.campaign_id)
            await hangupCallControlId(callControlId).catch(() => {})
          }
        }
      }
    }
  } catch (err) {
    console.error(`[calls/events] pickup bridge failed for ${callControlId}:`, err)
  }
}

// =============================================================================
// INBOUND CALLS — REJECTED AT THE DOOR, NEVER ANSWERED
// =============================================================================
// This used to ANSWER every inbound call and read a text-to-speech apology to
// it. That was courteous, and it was the charge: answering is the precise
// moment a call becomes billable.
//
// Measured 14 Sept, from the first call.cost webhook this platform ever
// captured. An inbound callback lasting 9.6 seconds came back billed as
// `billed_duration_secs: 60` — sip-trunking $0.0032/min plus call-control
// $0.0020/min — so a rounding rule turned nine seconds into a full minute
// and we paid $0.0052, plus TTS by the character, to say the words "this
// number does not accept incoming calls."
//
// Rejecting instead means the call is never connected: no minutes to round
// up, no TTS, nothing on the meter. CALL_REJECTED (Q.850 cause 21) is the
// deliberate choice over USER_BUSY (cause 17) — busy invites the caller's
// carrier to retry, and a retry is another call we would be paying to refuse.
//
// THE TRADE, STATED PLAINLY: a lead who rings one of our numbers back now
// gets an intercept tone instead of a sentence explaining why. That is the
// operator's call, made deliberately. Every alternative that says anything at
// all has to answer first, and answering is the thing that costs.
// =============================================================================

async function callControlAction(
  callControlId: string,
  action: string,
  body: Record<string, unknown> = {}
): Promise<boolean> {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    console.error(`[calls/events] missing TELNYX_API_KEY, cannot ${action} inbound call`)
    return false
  }
  const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`[calls/events] inbound ${action} failed for ${callControlId} (${res.status}): ${text}`)
    return false
  }
  return true
}

// ── REVERTED 14 Sept 2026, THE SAME EVENING IT SHIPPED ──────────────────────
// This issued `reject` with cause CALL_REJECTED instead of answering, to avoid
// paying the 60-second minimum plus TTS to tell a caller we do not take their
// call. It broke dialing within hours, and the browser console said so exactly:
//
//   CANCEL sip:...  Reason: Q.850;cause=21;text="CALL_REJECTED"
//
// cancelling an AGENT leg the browser had already accepted — a leg that had
// reached `Established` a moment earlier. CALL_REJECTED appears nowhere else in
// this codebase, so the call came from here.
//
// WHY THE ORIGINAL REASONING WAS WRONG. It was argued that an agent leg cannot
// carry direction 'incoming', because the previous code would then have read
// the inbound apology to agents and nobody ever reported hearing it. That does
// not follow. The old branch issued `answer`, which is inert on a leg the
// browser is already answering, so a misclassified agent leg passed through it
// invisibly. `reject` is not inert. The same misclassification that cost
// nothing for a year became fatal the moment the action changed.
//
// The lesson is narrower than "don't reject": an inference from the ABSENCE of
// a symptom is only as strong as the old code's ability to produce one. That
// path was silent, so it proved nothing.
//
// Answering costs roughly $0.0052 plus TTS per callback. Dialing is the
// business. Do not attempt this again without first proving, from a captured
// webhook payload, what `direction` an agent leg actually carries — and if it
// is ever rejected again, gate it on something positive (a client_state we set
// on our own legs) rather than on direction alone.
// ────────────────────────────────────────────────────────────────────────────

const INBOUND_MESSAGE =
  'Thank you for calling. This number does not accept incoming calls. ' +
  'Please call back the number that contacted you, or visit dialerseat dot com for support. Goodbye.'

/**
 * No agent could be attached to an answered predictive line. Say who called.
 *
 * 16 CFR 310.4(b)(4)(iii): whenever a representative is not available within
 * two seconds of the person's completed greeting, "promptly play a recorded
 * message that states the name and telephone number of the seller on whose
 * behalf the call was placed."
 *
 * THIS IS WHAT LETS PREDICTIVE RUN ABOVE ONE LINE. Without it every surplus
 * line that answers into silence is an ABANDONED call against the 3% ceiling,
 * which is why the line ceiling was 1 — and one line is progressive with extra
 * steps. With it, the call is compliant and is not counted.
 *
 * Returns true only if the message was actually queued. A campaign with no
 * seller name or callback number gets NOTHING spoken and is logged loudly:
 * lib/predictiveController.ts refuses to give such a campaign a second line in
 * the first place, so reaching here with an unbuildable message means the
 * config was cleared mid-run.
 */
async function speakTsrAbandonMessage(
  callControlId: string,
  campaignId: string | null | undefined
): Promise<boolean> {
  try {
    if (!campaignId) return false
    const { data: camp } = await supabaseAdmin
      .from('campaigns')
      .select('tsr_seller_name, tsr_callback_number')
      .eq('id', campaignId)
      .maybeSingle()

    const msg = buildTsrAbandonMessage({
      name: camp?.tsr_seller_name,
      callbackNumber: camp?.tsr_callback_number,
    })

    if (!msg.ok || !msg.text) {
      console.error(
        `[calls/events] TSR ABANDON MESSAGE NOT PLAYED for ${callControlId}: ${msg.reason}. ` +
        `This call is an abandoned call under 310.4(b)(1)(iv).`
      )
      void logCallEvent({
        event_type: 'tsr_abandon_message',
        call_control_id: callControlId,
        source: 'webhook',
        status: 'not_configured',
        detail: { campaign_id: campaignId ?? null, reason: msg.reason ?? null },
      })
      return false
    }

    // Queued first so it begins while anything else is still in flight. Telnyx
    // runs commands on a call in order, so the hangup below waits for speak.
    const spoke = await callControlAction(callControlId, 'speak', {
      payload: msg.text,
      voice: 'female',
    })

    void logCallEvent({
      event_type: 'tsr_abandon_message',
      call_control_id: callControlId,
      source: 'webhook',
      status: spoke ? 'played' : 'speak_failed',
      detail: { campaign_id: campaignId ?? null },
    })
    return spoke
  } catch (err) {
    console.error('[calls/events] TSR abandon message threw', callControlId, err)
    return false
  }
}

async function handleInboundCallInitiated(callControlId: string): Promise<void> {
  await callControlAction(callControlId, 'answer')
}

async function handleInboundCallAnswered(callControlId: string): Promise<void> {
  const spoke = await callControlAction(callControlId, 'speak', {
    payload: INBOUND_MESSAGE,
    voice: 'female',
  })
  // Queued behind the speak command — Telnyx runs commands on a call in order,
  // so the hangup executes once speak completes. If speak failed to even queue,
  // hang up anyway rather than leaving the caller in silence.
  await callControlAction(callControlId, 'hangup')
  if (!spoke) {
    console.warn(`[calls/events] inbound speak failed, hung up bare: ${callControlId}`)
  }
}

// ── WHAT COUNTS AS A ROBOT ─────────────────────────────────────────────────
// Module scope on purpose. Two handlers need this answer — the one that ends
// the call and the one that decides whether to keep its recording — and a
// second copy of the list is exactly how they drift apart. Adding a verdict
// here changes both at once.
//
// The premium vocabulary (human_residence / human_business / silence) is
// deliberately absent: those are all people.
const ROBOT_RESULTS = new Set(['machine', 'fax_detected'])

async function handleAmdResult(callControlId: string, result: string): Promise<void> {
  // ── EVERYTHING BEFORE THE HANGUP IS LATENCY THE LEAD HEARS ───────────────
  // Measured across 128 production machine detections: Telnyx took 3.31s to
  // reach a verdict, and this handler then took a further 1.71s to hang up —
  // a third of the total. That 1.71s was four serial round trips, none of
  // which the hangup decision depends on being finished first.
  //
  // So the verdict write is STARTED here and awaited after the call is
  // already ending. It must still be awaited — dropping it would lose the
  // amd_result that the recording-discard path and every AMD metric read —
  // but nothing needs it to complete before the line drops.
  const amdWrite = recordAmdResult(callControlId, result)
  void logCallEvent({
    event_type: 'amd_result',
    call_control_id: callControlId,
    status: result,
    source: 'webhook',
    detail: { result },
  })

  // ── WHAT ENDS A CALL ───────────────────────────────────────────────────
  // Only a robot: a voicemail system, or a fax tone. Everything else — a
  // person, a pause, silence, an uncertain verdict — stays connected.
  //
  // The dial path requests STANDARD AMD in 'detect' mode, which returns
  // 'human' | 'machine' | 'not_sure'. The premium vocabulary
  // (human_residence / human_business / silence) is still accepted below so
  // that calls placed while premium was briefly enabled, and any future switch
  // to it, are handled without another change here.
  //
  // The verdict no longer decides whether to CONNECT the call — it is already
  // connected, from the instant of pickup. It decides only whether to end one.
  // See the bridge comment in lib/placeOutboundCall.ts for why.

  if (ROBOT_RESULTS.has(result)) {
    // EVERY agent-attended call is bridged at pickup, so 'the agent is already
    // on it' is no longer the exception — it is the normal case, and hanging up
    // is now something we do TO a live call rather than instead of starting
    // one. Two guards below decide whether that is safe: how long the call has
    // been up, and the hangup_when_bridged setting.
    //
    // Fetched together, not one after the other. Both are required before the
    // hangup decision and neither depends on the other, so running them in
    // series simply added one round trip of voicemail to what the lead hears.
    //
    // amdWrite rides along as the third entry. It is not destructured because
    // nothing here reads its value — it is in the list so it is GUARANTEED
    // COMPLETE before any return below, at zero added latency since it runs
    // concurrently with two reads we were waiting on anyway. Leaving it
    // dangling would risk the serverless function being torn down at response
    // time with amd_result never written, and the recording-discard path plus
    // every AMD metric read that column.
    const [{ data: callRow }, platformConfig] = await Promise.all([
      supabaseAdmin
        .from('calls')
        .select('id, lead_id, dial_source, agent_call_control_id, answered_at, recording_status')
        .eq('call_control_id', callControlId)
        .maybeSingle(),
      getPlatformConfig(),
      amdWrite,
    ])

    const agentAlreadyBridged =
      callRow?.dial_source === 'user_dial' && !!callRow?.agent_call_control_id

    // Whether that protection applies is a setting, because it is a genuine
    // trade rather than a bug with a right answer: honouring the verdict skips
    // real voicemails, ignoring it protects real people. Default is to honour
    // it — skipping voicemail is the whole point — now that preview, the mode
    // where a wrong verdict hurts most, no longer runs AMD at all.
    const {
      amd_hangup_when_bridged: hangupWhenBridged,
      amd_max_seconds_after_answer: configuredWindow,
      amd_total_analysis_ms: analysisMs,
    } = platformConfig

    // ── THE WINDOW CANNOT BE SHORTER THAN THE ANALYSIS IT JUDGES ──────────
    // Telnyx will happily use the full total_analysis_time_millis before
    // reporting, and the webhook then has to reach us. A window narrower than
    // that discards verdicts for arriving "too late" when they arrived exactly
    // when they were supposed to.
    //
    // That precise contradiction has already broken this once — a 6s floor
    // against a 6000ms analysis cap silently suppressed every voicemail skip
    // in production. Deriving the minimum here means the two numbers cannot be
    // set against each other again, whatever anyone puts in the config.
    const maxSeconds = Math.max(configuredWindow, analysisMs / 1000 + 3)

    // ── IS THIS VERDICT STILL ABOUT THE LEAD? ─────────────────────────────
    // Every agent-attended call is bridged at pickup now, so by the time a
    // verdict lands there may be two people mid-sentence. The question is no
    // longer "do we trust the detector" but "is it still describing the person
    // who answered, or the conversation that started since?"
    //
    // Time answers that. A verdict one or two seconds after answer was formed
    // from the lead's own greeting and nothing else. One arriving eight seconds
    // in was formed from a live exchange, and acting on it means hanging up on
    // an agent mid-call.
    //
    // THIS REPLACES A MINIMUM-AGE FLOOR, WHICH WAS BACKWARDS AND BROKEN. It
    // required verdicts to be at least amd_min_seconds_before_hangup (6s) old
    // before being believed, while total_analysis_time_millis capped analysis
    // at 6000ms — so essentially every verdict arrived under the floor and was
    // discarded. That is why voicemails stopped being skipped: the skip was
    // suppressed on all of them. Production data, machine verdicts, seconds
    // after answer: 1.76, 2.01, 2.06, 2.07, 2.22, 2.36, 2.47, 2.52, 2.62, 2.70,
    // 3.03, 3.07, 3.95. Thirteen real voicemails, every one silently ignored.
    // The derivation above is what stops that recurring.
    //
    // The floor's original purpose — stopping 'greeting_end' from firing on a
    // human pause — is handled at the detector instead, which is now 'detect'.
    if (maxSeconds > 0 && callRow?.answered_at) {
      const secondsSinceAnswer =
        (Date.now() - new Date(callRow.answered_at).getTime()) / 1000
      if (secondsSinceAnswer > maxSeconds) {
        console.warn(
          `[calls/events] AMD said '${result}' ${secondsSinceAnswer.toFixed(1)}s ` +
          `after answer (window ${maxSeconds}s), too late to be about the greeting. ` +
          `A conversation is likely underway. Leaving the call up.`
        )
        return
      }
    }

    // ── AN ADVISORY VERDICT DECIDES A RECORDING, NEVER A CALL ─────────────
    // The campaign has AMD OFF. We asked for a verdict anyway, for one reason
    // only: to know whether a recording is worth starting, because recording
    // without a verdict meant recording answering machines.
    //
    // So this returns BEFORE every hangup path below it. A call on an AMD-off
    // campaign must end exactly as it does today: the agent hears the
    // voicemail, decides, and moves on. Nothing is skipped that was not
    // skipped before, and predictive's behaviour is untouched, since this is
    // the only branch that changed and it cannot reach a hangup.
    //
    // The recording decision itself is made by the bridge/verdict path via
    // recording_status: 'pending_amd_advisory' is claimed on a human verdict
    // and simply left to expire on a machine, so no recording ever starts.
    if (callRow?.recording_status === 'pending_amd_advisory') {
      console.log(
        `[calls/events] AMD '${result}' for ${callControlId} is ADVISORY ` +
        `(campaign has AMD off). Recording decision only, call left alone.`
      )
      // Nothing to start: this branch is only reached on a machine verdict,
      // and a machine is exactly what must never be recorded. The row is left
      // on 'pending_amd_advisory' and simply expires unclaimed. The human path
      // below is what starts an advisory recording.
      return
    }

    if (agentAlreadyBridged && !hangupWhenBridged) {
      console.warn(
        `[calls/events] AMD said '${result}' for ${callControlId}, but the agent ` +
        `is already bridged in, NOT hanging up. Leaving the call to the human.`
      )
      return
    }

    // ── SILENT INSTANT SKIP ────────────────────────────────────────────
    // Hang up now, write no disposition, move on. The lead row is bumped
    // (attempt count, last_called_at) so it cycles back into rotation
    // normally, but the agent is never asked to tag a call they never had.
    //
    // On an agent-attended call this is audible: a second or two of the
    // voicemail greeting, then the line drops and the next lead comes up. That
    // is the intended behaviour, and it is the trade that buys instant audio on
    // every call that turns out to be a person.
    //
    // NOTHING GOES ABOVE THIS LINE that the lead has to wait through. Every
    // await before the hangup is another fraction of a voicemail greeting
    // playing to an agent who has already been told to move on.
    //
    // An awaited record_stop used to sit right here. It was removed: hanging
    // up ends the recording anyway, and handleRecordingSaved deletes it on the
    // same verdict, so the extra Telnyx round trip bought nothing and cost the
    // one thing this path cannot spare.

    // ── RECORD WHAT HAPPENED, WITHOUT ASKING THE AGENT ───────────────────
    // This path wrote no disposition at all, on the reasoning that nobody
    // should be asked to tag a call they never had. That reasoning is about
    // the AGENT and it still holds — no sheet is shown, nothing is prompted.
    //
    // But it left 196 calls with a null disposition, and "reached a voicemail"
    // then read identically to "call never finished" everywhere downstream:
    // the analytics breakdown showed 88% No disposition, which describes our
    // record-keeping rather than the traffic.
    //
    // Reaching an answering machine IS the outcome, and a useful one — the
    // number is live and somebody may call back. It goes on the CALL only.
    // The LEAD keeps whatever it had, so it stays dialable and cycles back
    // into rotation exactly as before: a machine today says nothing about
    // whether a person answers tomorrow.
    //
    // Not awaited. Nothing above the hangup may cost the agent time, and this
    // is bookkeeping.
    void supabaseAdmin
      .from('calls')
      .update({ disposition: 'VOICEMAIL' })
      .eq('call_control_id', callControlId)
      .is('disposition', null)
      .then(({ error }) => {
        if (error) console.error('[calls/events] voicemail disposition failed', error)
      })

    // ── AND ON THE LEAD, SO THE VOICEMAIL QUEUE CAN FIND IT ──────────────
    // last_call_disposition, NOT disposition. The distinction is the whole
    // design: leads.disposition means somebody judged this lead and it takes
    // them out of rotation, which a machine must never do. This says only
    // "the last attempt reached a machine", which is what the voicemail
    // sub-campaign selects on and what makes the queue keep working rather
    // than freezing at whatever the backfill captured.
    if (callRow?.lead_id) {
      void supabaseAdmin
        .from('leads')
        .update({
          last_call_disposition: 'VOICEMAIL',
          last_call_at: new Date().toISOString(),
        })
        .eq('id', callRow.lead_id)
        .then(({ error }) => {
          if (error) console.error('[calls/events] lead voicemail stamp failed', error)
        })
    }

    // ── THE AGENT COMES OFF FIRST, ALWAYS ─────────────────────────────────
    // Releasing the agent is the only latency the agent can feel, and it is
    // correct in both branches below — whether the lead's leg ends now or
    // stays up to take a voicemail message, the agent is done with this call
    // either way. Doing it first means the voicemail-drop lookup underneath
    // costs them nothing.
    if (agentAlreadyBridged && callRow?.agent_call_control_id) {
      await hangupCallControlId(callRow.agent_call_control_id)
    }

    // ── AND GIVE THE AGENT BACK ─────────────────────────────────────────────
    // Dropping the agent's leg ends the audio; it does not end the ASSIGNMENT.
    // agent_sessions.current_call_id stayed pointing at the voicemail, with two
    // consequences that together look exactly like "predictive got stuck":
    //
    //   - the heartbeat reports that call as active_call, so the agent sits on
    //     the lead profile watching a machine for the whole compliance hold
    //   - the controller only fires while the agent is 'ready', and the next
    //     answered line cannot claim a session already pinned, so nothing
    //     starts again
    //
    // A machine verdict means the agent is free. The lead's leg carries on
    // behind them to clear the nine seconds — that part is untouched — but the
    // session is theirs again immediately.
    if (callRow?.id) {
      await supabaseAdmin
        .from('agent_sessions')
        .update({ current_call_id: null, state: 'ready', updated_at: new Date().toISOString() })
        .eq('current_call_id', callRow.id)
    }

    // ── VOICEMAIL DROP IS OFF. TESTED TWICE, FAILED TWICE. ────────────────
    // This branch kept the lead's leg up on a machine verdict so a message
    // could be played at the beep. It requires call.machine.greeting.ended,
    // which only detect_beep emits — and detect_beep killed detection on live
    // calls both with and without the tuned config block.
    //
    // With 'detect' restored there is no beep event, so keeping the leg up
    // here would leave every detected voicemail running with nobody on it and
    // no message played. The hangup is unconditional again.
    //
    // Detection wins over delivery. See AMD.md for what would need to be true
    // before this is attempted a third time.

    // ── THE 9-SECOND COMPLIANCE HOLD ──────────────────────────────────────
    // Telnyx counts a connected call of 6s or less as short duration and
    // surcharges above 15% of connected calls. A machine verdict lands at
    // ~3.8s, so nearly every voicemail falls under their line purely because
    // detection is fast.
    //
    // The agent is ALREADY GONE — released a few lines above — so this holds a
    // line nobody is on. No audio flows either way. From the agent's side
    // nothing about this exists.
    //
    // The ceiling is what matters: greetings run 15-25s and an answering
    // machine records after the beep, so overrunning it would leave a blank
    // voicemail on every lead. That is the most-reported robocall pattern
    // there is and would cost far more in carrier reputation than the
    // surcharge saves. Nine seconds is deep inside a greeting.
    //
    // 0 disables, and 0 is the default. Full rule in AMD.md.
    // ── ADVANCE THE QUEUE BEFORE HOLDING, NOT AFTER ───────────────────────
    // This ran after the hold, which meant the lead was only released back
    // into rotation once the hold expired — so the agent sat on a muted line
    // for the full nine seconds and the next lead came up only when it ended.
    //
    // Nothing about advancing depends on the lead's leg being down. The agent
    // was released at the verdict; the parked leg is billing housekeeping
    // running behind them.
    await autoAdvanceLeadNoDisposition(callControlId)

    // `?? 9`, not `?? 0` — the second of two fail-open paths that could switch
    // the compliance hold off without anything saying so. The shipped default
    // in lib/platformConfig.ts is the first; see the note there for why this
    // value has to fail toward holding rather than away from it. An explicit 0
    // in platform_config still disables the feature, because 0 is not nullish.
    const holdSeconds = platformConfig.amd_hold_seconds_after_machine ?? 9
    if (holdSeconds > 0) {
      // ── A MISSING TIMESTAMP MUST NOT DISABLE THE FEATURE ────────────────
      // This used to require callRow.answered_at and silently do nothing
      // without it. That is a real gap, not a theoretical one: call.answered
      // and the AMD verdict are separate webhooks about three seconds apart,
      // so there is a genuine window where the row has not been stamped yet
      // and the hold would skip with no trace.
      //
      // Re-read first — it may well have landed in the time this handler spent
      // on the guards above — and fall back to a measured estimate if not.
      let answeredAt: number | null = callRow?.answered_at
        ? new Date(callRow.answered_at).getTime()
        : null

      if (answeredAt === null) {
        const { data: fresh } = await supabaseAdmin
          .from('calls')
          .select('answered_at')
          .eq('call_control_id', callControlId)
          .maybeSingle()
        if (fresh?.answered_at) answeredAt = new Date(fresh.answered_at).getTime()
      }

      // Still nothing: assume the verdict arrived at the measured average of
      // ~4s after answer. Holding slightly too long is recoverable — it stays
      // far inside a 15-25s greeting. Not holding at all is the bug.
      const elapsedMs = answeredAt !== null
        ? Date.now() - answeredAt
        : 4000

      // Randomised between the floor and three seconds above it — see
      // lib/complianceHold.ts. A hold that always lands on exactly nine
      // seconds is a signature, and the point of holding at all is to stop
      // looking like a pattern.
      const remainingMs = remainingHoldMs(holdSeconds, elapsedMs)
      // Only ever extends a call that would otherwise be short. A call already
      // past the threshold is left alone — there is nothing to correct.
      if (remainingMs > 0) {
        console.log(
          `[calls/events] holding ${callControlId} a further ${Math.round(remainingMs)}ms ` +
          `(floor ${holdSeconds}s +0-${HOLD_SPREAD_SECONDS}s, elapsed ${Math.round(elapsedMs)}ms, ` +
          `answered_at ${answeredAt === null ? 'MISSING, estimated' : 'known'})`
        )
        await new Promise(resolve => setTimeout(resolve, remainingMs))
      } else {
        console.log(
          `[calls/events] no hold for ${callControlId}, already ${Math.round(elapsedMs)}ms ` +
          `past answer, over the ${holdSeconds}s target`
        )
      }
    }

    const leadHungUp = await hangupCallControlId(callControlId)

    // ── WHEN THE HANGUP DOES NOT TAKE ─────────────────────────────────────
    // Recorded as an event, not just a console line, because this failure was
    // invisible for its entire existence: 18 of 128 machine detections kept
    // running — 17.8s average, once 122s — and the only trace was a warning in
    // a runtime log. Writing it here makes the rate queryable alongside every
    // other call event, so "AMD worked and then it didn't" becomes a number
    // instead of a report.
    if (!leadHungUp) {
      console.error(
        `[calls/events] AMD said '${result}' for ${callControlId} but the hangup FAILED ` +
        `after retries. The lead leg is probably still up with a voicemail playing.`
      )
      void logCallEvent({
        event_type: 'hangup_failed',
        call_control_id: callControlId,
        status: result,
        source: 'webhook',
        detail: { after: 'amd_machine_verdict' },
      })
    }

    // The agent's leg was released, and the queue advanced, BEFORE the hold —
    // both are the parts the agent can feel, and neither depends on the lead's
    // leg being down. Everything after the verdict is housekeeping running
    // behind them.
    return
  }

  // Everything else continues as a live call: human_residence,
  // human_business, human, not_sure, and silence.
  //
  // 'silence' deliberately does NOT hang up. It means AMD heard nothing yet,
  // which is a person who hasn't spoken, a slow handset, or a moment of dead
  // air — none of which are a robot. Ending the call on silence is the exact
  // complaint this change exists to fix.
  // Same guarantee as the robot branch, same zero cost: the verdict write
  // finishes alongside a read this path was already waiting on. Nothing here
  // is latency-critical — a human verdict keeps the call up rather than ending
  // it — but the write must not be left dangling into teardown.
  const [{ data: callRow }] = await Promise.all([
    supabaseAdmin
      .from('calls')
      .select('id, dial_group_id, campaign_id, team_id, user_id, agent_call_control_id, dial_source, recording_status')
      .eq('call_control_id', callControlId)
      .maybeSingle(),
    amdWrite,
  ])

  if (!callRow) {
    console.warn(`[calls/events] no calls row for ${callControlId} on human AMD result`)
    return
  }

  // ── A HUMAN ANSWERED — NOW IT IS WORTH RECORDING ──────────────────────────
  // The dial deliberately did not carry `record` when AMD was enabled, so
  // nothing has been captured or billed up to this point. This is the moment a
  // recording becomes worth having, and a machine verdict never reaches here —
  // it returns further up — so a voicemail greeting is never recorded at all
  // rather than recorded and deleted afterwards.
  //
  // Deliberately NOT awaited before the bridge below: connecting the agent is
  // the latency-critical thing on this path and must not wait on a recording
  // command. Held as a promise and settled before returning instead, because a
  // dangling promise on a serverless runtime is frozen with the response.
  // 'pending_amd_advisory' joins 'pending_amd' here, and ONLY here. Both mean
  // "a recording is owed once a human is confirmed"; they differ only in what
  // the machine verdict does, which is end the call for one and nothing at all
  // for the other. This is the moment they agree on.
  //
  // Deliberately not started at the bridge. The bridge happens at pickup,
  // seconds BEFORE any verdict exists, so starting there would record every
  // voicemail exactly as the old 'pending_bridge' did.
  const recordingStart =
    callRow.recording_status === 'pending_amd' ||
    callRow.recording_status === 'pending_amd_advisory'
      ? startRecordingForCall(callControlId, callRow.id)
      : Promise.resolve()

  if (!callRow.dial_group_id) {
    // ── user_dial IS ALREADY BRIDGED. NOTHING HAPPENS HERE. ──────────────
    // A previous version of this comment claimed the opposite — that the dial
    // stops carrying bridge_on_answer once AMD is enabled, and that a human
    // verdict is therefore where the agent finally gets connected. That is no
    // longer true and the prose outlived the code by some margin.
    //
    // lib/placeOutboundCall.ts now sets bridge_on_answer unconditionally
    // whenever there is an agent leg — see the ALWAYS BRIDGE ON ANSWER block
    // there, which reversed the bridge-after-detection arrangement on measured
    // grounds: the bridge tracked the verdict to within ten milliseconds,
    // because it WAS the verdict, and every answered call bought detection
    // accuracy with one to six seconds of silence on both ends.
    //
    // Leaving that claim here was a live hazard, not untidiness. Anyone
    // debugging "no audio until the verdict" reads this block, believes the
    // bridge is gated on AMD, and goes to work on a mechanism that was removed
    // — while the real cause sits somewhere else entirely. The guard below
    // has been correct throughout; only the explanation above it was wrong.
    //
    // When AMD is OFF the dial still uses bridge_on_answer and no detection
    // webhook ever arrives, so this path simply never runs for those calls.
    // user_dial is already bridged — Telnyx did it at pickup, and calling
    // bridge again on a live call is at best a no-op and at worst drops the
    // audio the agent is currently using. Only fan-out lines, which were
    // placed with nobody attached, still need connecting here.
    if (callRow.agent_call_control_id && callRow.dial_source !== 'user_dial') {
      const outcome = await bridgeAgentOntoLead(callControlId, `AMD '${result}'`)
      if (outcome === 'failed') {
        // The agent leg is gone — they hung up, or it never came up. Do not
        // leave the prospect holding a line with nobody on it.
        console.error(
          `[calls/events] AMD said '${result}' but bridging the agent onto ` +
          `${callControlId} FAILED, hanging up rather than leaving the lead on a dead line.`
        )
        await hangupCallControlId(callControlId)
      }
    }
    await recordingStart
    return
  }

  // ── FAN-OUT: THIS IS WHERE THE AGENT ACTUALLY GETS CONNECTED ───────────
  // This block was headed "ALREADY CONNECTED AT PICKUP" and said the agent is
  // bridged when the prospect answers. That is true of an agent-attended dial,
  // which carries bridge_on_answer. It was never true here. A fan-out line is
  // placed with nobody attached — the comment on bridgeAgentOntoLead says so
  // in as many words — so on this path nothing had connected anybody, and
  // nothing below did either.
  //
  // What that cost: 14 Sept, 138 fan-out calls, 35 answered, 7 of them human,
  // ZERO bridged, by our bridged_at and by Telnyx's call.bridged webhook
  // alike, against 80 of 80 for agent-attended dials. Each of those people
  // answered their phone and heard silence for about nineteen seconds. An
  // operator reported it independently as "goes silent on pickup". It is also
  // why the agent legs leaked: the only teardown was gated on a bridge that
  // never happened.
  //
  // THE BRIDGE COMES BEFORE THE SIBLINGS DIE. Killing the other ringing lines
  // first and then failing to connect this one would throw away every chance
  // the session had. If the bridge fails, this lead is hung up rather than
  // left on an open line with nobody on it — the same thing the agent-attended
  // path does — and the siblings are left alone to keep trying.
  //
  // UNVERIFIED IN PRODUCTION. Predictive is withdrawn (see the heartbeat), so
  // no fan-out call can reach this code today. It must not be re-enabled until
  // a fan-out call has actually been observed reaching call.bridged.
  if (callRow.agent_call_control_id) {
    const outcome = await bridgeAgentOntoLead(callControlId, `fan-out AMD '${result}'`)
    if (outcome === 'failed' || outcome === 'no-agent') {
      console.error(
        `[calls/events] fan-out human on ${callControlId} could not be bridged ` +
        `(${outcome}), hanging up rather than leaving the lead on a dead line.`
      )
      await hangupCallControlId(callControlId)
      await recordingStart
      return
    }

    // A human is confirmed and connected, so every other line this session has
    // ringing ends here. Deliberately fired from the verdict rather than the
    // pickup, so a machine never kills the other lines on a false alarm.
    await abortSiblingFanoutLines({
      sessionId: callRow.dial_group_id,
      keepCallControlId: callControlId,
    })
    await recordingStart
    return
  }

  // ── CONTROLLER FANOUT — claim the originating agent, or overflow ──────
  const sessionId = callRow.dial_group_id
  const { data: session } = await supabaseAdmin
    .from('agent_sessions')
    // user_id is needed to resolve THIS agent's own SIP credential — the
    // whole point of claiming a specific session is to ring that specific
    // person, which requires addressing their own SIP endpoint rather than
    // a shared one that rings everybody.
    .select('id, user_id, state, current_call_id, last_heartbeat')
    .eq('id', sessionId)
    .maybeSingle()

  const heartbeatFresh = session
    ? Date.now() - new Date(session.last_heartbeat).getTime() <= 15_000
    : false

  const originatingAgentStillReady =
    !!session &&
    heartbeatFresh &&
    (session.state === 'ready' || session.current_call_id === callRow.id)

  if (originatingAgentStillReady) {
    // Claim it for the originating agent — same atomic guard pattern as
    // the overflow claim, just against a specific known session.
    const claim = await supabaseAdmin
      .from('agent_sessions')
      .update({ current_call_id: callRow.id, state: 'on_call', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .or(`current_call_id.is.null,current_call_id.eq.${callRow.id}`)
      .select('id')
      .maybeSingle()

    if (claim.data) {
      const dialed = await dialAndBridgeAgentForFanout(callControlId, session!.user_id)
      if (dialed) {
        // ── THE PICKUP THAT ENDS THE OTHER LINES ──────────────────────────
        // This agent now has a human. Every other line this session still has
        // RINGING is hung up here — see abortSiblingFanoutLines for why an
        // already-answered sibling is deliberately left to route itself.
        //
        // Awaited rather than fired and forgotten. The agent is already
        // bridged and talking, so nothing they can feel is waiting on it, and
        // on a serverless runtime un-awaited work can be torn down with the
        // response — which would leave the prospects' phones ringing for a
        // call that no longer exists.
        await abortSiblingFanoutLines({ sessionId, keepCallControlId: callControlId })
        await recordingStart
        return
      }
      // Failed to actually connect the agent leg — release the claim and
      // fall through to overflow handling below.
      await supabaseAdmin
        .from('agent_sessions')
        .update({ current_call_id: null, state: 'ready' })
        .eq('id', sessionId)
    }
  }

  // Originating agent isn't available (busy, stale heartbeat, or lost the
  // claim race) — this is excess overdial. Route via team overflow logic,
  // which drops the call for solo campaigns or bridges to the next ready
  // team agent for team-shared campaigns.
  const outcome = await handleOverflowAnsweredCall({
    leadCallControlId: callControlId,
    callRowId: callRow.id,
    campaignId: callRow.campaign_id,
    teamId: callRow.team_id,
    excludeSessionId: sessionId,
  })

  if (outcome === 'bridged') {
    // A second human answered and a DIFFERENT agent on the team took them —
    // "if two are picked up the next available user gets the pickup". That is
    // still a pickup, so the lines that are merely ringing end here too.
    await abortSiblingFanoutLines({ sessionId, keepCallControlId: callControlId })
    await recordingStart
    // Covers the AMD-off campaigns, whose recordings no longer start at dial
    // and have nothing else to trigger them. A no-op when the AMD path above
    // already claimed the row.
    await startRecordingIfOwedAtBridge(callControlId, callRow.id)
    return
  }

  if (outcome === 'dropped') {
    // Nobody took this call, so there is nothing worth recording. The command
    // may already be in flight; settle it and stop the recording rather than
    // leave a few seconds of an abandoned call on disk.
    await recordingStart
    await markCallAbandoned(callControlId)
    await supabaseAdmin
      .from('calls')
      .update({ disposition: 'ABANDONED' })
      .eq('call_control_id', callControlId)
    await bumpLeadAttemptAndRelease(callRow.id)
  }
}

/**
 * Start recording a call that AMD has just confirmed is a human, and record
 * that we did. Never called on a machine verdict — that path returns before
 * this one is reached — which is the whole point: a voicemail greeting is now
 * never captured rather than captured and deleted afterwards.
 *
 * Best-effort. A recording that fails to start must never take down a live
 * call the agent is already talking on.
 */
/**
 * Start a recording that was OWED but deliberately not started at dial.
 *
 * Nothing records from the dial any more (see the long note in
 * placeOutboundCall): 'record-from-answer' captured the whole ring, so a
 * thirty-second ring with two seconds of talk produced a thirty-three second
 * file that plays as dead air. Recording now begins when the agent is actually
 * on the call, and the status column says which calls are still waiting:
 *
 *   'pending_amd_advisory'  NOT handled here either. Recording is on and the
 *                     campaign has AMD off, so a verdict was requested purely
 *                     to decide whether recording is worth starting. Claimed
 *                     on the human verdict, never at the bridge, because the
 *                     bridge happens before any verdict exists.
 *   'manual'          the agent pressed record — same trigger.
 *   'pending_amd'     NOT handled here. That one waits for a human verdict,
 *                     which is the whole reason it is a different status.
 *
 * Idempotent by status: the update below moves the row off the waiting state,
 * so a duplicate bridge webhook cannot start a second recording.
 */
async function startRecordingIfOwedAtBridge(
  callControlId: string,
  callRowId: string
): Promise<void> {
  // The conditional UPDATE is the whole guard — no read-then-write, so two
  // bridge webhooks arriving together cannot both start a recording. It also
  // means callers do not need to have selected the status first.
  const { data: claimed } = await supabaseAdmin
    .from('calls')
    .update({ recording_status: 'starting' })
    .eq('id', callRowId)
    .in('recording_status', ['manual'])
    .select('id')

  if (!claimed || claimed.length === 0) return // another webhook got there first

  const ok = await startRecordingForCall(callControlId, callRowId)
  if (!ok) {
    // Put the row back rather than leaving it stranded on 'starting'. A
    // recording that was owed and never began should still say so — 'starting'
    // forever describes nothing and would hide the failure from every screen
    // that reads this column.
    await supabaseAdmin
      .from('calls')
      .update({ recording_status: 'failed' })
      .eq('id', callRowId)
      .eq('recording_status', 'starting')
  }
}

async function startRecordingForCall(
  callControlId: string,
  callRowId: string
): Promise<boolean> {
  const env = resolveTelnyxConfigOrLog('calls/events:record')
  if (!env) return false

  const started = await startTelnyxRecording(callControlId, env.apiKey)
  if (!started) {
    // Left as 'pending_amd' deliberately — it is an accurate description of
    // what happened (recording was owed and never began) and distinguishes
    // this from a call that was never meant to be recorded at all.
    void logCallEvent({
      event_type: 'recording_started',
      call_control_id: callControlId,
      status: 'failed',
      source: 'webhook',
    })
    return false
  }

  await supabaseAdmin
    .from('calls')
    .update({ recording_status: 'recording' })
    .eq('id', callRowId)

  void logCallEvent({
    event_type: 'recording_started',
    call_control_id: callControlId,
    status: 'amd_human',
    source: 'webhook',
  })
  return true
}

// ── WHAT TELNYX SAYS THE CALL COST ─────────────────────────────────────────
// They push this. We have been receiving call.cost webhooks -- 553 on 14 Sept
// alone -- and throwing the amount away: the default branch of the switch
// stores only payload.result, and a cost event has no result field, so every
// one was logged as "unhandled" with a null detail.
//
// Every cost figure on this platform is our rates times our usage, and today
// that inference failed badly enough to open a carrier ticket: $2.12 left the
// balance around a single eighteen-second call that models out at $0.0063.
// The number that would have settled it was arriving by webhook the whole
// time.
//
// Stored in two places on purpose. calls.telnyx_cost so any query that already
// joins a call can compare their figure to ours in the same row. And
// telnyx_ledger_records, which is append-only, so if they ever restate a cost
// for a call the original survives beside it. The Ledger app reads that table
// and will surface the disagreement without further work.
//
// Never throws. A bookkeeping row must not be able to fail a webhook that has
// a call to finish.
/**
 * `call.bridged` from Telnyx — the carrier saying two legs are now carrying
 * audio to each other.
 *
 * WHY THIS EXISTS. `bridged_at` was written in one place only: the `user_dial`
 * branch of handleCallAnswered, after we issue our own bridge command. That
 * made the column a record of OUR command rather than of the carrier's state,
 * and the difference was invisible until fan-out was measured:
 *
 *     dial_source          answered   bridged_at set   Telnyx call.bridged
 *     user_dial                 449              425                  805
 *     controller_fanout         137                0                  136
 *
 * Read from the calls table, fan-out looked like it answered 137 prospects and
 * connected none of them. Read from Telnyx, 136 of 137 bridged. The lead leg
 * carries link_to and bridge_on_answer whenever an agent leg exists (see
 * lib/placeOutboundCall.ts), and it does exist on fan-out — so Telnyx bridges
 * without being asked, and nothing was ever recording that it had.
 *
 * Stamped only when missing, so the user_dial path keeps the timestamp it
 * already sets at answer and a duplicate webhook is a no-op. No commands are
 * issued from here: this observes, it does not act.
 */
async function handleCallBridged(callControlId: string): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('calls')
      .update({ bridged_at: new Date().toISOString() })
      .eq('call_control_id', callControlId)
      .is('bridged_at', null)
      .select('id, dial_source')
      .maybeSingle()

    if (error) {
      console.warn('[calls/events] bridged stamp failed', callControlId, error)
      return
    }
    // No row means the agent leg's own call.bridged (it arrives on both legs),
    // an already-stamped user_dial call, or a leg we never recorded. None is
    // a fault, and none is worth a log line at volume.
    if (!data) return

    void logCallEvent({
      event_type: 'bridged',
      call_control_id: callControlId,
      source: 'webhook',
      status: 'carrier_confirmed',
      detail: { dial_source: data.dial_source, call_row: data.id, at: 'call.bridged' },
    })
  } catch (err) {
    // Telemetry must never be able to disturb a live call.
    console.warn('[calls/events] bridged handler threw', callControlId, err)
  }
}

async function handleCallCost(
  callControlId: string,
  payload: Record<string, unknown>
): Promise<void> {
  // The amount is read defensively rather than from one assumed field. A
  // missed key would silently record a real charge as zero, which is the exact
  // failure this handler exists to end.
  const raw =
    payload.total_cost ?? payload.cost ?? payload.amount ??
    (payload.cost as { amount?: unknown } | undefined)?.amount
  const amount = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  const currency = typeof payload.currency === 'string' ? payload.currency : 'USD'

  void logCallEvent({
    event_type: 'cost',
    call_control_id: callControlId,
    status: Number.isFinite(amount) ? String(amount) : 'unparsed',
    source: 'webhook',
    // The whole payload, not only the field we understood today. A charge
    // nobody expected will be described in a field nobody extracted.
    detail: payload,
  })

  if (!Number.isFinite(amount)) {
    console.warn('[calls/events] call.cost had no readable amount', callControlId, payload)
    return
  }

  try {
    await supabaseAdmin
      .from('calls')
      .update({
        telnyx_cost: amount,
        telnyx_cost_currency: currency,
        telnyx_cost_at: new Date().toISOString(),
      })
      .eq('call_control_id', callControlId)

    // ── LEARN WHAT THIS DESTINATION COSTS ────────────────────────────────
    // Every cost_part carries the rate its seconds were billed at, and they
    // are not all the same: 71.5% of spend came in at $0.002, 23.7% at
    // $0.005, and 4.1% at $0.07 — rural high-cost termination, passed through
    // legitimately. Two exchanges produced that last slice across five calls.
    //
    // Recorded per exchange so the NEXT dial to one of them can be refused.
    // It can never protect the call being measured, which is the honest limit
    // of learning rates from traffic rather than from a rate deck.
    const { data: costRow } = await supabaseAdmin
      .from('calls')
      .select('phone_number, user_id')
      .eq('call_control_id', callControlId)
      .maybeSingle()

    // ── THE SMOKE ALARM ────────────────────────────────────────
    // Checked HERE because this is the moment the carrier's own figure arrives.
    // Every runaway this platform has had was invisible until somebody happened
    // to look at a balance: $8.17/agent-hour for weeks, 4,341 dials in ten hours,
    // 41 failed dials in an hour. Fire and forget; it cannot delay or fail this
    // handler, and it stops nothing. See lib/dailySpendAlarm.ts.
    checkDailySpend(costRow?.user_id)

    const phone = costRow?.phone_number
    if (phone) {
      const parts = Array.isArray(payload.cost_parts) ? payload.cost_parts : []
      for (const raw of parts) {
        const part = raw as { rate?: unknown; cost?: unknown }
        const rate = Number(part.rate)
        if (Number.isFinite(rate) && rate > 0) {
          await recordDestinationRate(phone, rate, Number(part.cost) || 0)
        }
      }
    }
  } catch (err) {
    console.error('[calls/events] could not store telnyx_cost', callControlId, err)
  }

  // And into the append-only ledger, so a later restatement cannot overwrite
  // what they said the first time.
  try {
    const stable = JSON.stringify(payload, Object.keys(payload).sort())
    const { createHash } = await import('crypto')
    await supabaseAdmin.from('telnyx_ledger_records').insert({
      record_type: 'call.cost',
      telnyx_id: callControlId,
      occurred_at: new Date().toISOString(),
      cost: amount,
      currency,
      payload,
      payload_hash: createHash('sha256').update(stable).digest('hex').slice(0, 32),
      capture_window: 'webhook',
    })
  } catch {
    // A duplicate is the unique index doing its job on a redelivered webhook.
  }
}

async function handleHangup(
  callControlId: string,
  hangupCause?: string,
  hangupSource?: string
): Promise<void> {
  // ── SAMPLE THE BALANCE WHILE MONEY IS MOVING ──────────────────────────
  // Telnyx hides transaction detail until the following month, so until then
  // these readings are the only contemporaneous record of what was charged.
  // Sampling happened only when somebody opened the balance panel, which left
  // gaps averaging 587 seconds — far too coarse to say which calls a charge
  // belonged to. On 14 Sept two debits of $2.03 and $2.12 landed in a window
  // whose entire billable activity modelled out at seven cents, and the best
  // that could be said was "somewhere in the last ten minutes".
  //
  // Hangup is the one event that fires whenever money actually moves.
  // Throttled to once every 45 seconds, never awaited, and it cannot throw.
  // A phone call must never wait on bookkeeping.
  sampleBalanceAfterCall('hangup')

  void logCallEvent({
    event_type: 'completed',
    call_control_id: callControlId,
    status: hangupCause,
    source: 'webhook',
    detail: { hangup_cause: hangupCause, hangup_source: hangupSource },
  })

  // ── THE SAME FACT, WHERE IT CAN BE QUERIED ────────────────────────────
  // call_events.detail keeps the full payload and always has. Reading it
  // means a full scan with JSON extraction on every row, which is fine for
  // one call and impossible for "which numbers are dead" once this table is
  // measured in millions. The two fields worth asking questions about are
  // projected onto the call itself, where they are indexed.
  //
  //   not_found          the number does not exist; never dial it again
  //   originator_cancel  we hung up mid-ring, which is what Telnyx counts
  //                      as an abandoned call against their 20% threshold
  //
  // Written below the event log rather than instead of it: the event is the
  // record, this is the index.

  // Mark the call as actually over. `duration` is the column that
  // distinguishes "still in flight" from "finished" elsewhere in this codebase
  // (dialerPacing.ts's abandon-rate math treats duration=0 as in-flight), so it
  // is measured from created_at -> now and is deliberately WALL CLOCK.
  //
  // `talk_seconds` is the different number: answer -> hangup. Keep both, and
  // keep them separate. Conflating them hid a serious problem for weeks —
  // ring averages ~10s on our traffic, so a call showing "18s" in our own
  // dashboards was frequently 10s of ringing and 8s of conversation, while
  // Telnyx, which bills from answer, was counting that same call as short
  // duration. Two thirds of our answered calls were under their 6s threshold
  // and nothing we displayed could show it.
  try {
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('id, created_at, duration, disposition, answered_at, talk_seconds, lead_id, dial_group_id, dial_source, call_control_id, agent_call_control_id, pool_number_id')
      .eq('call_control_id', callControlId)
      .maybeSingle()

    // ── AGENT LEG REFUSED BY TELNYX ──────────────────────────────────────
    // No calls row means this call_control_id is an AGENT leg (we only ever
    // insert rows for lead legs). An agent leg ending in 'user_busy' means
    // Telnyx declined to route to the agent's SIP URI — almost always
    // sip_uri_calling_preference being "disabled" on the credential
    // connection.
    //
    // This is worth shouting about because it is otherwise undetectable: the
    // dial request returns 200 with a call_control_id, so nothing upstream
    // sees a failure, the browser never receives an INVITE, and the only
    // visible symptom is a connected call with no audio. Naming it here
    // turns a multi-round debugging exercise into one log line.
    if (!callRow && hangupCause === 'user_busy') {
      console.error(
        `[calls/events] AGENT LEG REFUSED, Telnyx hung up agent leg ${callControlId} with ` +
        `'user_busy' (SIP 486) without delivering an INVITE to the browser. This call has NO ` +
        `AGENT AUDIO. Cause is almost always SIP URI calling disabled on the agent credential ` +
        `connection, see ensureAgentConnectionIsDialable in lib/agentSipCredentials.ts, which ` +
        `sets it automatically, or set "Receive SIP URI calls" to "Only from my Connections" in ` +
        `Telnyx Mission Control.`
      )
    }

    // ── THE AGENT NEVER ARRIVED, SO DO NOT LEAVE THE LEAD HOLDING ─────────
    // Only reachable with dial_agent_on_answer on. The lead answered, the
    // agent's leg was dialled, and it ended without ever bridging — the
    // browser did not pick up inside its 12-second timeout, or the socket was
    // dead. Without this the prospect sits on an open line listening to
    // nothing until they hang up, which is both the worst version of this
    // feature and an abandoned call on the carrier's books.
    //
    // No calls row for this id means it is an agent leg; the lead is found by
    // agent_call_control_id. Restricted to UNBRIDGED calls: if the two were
    // connected and the agent simply hung up, the existing machine-verdict and
    // compliance-hold paths own what happens next and must not be second-
    // guessed here.
    if (!callRow) {
      try {
        const { data: strandedLead } = await supabaseAdmin
          .from('calls')
          .select('call_control_id, bridged_at, answered_at, duration')
          .eq('agent_call_control_id', callControlId)
          .is('bridged_at', null)
          .maybeSingle()

        if (strandedLead?.call_control_id
            && strandedLead.answered_at
            && !strandedLead.duration) {
          console.error(
            `[calls/events] deferred agent leg ${callControlId} ended without bridging; ` +
            `hanging up lead ${strandedLead.call_control_id} rather than leaving them on a dead line`
          )
          await hangupCallControlId(strandedLead.call_control_id)
        }
      } catch (err) {
        console.error('[calls/events] stranded-lead check failed:', err)
      }
    }

    // ── THE AGENT LEG GOES WHEN ITS CALL DOES ────────────────────────────
    // The lead leg has ended. Whatever the agent leg was doing, there is no
    // longer anybody on the other end of it, and an agent leg left open bills
    // by the minute for silence.
    //
    // Until now the ONLY release was in the machine-verdict path, gated on
    // `agentAlreadyBridged` — which is defined as dial_source === 'user_dial'
    // and can therefore never be true for a fan-out call. So every fan-out
    // agent leg leaked, and leaked for as long as the agent stayed online.
    //
    // Measured 14 Sept, from Telnyx's own cost records: 115 fan-out agent legs
    // averaging 314 billed seconds and reaching 1,338 — twenty-two minutes of
    // a leg nobody ever spoke on. Telnyx bills both halves of each, so it lands
    // twice. Against 30.7 minutes of actual lead conversation that day, 1,307
    // minutes were billed. This is where the money went, and it dwarfed AMD,
    // recordings and dial volume combined.
    //
    // user_dial is not innocent either — 12 legs, one of them also parked for
    // 1,302 seconds — so this is deliberately NOT restricted to fan-out. Any
    // call that ends releases its agent leg.
    //
    // Safe to do unconditionally: every one of the 1,905 agent legs on record
    // belongs to exactly one call, so this can never drop a leg another live
    // call is using. hangupCallControlId treats 404 and 422 as success, so a
    // leg Telnyx already tore down is a no-op, as is a duplicate webhook.
    //
    // Awaited rather than fired and forgotten, because a dangling promise on
    // this runtime is frozen when the response returns — which is exactly how
    // a teardown silently never happens.
    if (callRow?.agent_call_control_id) {
      try {
        await hangupCallControlId(callRow.agent_call_control_id)
      } catch (err) {
        console.warn('[calls/events] agent leg release failed', callControlId, err)
      }
    }

    if (callRow) {
      const updates: Record<string, unknown> = {}

      // The carrier's own verdict, projected onto the call. Written on every
      // hangup including a duplicate webhook: unlike duration and talk_seconds
      // below, this is a fact about the call rather than a clock reading, so
      // rewriting it with the same value costs nothing and a late webhook
      // carrying a cause we missed is worth taking.
      if (hangupCause) updates.hangup_cause = hangupCause
      if (hangupSource) updates.hangup_source = hangupSource

      // Only set duration once — a call already marked over shouldn't have
      // its duration recomputed if a duplicate/late hangup webhook arrives.
      if (!callRow.duration || callRow.duration === 0) {
        const startedMs = new Date(callRow.created_at).getTime()
        const elapsedSeconds = Number.isFinite(startedMs)
          ? Math.max(1, Math.round((Date.now() - startedMs) / 1000))
          : 1 // never write 0 here — 0 is the "still in flight" sentinel elsewhere
        updates.duration = elapsedSeconds
      }

      // ── ACTUAL CONVERSATION TIME ────────────────────────────────────────
      // Only for calls that were genuinely answered. An unanswered call has no
      // talk time, and writing 0 would drag every average down and make a
      // ring-out indistinguishable from an instant hangup — the exact
      // ambiguity that let a 66% short-call rate hide behind a healthy-looking
      // duration. NULL stays NULL.
      //
      // Written once, like duration, so a retried hangup webhook can't
      // recompute it against a later clock.
      if (callRow.answered_at && callRow.talk_seconds == null) {
        const answeredMs = new Date(callRow.answered_at).getTime()
        if (Number.isFinite(answeredMs)) {
          updates.talk_seconds = Math.max(0, Math.round((Date.now() - answeredMs) / 1000))
        }
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('calls').update(updates).eq('id', callRow.id)
      }

      await supabaseAdmin
        .from('agent_sessions')
        .update({ current_call_id: null })
        .eq('current_call_id', callRow.id)

      // ── OUR FAILURE IS NOT THE LEAD'S FAULT ─────────────────────────────
      // When the agent's browser loses its SIP socket, Telnyx gives up on the
      // orphaned agent leg at about 1.2 seconds and the lead leg dies with it
      // ~0.4s later. The lead's phone never rang. Recording that as NO_ANSWER
      // spends a dial attempt on someone who was never called, and pushes a
      // 0-second call into the short-call ratio Telnyx judges us on.
      //
      // Measured before this existed: 1,270 calls over thirty days, 754
      // distinct leads, 67% of every dial on the platform.
      //
      // Detected on the LEAD leg only, and only when it was never answered.
      // The agent leg's own hangup arrives first (consistently ~0.4s earlier),
      // so by the time this runs the evidence is already on file.
      if (
        callControlId === callRow.call_control_id &&
        !callRow.answered_at &&
        callRow.agent_call_control_id
      ) {
        const { data: agentEnd } = await supabaseAdmin
          .from('call_events')
          .select('detail')
          .eq('call_control_id', callRow.agent_call_control_id)
          .eq('event_type', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // 'callee' on the agent leg IS the agent's browser. Telnyx reporting
        // that the callee hung up an unanswered agent leg means the browser
        // never took it, which is the signature of a dead socket.
        if ((agentEnd?.detail as { hangup_source?: string } | null)?.hangup_source === 'callee') {
          void logCallEvent({
            event_type: 'agent_leg_failed',
            call_control_id: callControlId,
            status: 'lead_not_spent',
            source: 'webhook',
            detail: { reason: 'agent browser did not answer its leg; lead never rang' },
          })

          await supabaseAdmin
            .from('calls')
            .update({ disposition: 'AGENT_LEG_FAILED' })
            .eq('id', callRow.id)

          // Same reasoning, applied to the caller ID rather than the lead:
          // claim_pool_number spent a slot off this number's daily cap at dial
          // time, and the phone it was dialing never rang. The cap exists to
          // stop a number being worn out by CALLS. 1,270 of these over thirty
          // days benched numbers for calls that did not happen.
          await refundUsage(callRow.pool_number_id)

          // Released WITHOUT bumping dial_attempts. This lead has not been
          // called, so it must not move closer to being set aside.
          if (callRow.lead_id) {
            await supabaseAdmin
              .from('leads')
              .update({
                status: 'new',
                claimed_at: null,
                claimed_by_session_id: null,
              })
              .eq('id', callRow.lead_id)
          }
        }
      }

      // ── IF WE DIALED IT, STAMP IT. THE QUEUE ROTATES ON THIS COLUMN. ─────
      // The lead queue panel sorts by last_called_at ascending, NULLS FIRST.
      // That is what makes a dialed lead sink and the next one come up. So a
      // lead we called that still has last_called_at NULL is pinned to the top
      // of the queue and gets dialed again the moment the panel advances.
      //
      // Every disposition path writes this column. The gap is the calls that
      // reach NO disposition path at all: the branch above catches an
      // unanswered leg whose AGENT leg was hung up by the browser
      // (hangup_source 'callee'), and there was nothing after it. An
      // unanswered leg that fails any part of that test — no agent leg
      // recorded, the agent's 'completed' event not written yet, a
      // hangup_source that is not 'callee' — fell straight through and the
      // lead was never touched.
      //
      // Caught live, 15 Sept 13:01 UTC, mid dialing day. Lead
      // ef96cbaa was dialed three times in 32 seconds — 13:01:21, 13:01:33,
      // 13:01:53 — every call dead at 1-2s with normal_clearing and never
      // answered, and after all three the lead still read status 'uncalled',
      // dial_attempts 0, last_called_at NULL. The four leads dialed either
      // side of it were all stamped within 2-4 seconds and rotated normally.
      //
      // ── WHY THIS STAMPS last_called_at AND NOT dial_attempts ───────────
      // They answer two different questions and only one of them is about
      // rotation:
      //
      //   last_called_at   WHEN did we last dial this lead -> queue position.
      //                    True the moment a call is placed, whether or not
      //                    the phone ever rang.
      //   dial_attempts    HOW MANY real attempts has this lead had -> when to
      //                    set it aside for good. NOT true when the lead's
      //                    phone never rang, which is exactly why the branch
      //                    above releases the lead without bumping it.
      //
      // Conflating them is what makes this look like a hard choice. It is not:
      // the lead sinks in the queue and comes back around later, without
      // moving closer to being retired on an attempt that never reached them.
      //
      // Deliberately does NOT touch status, disposition, or the claim. In
      // preview/power/progressive the agent may be mid-wrap-up on this lead,
      // and the note on the fan-out release below is the standing reason not
      // to pull state out from under them. Position is the only thing changed
      // here, and it is the only thing that was broken.
      if (
        callControlId === callRow.call_control_id &&
        callRow.lead_id &&
        !callRow.answered_at
      ) {
        const { error: stampErr } = await supabaseAdmin
          .from('leads')
          .update({ last_called_at: new Date().toISOString() })
          .eq('id', callRow.lead_id)
          // Only when it is genuinely unset. A disposition that already ran
          // holds a stamp from a few seconds ago and re-stamping it would
          // shuffle a lead the agent is actively working.
          .is('last_called_at', null)
        if (stampErr) {
          console.error('[calls/events] queue-rotation stamp failed', stampErr)
        }
      }

      // ── A FINISHED FAN-OUT LINE MUST GIVE ITS LEAD BACK ──────────────────
      // This is why predictive dialed once and then sat at "2/2 lines" forever.
      //
      // The controller paces off live CLAIMS as well as call rows, precisely so
      // that a dial which reaches the carrier without writing a row still counts
      // against the line limit. But nothing released a claim when the call
      // ENDED, and the heartbeat re-stamps claimed_at on every lead this session
      // holds every five seconds — so the 30-second stale sweep could never
      // reach them either. Two calls' worth of claims were therefore renewed
      // indefinitely, inFlight stayed pinned at the line count, shouldDial
      // stayed 0, and the engine reported itself permanently at target.
      //
      // Deliberately scoped to fan-out calls only. In preview/power/progressive
      // the agent is still looking at that lead to disposition it, and dropping
      // the claim out from under them would let a teammate dial someone they are
      // mid-wrap-up on. Those modes are tuned; this touches none of them.
      if (callRow.dial_source === 'controller_fanout' && callRow.lead_id) {
        const { error: relErr } = await supabaseAdmin
          .from('leads')
          .update({ claimed_at: null, claimed_by_session_id: null })
          .eq('id', callRow.lead_id)
        if (relErr) {
          console.error('[calls/events] fan-out claim release failed', relErr)
        }
      }
    }
  } catch (err) {
    console.error('[calls/events] hangup cleanup failed:', err)
  }
}

// =============================================================================
// RECORDING SAVED
// =============================================================================
// SIMPLER THAN THE OLD SIGNALWIRE VERSION: that version needed two match
// paths — a direct CallSid match, and a fallback through call_rooms for
// conference recordings (since a conference's recording is keyed by
// ConferenceSid/FriendlyName, not any one leg's CallSid). Under the
// direct-bridge design there IS no conference — every recording is a
// direct call recording (record: true was set on the lead leg's Dial),
// so call_control_id always matches the exact calls row directly. The
// call_rooms fallback path is gone along with call_rooms itself.
//
// WHAT WE ACTUALLY STORE, AND WHY IT CHANGED: recording_urls.mp3 is a
// presigned S3 link carrying X-Amz-Expires=600. It is valid for TEN MINUTES.
// The first version of this handler stored it as though it were permanent,
// which is why every recording in the app played as 0:00 / 0:00 — by the time
// anyone opened the Recordings tab the link was long dead.
//
// recording_id is the stable identifier. Playback mints a fresh download URL
// from it on every request (lib/telnyxRecording.ts). The URL is still written
// here — it's a useful record that a recording exists, and it IS playable in
// the first few minutes — but nothing depends on it.
// =============================================================================
async function handleRecordingSaved(
  callControlId: string,
  recordingUrls?: { mp3?: string; wav?: string },
  recordingId?: string,
  startedAt?: string,
  endedAt?: string
): Promise<void> {
  void logCallEvent({
    event_type: 'recording_ready',
    call_control_id: callControlId,
    source: 'webhook',
  })

  const recordingUrl = recordingUrls?.mp3 || recordingUrls?.wav
  // Either identifier is enough to keep the row: the id is what plays, and a
  // URL with no id can still be recovered later via the call_control_id
  // lookup in lib/telnyxRecording.ts.
  if (!recordingUrl && !recordingId) {
    console.warn(`[calls/events] call.recording.saved for ${callControlId} had no url and no id`)
    return
  }
  // Telnyx sends the recording's own start/end, not a duration. Derive it.
  let recordingSeconds: number | null = null
  if (startedAt && endedAt) {
    const ms = Date.parse(endedAt) - Date.parse(startedAt)
    if (Number.isFinite(ms) && ms > 0) recordingSeconds = Math.round(ms / 1000)
  }

  if (!recordingId) {
    console.warn(
      `[calls/events] call.recording.saved for ${callControlId} had no recording_id, ` +
      `playback will have to look it up by call_control_id on first play`
    )
  }

  // ── ENFORCE THE CAMPAIGN'S RECORDING TOGGLE ──────────────────────────────
  // lib/placeOutboundCall.ts only sends the `record` parameter when the
  // campaign has recording on, so in the normal case a disabled campaign
  // never produces a recording at all and this webhook never fires for it.
  //
  // But the per-call parameter is not the only thing that can start a
  // recording: Telnyx can also be configured to record ALL outbound calls at
  // the account level (Outbound Voice Profile / number settings). That
  // setting overrides nothing and asks no permission — it simply records,
  // and the campaign toggle silently becomes a lie.
  //
  // Receiving this event for a campaign with recording turned off is
  // therefore proof that something outside this app started it. Refuse to
  // store it, and delete it from Telnyx so it doesn't sit there costing
  // money and holding audio the user explicitly said not to keep. The
  // account-level setting still needs turning off at the source — this
  // cannot stop the recording from being MADE — so say so loudly.
  const { data: ownerRow } = await supabaseAdmin
    .from('calls')
    .select('id, campaign_id, recording_status, amd_result')
    .eq('call_control_id', callControlId)
    .maybeSingle()

  // An agent who hit the record toggle mid-call asked for this explicitly, so
  // the campaign default does not apply and the recording must be kept. Set
  // by /api/calls/record. Without this exception the enforcement below would
  // delete the recording moments after the agent deliberately started it —
  // the toggle would appear to work and then quietly destroy its own output.
  const manuallyRequested = ownerRow?.recording_status === 'manual'

  // ── NEVER KEEP A RECORDING OF A VOICEMAIL GREETING ───────────────────────
  // Recording starts at answer; the machine verdict lands ~6s later. Those six
  // seconds are an answering machine's outgoing message — no agent was ever on
  // the call, nobody will play it back, and it is the single largest source of
  // junk in the recordings list.
  //
  // Keeping them is not free. Telnyx bills recording per minute and charges
  // storage, so every voicemail we hit was being paid for twice: once as a
  // short call, once as a recording of nothing. On traffic that is 44% machine
  // detections, that is most of what we were storing.
  //
  // The manual exception still wins — an agent who hit record deliberately
  // asked for this audio, and a late AMD verdict must not delete what they
  // explicitly started.
  if (!manuallyRequested && ownerRow?.amd_result && ROBOT_RESULTS.has(ownerRow.amd_result)) {
    console.log(
      `[calls/events] discarding recording for ${callControlId}, AMD verdict ` +
      `'${ownerRow.amd_result}'. This is an answering machine greeting, not a conversation.`
    )
    await deleteTelnyxRecordingForCall(callControlId)
    return
  }

  if (ownerRow?.campaign_id && !manuallyRequested) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('recording_enabled')
      .eq('id', ownerRow.campaign_id)
      .maybeSingle()

    if (campaign && campaign.recording_enabled === false) {
      console.error(
        `[calls/events] REFUSING a recording for campaign ${ownerRow.campaign_id}, which has ` +
        `recording DISABLED. This app never asked for it, so it was started by Telnyx account-level ` +
        `recording (Mission Control -> Outbound Voice Profiles / number settings -> call recording). ` +
        `Turn that off, until then every call is being recorded and billed regardless of the ` +
        `campaign toggle. Deleting this recording and not storing it.`
      )
      await deleteTelnyxRecordingForCall(callControlId)
      return
    }
  }

  const { data, error } = await supabaseAdmin
    .from('calls')
    .update({
      recording_status: 'completed',
      recording_url: recordingUrl ?? null,
      recording_id: recordingId ?? null,
      // The recordings list shows a duration next to each row. Without this
      // it fell back to the call's own duration, which counts ring time the
      // recording doesn't contain.
      ...(recordingSeconds !== null ? { recording_duration: recordingSeconds } : {}),
    })
    .eq('call_control_id', callControlId)
    .select('id')

  if (error) {
    console.error(`[calls/events] recording update failed for ${callControlId}:`, error)
    return
  }
  if (!data || data.length === 0) {
    console.warn(`[calls/events] recording.saved did not match any calls row: ${callControlId}`)
  }
}

/**
 * Delete every recording Telnyx holds for a call, by call_leg_id.
 *
 * Used only to enforce a campaign's recording-off setting against a
 * recording this app never requested. Best-effort: a failure here leaves
 * audio on Telnyx's side that the user asked not to keep, so it is logged
 * loudly rather than swallowed, but it must not break webhook handling.
 */
async function deleteTelnyxRecordingForCall(callControlId: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) return

  try {
    // Telnyx's recordings list filters by call_leg_id / call_session_id, not
    // call_control_id, so find the recording records first rather than
    // guessing an id.
    const res = await fetch(
      `https://api.telnyx.com/v2/recordings?filter[call_control_id]=${encodeURIComponent(callControlId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!res.ok) {
      console.error(
        `[calls/events] could not list recordings to delete for ${callControlId}: HTTP ${res.status}`
      )
      return
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> }
    const recordings = Array.isArray(body?.data) ? body.data : []

    for (const rec of recordings) {
      if (!rec.id) continue
      const del = await fetch(`https://api.telnyx.com/v2/recordings/${rec.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!del.ok) {
        console.error(`[calls/events] failed to delete unwanted recording ${rec.id}: HTTP ${del.status}`)
      } else {
        console.log(`[calls/events] deleted unwanted recording ${rec.id} for ${callControlId}`)
      }
    }
  } catch (err) {
    console.error(`[calls/events] deleting unwanted recording for ${callControlId} threw:`, err)
  }
}

async function autoAdvanceLeadNoDisposition(callControlId: string): Promise<void> {
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, lead_id')
    .eq('call_control_id', callControlId)
    .maybeSingle()

  if (!callRow || !callRow.lead_id) return
  await bumpLeadAttemptAndRelease(callRow.id)
}

async function bumpLeadAttemptAndRelease(callId: string): Promise<void> {
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('lead_id')
    .eq('id', callId)
    .maybeSingle()
  if (!callRow?.lead_id) return

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('dial_attempts, campaign_id')
    .eq('id', callRow.lead_id)
    .maybeSingle()

  const newAttempts = (lead?.dial_attempts || 0) + 1

  // How many times this lead should be dialed before being set aside for
  // good — the same "1x/2x/3x, redial before moving on" setting Power/
  // Progressive already enforce client-side, but predictive resolves
  // calls entirely server-side via this webhook with no access to any
  // client React state, so it has to read the campaign's own persisted
  // setting instead. Defaults to 3 (not 1) if the column is missing/unset
  // — this campaign never previously had ANY cap at all (a lead was
  // released back to claimable indefinitely, forever), so defaulting to 1
  // would be a real regression for every existing predictive campaign;
  // defaulting to 3 preserves close-to-existing behavior (retries still
  // happen) while finally giving it a real, sane ceiling instead of none.
  // ── ONE CAP, SHARED WITH /api/leads/dispose ───────────────────────────
  // This computed its own, using dial_repeat_count as a LIFETIME cap, while
  // dispose used lifetimeAttemptCap. The two disagreed: on 1x a predictive
  // lead was retired permanently after a single attempt, while the same lead
  // dialed by hand got three. Whether a lead survived depended on which mode
  // happened to reach it, which is not a rule anybody chose.
  //
  // Both now read the same function, and that function currently returns
  // unlimited, so nothing is retired for attempt count in either path.
  let repeatCap = lifetimeAttemptCap(1)
  if (lead?.campaign_id) {
    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('campaigns')
      .select('dial_repeat_count')
      .eq('id', lead.campaign_id)
      .maybeSingle()
    // A missing column (migration not yet run) falls through to the default
    // above, same as campaign===null.
    if (!campaignErr) {
      repeatCap = lifetimeAttemptCap(campaign?.dial_repeat_count)
    }
  }

  if (newAttempts >= repeatCap) {
    // Attempts exhausted — set aside for good. Matches the exact
    // status/disposition pairing app/api/leads/dispose/route.ts already
    // uses for its own "newAttempts >= 3" exhausted case (status: 'maxed',
    // disposition: 'NO_ANSWER'), so a maxed-out lead reads identically in
    // the queue panel and leads tab regardless of which dialer mode
    // exhausted it.
    await supabaseAdmin
      .from('leads')
      .update({
        status: 'maxed',
        disposition: 'NO_ANSWER',
        last_called_at: new Date().toISOString(),
        dial_attempts: newAttempts,
        claimed_at: null,
        claimed_by_session_id: null,
      })
      .eq('id', callRow.lead_id)
  } else {
    // Still has retries left — release back to claimable, no terminal
    // disposition yet, so the predictive controller's own claim query
    // (ordered by dial_attempts ascending) can pick it up again.
    await supabaseAdmin
      .from('leads')
      .update({
        status: 'no_answer',
        last_called_at: new Date().toISOString(),
        dial_attempts: newAttempts,
        claimed_at: null,
        claimed_by_session_id: null,
      })
      .eq('id', callRow.lead_id)
  }
}

async function dialAndBridgeAgentForFanout(
  leadCallControlId: string,
  agentUserId: string
): Promise<boolean> {
  // Same resolved+normalized config lib/placeOutboundCall.ts uses for the
  // user_dial agent leg. This path used to build its own
  // `sip:${user}@${domain}` from raw env, which meant a bad
  // TELNYX_SIP_DOMAIN broke predictive/fanout dialing in a second, separate
  // place that had to be found and fixed independently.
  const env = resolveTelnyxConfigOrLog('calls/events:fanout')
  if (!env) return false

  // CALLER ID FOR THE AGENT LEG: TELNYX_PHONE_NUMBER.
  //
  // There used to be a calls-table lookup here that selected phone_number
  // and then explicitly discarded it (`void callRow`) — the column holds
  // the LEAD's number, not the pool number we dialed FROM, and the
  // no-conference design doesn't record the from-number per call anywhere.
  // So the query could never inform this decision; it was a round trip on
  // every fanout bridge that always fell through to the same fallback.
  // Removed. If per-call from-number consistency is wanted later, it needs
  // a real column (calls.from_number) to read, not this one.
  const fromNumber = process.env.TELNYX_PHONE_NUMBER
  if (!fromNumber) {
    console.error('[calls/events] TELNYX_PHONE_NUMBER not set, no caller id for fanout agent leg')
    return false
  }

  // Ring the SPECIFIC agent whose session was just claimed above, not a
  // shared endpoint. Without this the atomic claim is decorative: it picks
  // one agent, then dials a URI that rings every registered browser.
  const agentSipUri = await agentSipUriForUserId(agentUserId, env)

  const dialAgentLeg = () =>
    fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      // NOTE — DIFFERS FROM PROGRESSIVE, AND THAT DIFFERENCE IS UNVERIFIED.
      // placeOutboundCall dials its agent leg PLAIN (connection_id,
      // client_state, to, from, webhook_url, timeout_secs) and puts link_to +
      // bridge_on_answer on the LEAD leg, which is dialled second. Here both
      // are on the AGENT leg, pointing at a lead call that has already
      // answered — a different operation, and a candidate for why no agent leg
      // is ever attached on fan-out while progressive works.
      //
      // Also missing client_state, which stamps a leg with its owning agent
      // and is how /api/dialer/abort finds legs to hang up. A fan-out agent leg
      // is currently invisible to the kill switch.
      //
      // Left as-is deliberately: changing it also changes WHEN the bridge
      // happens (Telnyx bridging on answer, versus an explicit
      // bridgeCallControlIds once the agent's device picks up), and that needs
      // checking against Telnyx's docs before it goes near live audio.
      body: JSON.stringify({
        connection_id: env.connectionId,
        to: agentSipUri,
        from: fromNumber,
        webhook_url: env.webhookUrl,
        timeout_secs: 30,
        link_to: leadCallControlId,
        bridge_on_answer: true,
      }),
    })

  let res = await dialAgentLeg()

  // ── SIP URI CALLING DISABLED — THE DEAD-AIR BUG ────────────────────────────
  // Telnyx rejects a call to a SIP URI when "Receive SIP URI calls" is off on
  // the credential connection. placeOutboundCall has detected and repaired this
  // for the user_dial agent leg since it was written; this path never did.
  //
  // The consequence is the worst outcome the dialer can produce. A prospect
  // answers, this bridge fails, and they sit listening to silence — and because
  // abortSiblingFanoutLines only runs after a SUCCESSFUL bridge, the other
  // lines keep ringing other people while nobody is connected to anyone. That
  // is exactly what a live test produced: answered, dead air, dialing never
  // stopped.
  //
  // Same repair the user_dial path performs: flip the setting on the connection
  // that actually rejected, then retry once. If the retry still fails, the
  // caller hangs up the lead rather than leaving them on a dead line.
  if (!res.ok) {
    const firstBody = await res.clone().json().catch(() => null)
    if (firstBody && isSipUriRejection(firstBody.errors)) {
      const targetConnection =
        (await resolveCredentialConnectionId(env).catch(() => null)) ||
        env.connectionId
      console.warn(
        `[calls/events] fanout agent leg rejected, SIP URI calling appears disabled on ` +
        `connection ${targetConnection}. Enabling and retrying once.`
      )
      const outcome = await ensureSipUriCallingEnabled(targetConnection, env.apiKey)
      if (outcome !== 'failed') {
        res = await dialAgentLeg()
      }
    }
  }

  if (!res.ok) {
    const text = await res.text()
    console.error(
      `[calls/events] fanout agent dial failed (${res.status}): ${text}`,
      { agentSipUri, agentUserId, configWarnings: env.warnings }
    )
    void logCallEvent({
      event_type: 'fanout_placement_failed',
      call_control_id: leadCallControlId,
      source: 'webhook',
      status: 'agent_bridge_failed',
      detail: {
        reason: text.slice(0, 400),
        http_status: res.status,
        agent_user_id: agentUserId,
        note: 'prospect answered and could not be connected to an agent',
      },
    })
    return false
  }

  // ── RECORD THE AGENT LEG SO ABORT CAN REACH IT ──────────────────────────
  // Predictive places NO agent leg at dial time — placeOutboundCall only does
  // that for user_dial. The agent's leg is born HERE, in a webhook, the moment
  // a lead answers. Until now its call_control_id was never written anywhere,
  // so STOP DIAL SEQUENCE had no way to find it: the sweep reads `calls`, and
  // this leg has no row of its own and wasn't referenced from the lead's.
  // That is why the agent's phone kept ringing after abort in predictive.
  try {
    const agentLegId = (await res.json())?.data?.call_control_id
    if (agentLegId) {
      await supabaseAdmin
        .from('calls')
        .update({ agent_call_control_id: agentLegId })
        .eq('call_control_id', leadCallControlId)
    }
  } catch (err) {
    // Non-fatal: the bridge itself already succeeded. Worst case abort can't
    // reach this one leg, which is the behaviour that existed before.
    console.error('[calls/events] could not record fanout agent leg id:', err)
  }

  return true
}
