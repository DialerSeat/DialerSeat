import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTelnyxWebhook } from '@/lib/verifyTelnyxWebhook'
import { recordAmdResult, markCallAbandoned } from '@/lib/dialerPacing'
import { logCallEvent } from '@/lib/callEvents'
import { hangupCallControlId } from '@/lib/placeOutboundCall'
import { handleOverflowAnsweredCall } from '@/lib/teamOverflow'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import { agentSipUriForUserId } from '@/lib/agentSipCredentials'

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

  try {
    switch (eventType) {
      case 'call.initiated':
        void logCallEvent({
          event_type: 'initiated',
          signalwire_call_id: callControlId,
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
        await handleRecordingSaved(callControlId, payload.recording_urls)
        break

      default:
        // Other event types (call.bridged, streaming.*, etc.) — no action
        // needed today, but we don't want to log noise for every one.
        break
    }
  } catch (err) {
    console.error(`[calls/events] handler error for ${eventType}:`, err)
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
    signalwire_call_id: callControlId,
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
      .eq('signalwire_call_id', callControlId)
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
    signalwire_call_id: callControlId,
    status: result,
    source: 'webhook',
    detail: { result },
  })

  if (result === 'machine') {
    // ── SILENT INSTANT SKIP ────────────────────────────────────────────
    // No disposition. Hang up now. The lead row is bumped (attempt count,
    // last_called_at) so it cycles back into rotation normally, but
    // nothing about this call is ever shown to the agent as needing a
    // decision — it simply never reaches the disposition sheet.
    await hangupCallControlId(callControlId)
    await autoAdvanceLeadNoDisposition(callControlId)
    return
  }

  // 'human' or 'not_sure' (treated as human per Telnyx's own guidance).
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, dial_group_id, campaign_id, team_id, user_id')
    .eq('signalwire_call_id', callControlId)
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
      .eq('signalwire_call_id', callControlId)
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
    signalwire_call_id: callControlId,
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
      .eq('signalwire_call_id', callControlId)
      .maybeSingle()

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
// Telnyx delivers recording_urls as a small object ({ mp3, wav }), not a
// single URL string the way SignalWire's RecordingUrl form field was —
// we store the mp3 url (matches what the recordings player/download
// routes already expect as a single playable URL).
// =============================================================================
async function handleRecordingSaved(
  callControlId: string,
  recordingUrls?: { mp3?: string; wav?: string }
): Promise<void> {
  void logCallEvent({
    event_type: 'recording_ready',
    signalwire_call_id: callControlId,
    source: 'webhook',
  })

  const recordingUrl = recordingUrls?.mp3 || recordingUrls?.wav
  if (!recordingUrl) {
    console.warn(`[calls/events] call.recording.saved for ${callControlId} had no usable URL`)
    return
  }

  const { data, error } = await supabaseAdmin
    .from('calls')
    .update({
      recording_status: 'completed',
      recording_url: recordingUrl,
    })
    .eq('signalwire_call_id', callControlId)
    .select('id')

  if (error) {
    console.error(`[calls/events] recording update failed for ${callControlId}:`, error)
    return
  }
  if (!data || data.length === 0) {
    console.warn(`[calls/events] recording.saved did not match any calls row: ${callControlId}`)
  }
}

async function autoAdvanceLeadNoDisposition(callControlId: string): Promise<void> {
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, lead_id')
    .eq('signalwire_call_id', callControlId)
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
  return true
}
