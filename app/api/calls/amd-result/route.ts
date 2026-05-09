import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAmdResult } from '@/lib/dialerPacing'

/**
 * SignalWire AMD result webhook.
 * Configured via the `AsyncAmdStatusCallback` parameter on the outbound call
 * (see /api/calls/outbound).
 *
 * SignalWire posts form-encoded data like:
 *   CallSid=CAxxx
 *   AnsweredBy=human|machine_start|machine_end_beep|machine_end_silence|machine_end_other|fax|unknown
 *
 * Behavior:
 *   - Always records the AMD result on the calls row
 *   - If machine_*: hangs up the call via SignalWire REST API
 *   - If human: leaves the call alone (the existing twiml flow connects the agent)
 *   - If fax/unknown: records but does nothing (lets the call play out)
 *
 * NOTE: voicemail_drop_url support is wired through but not yet active.
 * To enable, you'd POST a new TwiML URL to the call after machine detection
 * that plays the recording. Future enhancement.
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

    // Record the AMD result
    await recordAmdResult(callSid, answeredBy)

    // For machine_* results: hang up the call
    if (answeredBy.startsWith('machine_')) {
      await hangupCall(callSid)
      // Also auto-dispose the lead so progressive/predictive can move on
      await autoDisposeAsNoAnswer(callSid)
    }

    return new NextResponse('', { status: 200 })
  } catch (error: any) {
    console.error('[amd-result] error:', error)
    // Always return 200 so SignalWire doesn't retry
    return new NextResponse('', { status: 200 })
  }
}

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
  // Find the calls row + its lead
  const { data: callRow } = await supabaseAdmin
    .from('calls')
    .select('id, lead_id, campaign_id, user_id')
    .eq('signalwire_call_id', callSid)
    .maybeSingle()

  if (!callRow || !callRow.lead_id) return

  // Update the lead status + dial_attempts
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

  // Record the disposition on the call row
  await supabaseAdmin
    .from('calls')
    .update({ disposition: 'NO_ANSWER_AMD' })
    .eq('id', callRow.id)
}