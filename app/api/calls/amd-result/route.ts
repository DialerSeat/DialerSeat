import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAmdResult } from '@/lib/dialerPacing'
import { verifyWebhook, webhookUrl } from '@/lib/verifyWebhook'
import {
  claimTelephonyEvent,
  markTelephonyEventProcessed,
  markTelephonyEventFailed,
} from '@/lib/telephony-idempotency'

// =============================================================================
// SignalWire AMD result webhook (modified for predictive controller)
// =============================================================================
// Records the AMD result on the calls row.
//
// Behavior by AMD result:
//
//   answeredBy = 'human':
//     - User-dial calls (no dial_group_id): leave alone, agent is already
//       in the conference and gets the human normally.
//     - Controller-fanout calls (dial_group_id is set):
//         * Check if the originating agent_session is still 'ready' AND
//           has no other in-flight call already routed to them.
//         * If yes: leave the call alone — agent gets routed via the
//           existing conference flow (controller-fanout calls have NO
//           pre-placed agent leg, so we need to place it NOW).
//         * If no: this is an EXCESS abandon. Redirect the call to the
//           abandon-notice TwiML (FTC TSR § 310.4(b)(4) compliance) and
//           mark the call as abandoned for the 30-day rate calculation.
//
//   answeredBy starts with 'machine_', or = 'fax' / 'unknown':
//     Same as before — hang up the call, auto-dispose lead as no_answer,
//     delete recording.
//
// IMPORTANT: For controller_fanout calls, the agent leg has NOT been
// placed yet (placeOutboundCall with source='controller_fanout' only fires
// the lead leg). We need to dial the agent NOW when AMD says human and
// the agent is still ready. If the agent has gone busy, we abandon.
// =============================================================================

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string | null
    const answeredBy = formData.get('AnsweredBy') as string | null

    if (!callSid || !answeredBy) {
      console.warn('[amd-result] Missing CallSid or AnsweredBy', { callSid, answeredBy })
      return new NextResponse('', { status: 200 })
    }

    console.log(`[amd-result] ${callSid} answered by ${answeredBy}`)

    // ── Idempotency: AMD side effects (hangup / agent-leg routing / abandon)
    // must fire exactly once. A duplicate AMD callback for the same CallSid +
    // AnsweredBy is acknowledged and skipped before any side effect runs.
    const claim = await claimTelephonyEvent({
      callSid,
      webhook: 'amd',
      status: answeredBy,
      sequenceNo: null, // AMD callbacks carry no SequenceNumber
    })
    if (!claim.shouldProcess) {
      return new NextResponse('', { status: 200 })
    }

    try {
      await recordAmdResult(callSid, answeredBy)

      const isNotHuman =
        answeredBy.startsWith('machine_') ||
        answeredBy === 'fax' ||
        answeredBy === 'unknown'

      if (isNotHuman) {
        await hangupCall(callSid)
        await autoDisposeAsNoAnswer(callSid)
        cleanupRecordingsForCall(callSid).catch(err => {
          console.error('[amd-result] recording cleanup failed:', err)
        })
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // ── HUMAN ANSWERED ──────────────────────────────────────────────────
      // Look up the call row to determine if this is a user-dial or
      // controller-fanout call.
      const { data: callRow } = await supabaseAdmin
        .from('calls')
        .select('id, campaign_id, dial_group_id, signalwire_call_id, phone_number')
        .eq('signalwire_call_id', callSid)
        .maybeSingle()

      if (!callRow) {
        // No matching call row — can't tell user_dial vs fanout.
        // Default to leaving alone (existing behavior for user dials).
        console.warn(`[amd-result] No calls row for ${callSid}, treating as user_dial`)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      if (!callRow.dial_group_id) {
        // No dial_group_id = user_dial call. Agent leg already placed and
        // joined conference at lead pickup. Nothing to do — agent already
        // has the call.
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // ── CONTROLLER FANOUT — route or abandon ────────────────────────────
      // dial_group_id is the agent_sessions.id that fired this call.
      // Check if that session is still ready (no other call routed to them).
      const sessionId = callRow.dial_group_id

      const { data: session } = await supabaseAdmin
        .from('agent_sessions')
        .select('id, state, current_call_id, last_heartbeat, user_id')
        .eq('id', sessionId)
        .maybeSingle()

      if (!session) {
        // Session disappeared — agent closed browser before AMD fired.
        // Abandon the call.
        console.log(`[amd-result] session ${sessionId} gone, abandoning ${callSid}`)
        await abandonCall(callSid)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // Heartbeat freshness — if agent's tab is closed, abandon
      const heartbeatAge = Date.now() - new Date(session.last_heartbeat).getTime()
      if (heartbeatAge > 15_000) {
        console.log(`[amd-result] session ${sessionId} stale (${Math.round(heartbeatAge/1000)}s), abandoning ${callSid}`)
        await abandonCall(callSid)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // If agent already has a call routed to them (current_call_id set,
      // AND it's not this call), this is the excess pickup → abandon.
      if (session.current_call_id && session.current_call_id !== callRow.id) {
        console.log(`[amd-result] session ${sessionId} already on call ${session.current_call_id}, abandoning ${callSid}`)
        await abandonCall(callSid)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // Agent is ready or already claimed this call. Claim it for them
      // and place the agent leg into the same conference room.
      const claimRes = await supabaseAdmin
        .from('agent_sessions')
        .update({
          current_call_id: callRow.id,
          state: 'on_call',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .or(`current_call_id.is.null,current_call_id.eq.${callRow.id}`)
        .select('id')
        .maybeSingle()

      if (!claimRes.data) {
        // Update touched 0 rows — someone else claimed in the meantime.
        console.log(`[amd-result] session ${sessionId} claim race lost, abandoning ${callSid}`)
        await abandonCall(callSid)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      // Successfully claimed — now place the agent leg.
      const { data: roomRow } = await supabaseAdmin
        .from('call_rooms')
        .select('room_name')
        .eq('lead_call_sid', callSid)
        .maybeSingle()

      if (!roomRow) {
        console.error(`[amd-result] no call_rooms row for lead ${callSid}, can't place agent leg`)
        await abandonCall(callSid)
        // Release session claim
        await supabaseAdmin
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', sessionId)
        await markTelephonyEventProcessed(claim.eventKey)
        return new NextResponse('', { status: 200 })
      }

      await placeAgentLegForFanout(roomRow.room_name, callRow.phone_number)

      await markTelephonyEventProcessed(claim.eventKey)
      return new NextResponse('', { status: 200 })
    } catch (workErr) {
      await markTelephonyEventFailed(claim.eventKey, workErr)
      throw workErr
    }
  } catch (error: any) {
    console.error('[amd-result] error:', error)
    return new NextResponse('', { status: 200 })
  }
}

// -----------------------------------------------------------------------------
// abandonCall — for predictive fanout EXCESS pickups (FTC TSR compliance)
// -----------------------------------------------------------------------------
// 1. Marks the call as was_abandoned=true in our DB (counts toward 30d rate)
// 2. Redirects the SignalWire call to play the abandon-notice TwiML
//    instead of joining the conference
// -----------------------------------------------------------------------------
async function abandonCall(callSid: string): Promise<void> {
  // Mark in our DB
  try {
    await supabaseAdmin
      .from('calls')
      .update({
        was_abandoned: true,
        disposition: 'ABANDONED',
      })
      .eq('signalwire_call_id', callSid)
  } catch (err) {
    console.error('[amd-result] abandon DB update failed:', err)
  }

  // Redirect the SignalWire call to play the abandon-notice TwiML.
  // SignalWire's Calls API supports "Url" on a POST update to send the
  // call to a new TwiML document — same mechanism Twilio uses.
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!spaceUrl || !projectId || !apiToken || !appUrl) {
    console.error('[amd-result] missing creds, cannot redirect call to abandon TwiML')
    return
  }

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
  const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${callSid}.json`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Url: webhookUrl(`${appUrl}/api/calls/twiml-abandon`),
        Method: 'POST',
      }).toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[amd-result] abandon redirect failed:', res.status, text)
    } else {
      console.log(`[amd-result] redirected ${callSid} to abandon TwiML`)
    }
  } catch (err) {
    console.error('[amd-result] abandon redirect error:', err)
  }

  // Also clean up the lead's claim and bump dial_attempts since we did
  // technically reach them.
  try {
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('lead_id')
      .eq('signalwire_call_id', callSid)
      .maybeSingle()
    if (callRow?.lead_id) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('dial_attempts')
        .eq('id', callRow.lead_id)
        .maybeSingle()
      await supabaseAdmin
        .from('leads')
        .update({
          last_called_at: new Date().toISOString(),
          dial_attempts: (lead?.dial_attempts || 0) + 1,
          claimed_at: null,
          claimed_by_session_id: null,
        })
        .eq('id', callRow.lead_id)
    }
  } catch (err) {
    console.error('[amd-result] abandon lead update failed:', err)
  }
}

// -----------------------------------------------------------------------------
// placeAgentLegForFanout — places the SIP call to the agent for a fanout
// pickup that's been claimed. Joins the lead's existing conference room.
// -----------------------------------------------------------------------------
async function placeAgentLegForFanout(roomName: string, phoneNumber: string): Promise<void> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
  const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const fallbackNumber = process.env.SIGNALWIRE_PHONE_NUMBER

  if (!spaceUrl || !projectId || !apiToken || !sipUsername || !sipDomain || !appUrl) {
    console.error('[amd-result] missing creds for agent leg placement')
    return
  }

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
  const callsUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
  const agentSipUri = `sip:${sipUsername}@${sipDomain}`

  // From number for the agent leg — try to use the lead's pool number for
  // consistency, falls back to SIGNALWIRE_PHONE_NUMBER. Look it up by room.
  let fromNumber = fallbackNumber
  try {
    const { data: room } = await supabaseAdmin
      .from('call_rooms')
      .select('pool_number_id')
      .eq('room_name', roomName)
      .maybeSingle()
    if (room?.pool_number_id) {
      const { data: pool } = await supabaseAdmin
        .from('phone_numbers')
        .select('phone_number')
        .eq('id', room.pool_number_id)
        .maybeSingle()
      if (pool?.phone_number) fromNumber = pool.phone_number
    }
  } catch (err) {
    console.error('[amd-result] pool number lookup failed:', err)
  }

  if (!fromNumber) {
    console.error('[amd-result] no from number available for agent leg')
    return
  }

  try {
    const res = await fetch(callsUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: agentSipUri,
        From: fromNumber,
        Url: webhookUrl(`${appUrl}/api/calls/twiml-agent?room=${roomName}`),
      }).toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[amd-result] agent leg placement failed:', res.status, text)
    } else {
      const data = await res.json()
      console.log(`[amd-result] placed agent leg ${data?.sid} into room ${roomName}`)
      // Update call_rooms with the agent SID
      try {
        await supabaseAdmin
          .from('call_rooms')
          .update({ agent_call_sid: data.sid })
          .eq('room_name', roomName)
      } catch {}
    }
  } catch (err) {
    console.error('[amd-result] agent leg place error:', err)
  }
}

// -----------------------------------------------------------------------------
// Existing helpers (unchanged behavior)
// -----------------------------------------------------------------------------

async function hangupCall(callSid: string): Promise<void> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN

  if (!spaceUrl || !projectId || !apiToken) {
    console.error('[amd-result] missing SignalWire creds, cannot hangup')
    return
  }

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
  const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${callSid}.json`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Status: 'completed' }).toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[amd-result] hangup failed:', res.status, text)
    } else {
      console.log(`[amd-result] hung up ${callSid} (machine detected)`)
    }
  } catch (err) {
    console.error('[amd-result] hangup error:', err)
  }
}

async function autoDisposeAsNoAnswer(callSid: string): Promise<void> {
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, lead_id, campaign_id, user_id')
    .eq('signalwire_call_id', callSid)
    .maybeSingle()

  if (!callRow || !callRow.lead_id) return

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('dial_attempts')
    .eq('id', callRow.lead_id)
    .maybeSingle()

  await supabaseAdmin
    .from('leads')
    .update({
      status: 'no_answer',
      last_called_at: new Date().toISOString(),
      dial_attempts: (lead?.dial_attempts || 0) + 1,
      // Release the claim so the lead can be redialed later
      claimed_at: null,
      claimed_by_session_id: null,
    })
    .eq('id', callRow.lead_id)

  await supabaseAdmin
    .from('calls')
    .update({ disposition: 'NO_ANSWER_AMD' })
    .eq('id', callRow.id)
}

async function cleanupRecordingsForCall(callSid: string): Promise<void> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN

  if (!spaceUrl || !projectId || !apiToken) return

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')

  const delays = [2000, 5000, 15000]
  for (const delay of delays) {
    await new Promise(r => setTimeout(r, delay))

    try {
      const listUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${callSid}/Recordings.json`
      const res = await fetch(listUrl, { headers: { 'Authorization': authHeader } })
      if (!res.ok) continue

      const data = await res.json()
      const recordings = data?.recordings || []

      if (recordings.length === 0) continue

      for (const rec of recordings) {
        const recSid = rec.sid
        const delUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings/${recSid}.json`
        try {
          await fetch(delUrl, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
          })
          console.log(`[amd-result] deleted recording ${recSid} (voicemail filtered)`)
        } catch (err) {
          console.error(`[amd-result] failed to delete recording ${recSid}:`, err)
        }

        await supabaseAdmin
          .from('recordings')
          .delete()
          .eq('signalwire_recording_sid', recSid)
      }

      return
    } catch (err) {
      console.error('[amd-result] recording lookup error:', err)
    }
  }

  console.log(`[amd-result] no recording found for ${callSid} after retries`)
}