import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAmdResult } from '@/lib/dialerPacing'

// SignalWire AMD result webhook.
// Records the AMD result on the calls row.
// If machine/fax/unknown: hangs up the call AND deletes the recording
// so voicemail-filtered calls don't pollute the user's recording list.
// If human: leaves the call alone so the agent gets routed in normally.

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
    }

    return new NextResponse('', { status: 200 })
  } catch (error: any) {
    console.error('[amd-result] error:', error)
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
    .update({ disposition: 'NO_ANSWER_AMD' })
    .eq('id', callRow.id)
}

// When AMD detects a machine, find any recording for this call SID and
// delete it from both SignalWire AND our recordings table.
// Retries with progressive delays because recording may not exist yet
// when AMD fires.
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

      if (recordings.length === 0) {
        continue
      }

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