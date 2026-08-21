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
import { hangupCallControlId, bridgeCallControlIds } from '@/lib/placeOutboundCall'
import { handleOverflowAnsweredCall } from '@/lib/teamOverflow'
import { abortSiblingFanoutLines } from '@/lib/predictiveController'
import { startTelnyxRecording } from '@/lib/telnyxRecording'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import { agentSipUriForUserId, resolveCredentialConnectionId } from '@/lib/agentSipCredentials'
import { ensureSipUriCallingEnabled, isSipUriRejection } from '@/lib/telnyxSipUriCalling'
import { getPlatformConfig } from '@/lib/platformConfig'

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

      case 'call.recording.saved':
        await handleRecordingSaved(
          callControlId,
          payload.recording_urls,
          payload.recording_id,
          payload.recording_started_at,
          payload.recording_ended_at,
        )
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
  try {
    const { data: row } = await supabaseAdmin
      .from('calls')
      .select('id, dial_source, dial_group_id, agent_call_control_id, bridged_at')
      .eq('call_control_id', callControlId)
      .maybeSingle()

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
          }
        }
      }
    }
  } catch (err) {
    console.error(`[calls/events] pickup bridge failed for ${callControlId}:`, err)
  }
}

// =============================================================================
// INBOUND CALLS — DialerSeat is outbound-only (for now)
// =============================================================================
// Every owned Telnyx number needs SOME answer behavior for inbound calls,
// or callers just hear ringing forever. This plays the same polite
// "we don't accept inbound" message the old SignalWire/TwiML version did
// (app/api/calls/inbound/route.ts, now removed) — but the mechanism is
// necessarily different under native Call Control: TwiML could respond
// synchronously with a document describing the whole call; Call Control
// is asynchronous and command-driven, so this takes two steps across two
// webhook events:
//   1. call.initiated (direction=incoming): the call arrives "parked" —
//      nothing happens automatically. We must explicitly issue `answer`.
//   2. call.answered (direction=incoming): NOW we can issue `speak` to
//      play the message, then `hangup`. (Issuing hangup immediately after
//      speak, rather than waiting for a "speak ended" webhook, is
//      deliberate — Telnyx queues commands on a call in order, so the
//      hangup executes only after the speak command completes; see
//      Telnyx's own demo-amd example, which uses this same
//      speak-then-hangup pattern rather than waiting for an intermediate
//      event.)
// =============================================================================

const INBOUND_MESSAGE =
  'Thank you for calling. This number does not accept incoming calls. ' +
  'Please call back the number that contacted you, or visit dialerseat dot com for support. Goodbye.'

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

async function handleInboundCallInitiated(callControlId: string): Promise<void> {
  await callControlAction(callControlId, 'answer')
}

async function handleInboundCallAnswered(callControlId: string): Promise<void> {
  const spoke = await callControlAction(callControlId, 'speak', {
    payload: INBOUND_MESSAGE,
    voice: 'female',
  })
  if (spoke) {
    // Queued behind the speak command — executes once speak completes.
    await callControlAction(callControlId, 'hangup')
  } else {
    // If speak itself failed to even queue, don't leave the caller
    // hanging silently — hang up directly.
    await callControlAction(callControlId, 'hangup')
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
        .select('id, dial_source, agent_call_control_id, answered_at')
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
          `after answer (window ${maxSeconds}s) — too late to be about the greeting. ` +
          `A conversation is likely underway. Leaving the call up.`
        )
        return
      }
    }

    if (agentAlreadyBridged && !hangupWhenBridged) {
      console.warn(
        `[calls/events] AMD said '${result}' for ${callControlId}, but the agent ` +
        `is already bridged in — NOT hanging up. Leaving the call to the human.`
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

      const remainingMs = holdSeconds * 1000 - elapsedMs
      // Only ever extends a call that would otherwise be short. A call already
      // past the threshold is left alone — there is nothing to correct.
      if (remainingMs > 0) {
        console.log(
          `[calls/events] holding ${callControlId} a further ${Math.round(remainingMs)}ms ` +
          `(target ${holdSeconds}s, elapsed ${Math.round(elapsedMs)}ms, ` +
          `answered_at ${answeredAt === null ? 'MISSING — estimated' : 'known'})`
        )
        await new Promise(resolve => setTimeout(resolve, remainingMs))
      } else {
        console.log(
          `[calls/events] no hold for ${callControlId} — already ${Math.round(elapsedMs)}ms ` +
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
  const recordingStart =
    callRow.recording_status === 'pending_amd'
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
          `${callControlId} FAILED — hanging up rather than leaving the lead on a dead line.`
        )
        await hangupCallControlId(callControlId)
      }
    }
    await recordingStart
    return
  }

  // ── ALREADY CONNECTED AT PICKUP — THIS IS ONLY THE CONFIRMATION ─────────
  // The agent is bridged when the prospect answers now, not here. So by the
  // time a human verdict lands the line is already up, and everything below —
  // claiming a session, dialing an agent leg — would be doing it a second
  // time. That would ring the agent again on a call they are already talking
  // on and leave a stray leg behind.
  //
  // What the verdict still decides is the SIBLINGS. A human is confirmed, so
  // every other line this session has ringing ends here. That is the whole of
  // "if human, in-route calls abort" — and it deliberately still fires from
  // the verdict rather than from the pickup, so a machine never kills the
  // other lines on a false alarm.
  if (callRow.agent_call_control_id) {
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
async function startRecordingForCall(
  callControlId: string,
  callRowId: string
): Promise<void> {
  const env = resolveTelnyxConfigOrLog('calls/events:record')
  if (!env) return

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
    return
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
}

async function handleHangup(
  callControlId: string,
  hangupCause?: string,
  hangupSource?: string
): Promise<void> {
  void logCallEvent({
    event_type: 'completed',
    call_control_id: callControlId,
    status: hangupCause,
    source: 'webhook',
    detail: { hangup_cause: hangupCause, hangup_source: hangupSource },
  })

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
      .select('id, created_at, duration, disposition, answered_at, talk_seconds, lead_id, dial_group_id, dial_source')
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
        `[calls/events] AGENT LEG REFUSED — Telnyx hung up agent leg ${callControlId} with ` +
        `'user_busy' (SIP 486) without delivering an INVITE to the browser. This call has NO ` +
        `AGENT AUDIO. Cause is almost always SIP URI calling disabled on the agent credential ` +
        `connection — see ensureAgentConnectionIsDialable in lib/agentSipCredentials.ts, which ` +
        `sets it automatically, or set "Receive SIP URI calls" to "Only from my Connections" in ` +
        `Telnyx Mission Control.`
      )
    }

    if (callRow) {
      const updates: Record<string, unknown> = {}
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
      `[calls/events] call.recording.saved for ${callControlId} had no recording_id — ` +
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
      `[calls/events] discarding recording for ${callControlId} — AMD verdict ` +
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
        `Turn that off — until then every call is being recorded and billed regardless of the ` +
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
  let repeatCap = 3
  if (lead?.campaign_id) {
    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from('campaigns')
      .select('dial_repeat_count')
      .eq('id', lead.campaign_id)
      .maybeSingle()
    // PGRST204-style "column doesn't exist yet" errors (migration not run)
    // fall through to the default of 3 above, same as campaign===null.
    if (!campaignErr && typeof campaign?.dial_repeat_count === 'number') {
      repeatCap = Math.max(1, Math.min(3, campaign.dial_repeat_count))
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
        `[calls/events] fanout agent leg rejected — SIP URI calling appears disabled on ` +
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
