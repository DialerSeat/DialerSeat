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
import { hangupCallControlId } from '@/lib/placeOutboundCall'
import { handleOverflowAnsweredCall } from '@/lib/teamOverflow'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import { agentSipUriForUserId } from '@/lib/agentSipCredentials'
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
        // Other event types (call.bridged, streaming.*, etc.) — no action
        // needed today, but we don't want to log noise for every one.
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

  // Bridging itself needs no action here: user_dial was already bridged by
  // bridge_on_answer, and controller_fanout waits for AMD before deciding
  // routing — see the module header.
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

async function handleAmdResult(callControlId: string, result: string): Promise<void> {
  await recordAmdResult(callControlId, result)
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
  // The dial path now requests PREMIUM AMD, whose vocabulary is
  // human_residence / human_business / machine / silence / fax_detected /
  // not_sure. 'human' is kept for calls placed before that switch and for
  // standard AMD if it is ever re-enabled.
  //
  // CORRECTING AN EARLIER NOTE IN THIS FILE: it previously claimed
  // "production data confirms AMD is classifying correctly." That was wrong.
  // Three days of traffic showed 33 'machine' verdicts against 8 'human',
  // machine landing 2.0–4.7s after answer — far too fast to be the end of a
  // real greeting. Those were live people saying hello. The cause was
  // 'greeting_end', which decides a greeting has ended by detecting SILENCE
  // and therefore fires on any human pause. Fixed at the detector, in
  // lib/placeOutboundCall.ts.
  //
  // NO TIMING FLOOR HERE, still. A 3.5s minimum-age guard was tried and
  // removed: human verdicts averaged 2272ms and machine 2441ms, so the
  // distributions overlap almost entirely and arrival time carries no signal
  // about which is which. A threshold can only suppress verdicts, never
  // classify them.
  const ROBOT_RESULTS = new Set(['machine', 'fax_detected'])

  if (ROBOT_RESULTS.has(result)) {
    // ── NEVER HANG UP ON A CALL THE AGENT IS ALREADY ON ────────────────
    // This is the guard that was missing, and it is the reason agents were
    // being cut off mid-sentence.
    //
    // In preview, power and progressive the lead leg is dialed with link_to +
    // bridge_on_answer, so the agent is connected the INSTANT the lead picks
    // up. AMD then reports a couple of seconds later — into a conversation
    // that is already happening. Acting on that verdict hangs up on a real
    // person while the agent is talking to them.
    //
    // The entire purpose of AMD is to avoid CONNECTING an agent to a machine.
    // Once they are connected, that has already failed or already succeeded,
    // and the agent can hear which. They have ears and a skip button; a
    // detector that fires on silence does not get to overrule them.
    //
    // Predictive is the opposite case and still hangs up: controller_fanout
    // lines have no agent bridged yet, so a machine verdict is exactly the
    // signal the mode exists to act on, and dropping it costs nobody a
    // conversation.
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('dial_source, agent_call_control_id, answered_at')
      .eq('call_control_id', callControlId)
      .maybeSingle()

    const agentAlreadyBridged =
      callRow?.dial_source === 'user_dial' && !!callRow?.agent_call_control_id

    // Whether that protection applies is a setting, because it is a genuine
    // trade rather than a bug with a right answer: honouring the verdict skips
    // real voicemails, ignoring it protects real people. Default is to honour
    // it — skipping voicemail is the whole point — now that preview, the mode
    // where a wrong verdict hurts most, no longer runs AMD at all.
    const {
      amd_hangup_when_bridged: hangupWhenBridged,
      amd_min_seconds_before_hangup: minSeconds,
    } = await getPlatformConfig()

    // ── TOO SOON TO BE A GREETING ─────────────────────────────────────────
    // The floor, and the thing that actually stops live people being cut off.
    //
    // Over 90 minutes of testing every answered call came back 'machine' —
    // 12 of 12, all of them a human answering their own phone. The detector is
    // not mistimed, it is wrong, so no amount of adjusting how long it listens
    // repairs it.
    //
    // Timing is the one signal that does separate the cases. A real voicemail
    // greeting runs 8-15 seconds, so a genuine "greeting ended" verdict lands
    // late. A verdict two seconds after answer is a person who said hello and
    // paused. Below the floor we simply do not believe it.
    //
    // This is deliberately OUR check rather than a carrier parameter: it works
    // regardless of whether Telnyx honours answering_machine_detection_config,
    // which — given 12 of 12 — is itself in question.
    if (minSeconds > 0 && callRow?.answered_at) {
      const secondsSinceAnswer =
        (Date.now() - new Date(callRow.answered_at).getTime()) / 1000
      if (secondsSinceAnswer < minSeconds) {
        console.warn(
          `[calls/events] AMD said '${result}' only ${secondsSinceAnswer.toFixed(1)}s ` +
          `after answer (floor ${minSeconds}s) — too fast to be the end of a real ` +
          `greeting. Ignoring and leaving the call up.`
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

    // ── SILENT INSTANT SKIP (predictive fan-out only) ──────────────────
    // Hang up now, write no disposition, move on. The lead row is bumped
    // (attempt count, last_called_at) so it cycles back into rotation
    // normally, but the agent is never asked to tag a call they never had.
    await hangupCallControlId(callControlId)
    await autoAdvanceLeadNoDisposition(callControlId)
    return
  }

  // Everything else continues as a live call: human_residence,
  // human_business, human, not_sure, and silence.
  //
  // 'silence' deliberately does NOT hang up. It means AMD heard nothing yet,
  // which is a person who hasn't spoken, a slow handset, or a moment of dead
  // air — none of which are a robot. Ending the call on silence is the exact
  // complaint this change exists to fix.
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, dial_group_id, campaign_id, team_id, user_id')
    .eq('call_control_id', callControlId)
    .maybeSingle()

  if (!callRow) {
    console.warn(`[calls/events] no calls row for ${callControlId} on human AMD result`)
    return
  }

  if (!callRow.dial_group_id) {
    // user_dial — already bridged at answer time. Nothing to do.
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
      if (dialed) return
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

  if (outcome === 'dropped') {
    await markCallAbandoned(callControlId)
    await supabaseAdmin
      .from('calls')
      .update({ disposition: 'ABANDONED' })
      .eq('call_control_id', callControlId)
    await bumpLeadAttemptAndRelease(callRow.id)
  }
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

  // Mark the call as actually over using EXISTING columns only (no schema
  // changes) — duration is the one column that reliably distinguishes
  // "still in flight" from "finished" elsewhere in this codebase already
  // (dialerPacing.ts's abandon-rate math treats duration=0 as in-flight).
  // We compute a real duration from created_at -> now rather than leaving
  // it at its 0 default, which is what makes /api/calls/check able to
  // tell the frontend a call has ended without any new schema.
  try {
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('id, created_at, duration, disposition')
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
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('calls').update(updates).eq('id', callRow.id)
      }

      await supabaseAdmin
        .from('agent_sessions')
        .update({ current_call_id: null })
        .eq('current_call_id', callRow.id)
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
    .select('id, campaign_id, recording_status')
    .eq('call_control_id', callControlId)
    .maybeSingle()

  // An agent who hit the record toggle mid-call asked for this explicitly, so
  // the campaign default does not apply and the recording must be kept. Set
  // by /api/calls/record. Without this exception the enforcement below would
  // delete the recording moments after the agent deliberately started it —
  // the toggle would appear to work and then quietly destroy its own output.
  const manuallyRequested = ownerRow?.recording_status === 'manual'

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

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
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

  if (!res.ok) {
    const text = await res.text()
    console.error(
      `[calls/events] fanout agent dial failed (${res.status}): ${text}`,
      { agentSipUri, agentUserId, configWarnings: env.warnings }
    )
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
