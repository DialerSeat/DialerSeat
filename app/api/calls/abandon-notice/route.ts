import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAmdResult, markCallAbandoned } from '@/lib/dialerPacing'

/**
 * SignalWire AMD result webhook.
 * Configured via AsyncAmdStatusCallback on the outbound call.
 *
 * SignalWire posts:
 *   CallSid=CAxxx
 *   AnsweredBy=human|machine_start|machine_end_beep|machine_end_silence|machine_end_other|fax|unknown
 *
 * Behavior:
 *   - machine_*: hang up, auto-dispose lead as NO_ANSWER_AMD
 *   - human + agent connected: leave alone (existing twiml flow connects them)
 *   - human + NO agent connected: ABANDONED — play TSR-compliant notice + log
 *   - fax/unknown: record but do nothing
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string | null
    const answeredBy = formData.get('AnsweredBy') as string | null

    if (!callSid || !answeredBy) {
      console.warn('[amd-result] Missing CallSid or AnsweredBy', { callSid, answeredBy })
      return new NextResponse('', { status: 200 })
    }

    console.log(`[amd-result] ${callSid} answered by ${answeredBy}`)

    await recordAmdResult(callSid, answeredBy)

    if (answeredBy.startsWith('machine_')) {
      // Voicemail / answering machine — hang up silently
      await hangupCall(callSid)
      await autoDisposeAsNoAnswer(callSid, 'NO_ANSWER_AMD')
      return new NextResponse('', { status: 200 })
    }

    if (answeredBy === 'human') {
      // Check if an agent is actively bridged to this call.
      // If the room has an agent_call_sid AND that agent call is still active,
      // the existing twiml flow handles it — do nothing.
      // If no agent is bridged within 2 seconds, this is an ABANDONED call
      // per FTC TSR § 310.4(b)(1)(iv) — we must play the recorded notice.
      const isAbandoned = await detectAbandonedCall(callSid)
      if (isAbandoned) {
        console.log(`[amd-result] ABANDONED — playing TSR notice for ${callSid}`)
        await markCallAbandoned(callSid)
        await playAbandonNotice(callSid)
        await autoDisposeAsNoAnswer(callSid, 'ABANDONED')
      }
      return new NextResponse('', { status: 200 })
    }

    // fax / unknown — log only, no action
    return new NextResponse('', { status: 200 })
  } catch (error: any) {
    console.error('[amd-result] error:', error)
    return new NextResponse('', { status: 200 })
  }
}

/**
 * Detect whether a human-answered call has an agent on the line.
 * Returns true if the call is abandoned (human answered, no agent).
 *
 * Logic: look up the call_rooms row for this call. If agent_call_sid is null,
 * or if the agent call status is anything other than "in-progress" / "ringing",
 * it's an abandoned call.
 */
async function detectAbandonedCall(leadCallSid: string): Promise<boolean> {
  const { data: room } = await supabaseAdmin
    .from('call_rooms')
    .select('agent_call_sid')
    .eq('lead_call_sid', leadCallSid)
    .maybeSingle()

  if (!room) {
    // No room record means agent dial never happened — definitely abandoned
    return true
  }

  if (!room.agent_call_sid) {
    return true
  }

  // Check the agent call's live status via SignalWire
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN

  if (!spaceUrl || !projectId || !apiToken) return false

  try {
    const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
    const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${room.agent_call_sid}.json`
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
    })
    if (!res.ok) return false
    const callData = await res.json()
    const status = callData.status || ''
    // If agent call has ended or never connected, the lead has no one to talk to
    return status === 'completed' || status === 'failed' || status === 'no-answer' || status === 'canceled' || status === 'busy'
  } catch (err) {
    console.error('[amd-result] detectAbandonedCall error:', err)
    return false
  }
}

/**
 * Redirects an abandoned call to the abandon-notice TwiML endpoint.
 * The notice plays the seller-identifying message required by the TSR
 * within 2 seconds of the consumer's greeting, then hangs up.
 */
async function playAbandonNotice(callSid: string): Promise<void> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!spaceUrl || !projectId || !apiToken || !appUrl) return

  // Look up the campaign for this call so the notice can name the seller
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('campaign_id')
    .eq('signalwire_call_id', callSid)
    .maybeSingle()

  const campaignParam = callRow?.campaign_id
    ? `?campaignId=${callRow.campaign_id}`
    : ''

  const noticeUrl = `${appUrl}/api/calls/abandon-notice${campaignParam}`

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
  const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${callSid}.json`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Url: noticeUrl, Method: 'GET' }).toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[amd-result] playAbandonNotice failed:', res.status, text)
    }
  } catch (err) {
    console.error('[amd-result] playAbandonNotice error:', err)
  }
}

async function hangupCall(callSid: string): Promise<void> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN

  if (!spaceUrl || !projectId || !apiToken) return

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
      console.log(`[amd-result] hung up ${callSid}`)
    }
  } catch (err) {
    console.error('[amd-result] hangup error:', err)
  }
}

async function autoDisposeAsNoAnswer(callSid: string, dispositionLabel: string): Promise<void> {
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
    })
    .eq('id', callRow.lead_id)

  await supabaseAdmin
    .from('calls')
    .update({ disposition: dispositionLabel })
    .eq('id', callRow.id)
}