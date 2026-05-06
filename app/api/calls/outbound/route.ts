import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    // Hard gate: only active subscribers can initiate outbound calls.
    // This is the most important gate in the entire app — no dialing without payment.
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    // requireActive already validated userId, but TS doesn't know that.
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { to, leadId, campaignId } = body

    if (!to) {
      return NextResponse.json({ success: false, error: 'Missing destination' }, { status: 400 })
    }

    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN
    const phoneNumber = process.env.SIGNALWIRE_PHONE_NUMBER
    const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
    const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!spaceUrl || !projectId || !apiToken || !phoneNumber || !sipUsername || !sipDomain || !appUrl) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 })
    }

    const toFormatted = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`
    const roomName = `room-${Date.now()}`

    const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
    const callsUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`

    // 1) Dial the lead — they go into the conference room (with recording)
    const leadCallResponse = await fetch(callsUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toFormatted,
        From: phoneNumber,
        Url: `${appUrl}/api/calls/twiml?room=${roomName}&record=true`,
        StatusCallback: `${appUrl}/api/calls/status`,
        StatusCallbackMethod: 'POST',
        StatusCallbackEvent: 'completed',
        RecordingStatusCallback: `${appUrl}/api/calls/recording-status`,
        RecordingStatusCallbackMethod: 'POST',
      }).toString(),
    })

    const leadData = await leadCallResponse.json()
    console.log('Lead call response:', leadData)

    if (!leadCallResponse.ok) {
      return NextResponse.json({ success: false, error: leadData.message || 'Lead call failed' }, { status: 500 })
    }

    // 2) Dial the agent (browser SIP) — joins same conference room
    const agentSipUri = `sip:${sipUsername}@${sipDomain}`
    const agentCallResponse = await fetch(callsUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: agentSipUri,
        From: phoneNumber,
        Url: `${appUrl}/api/calls/twiml-agent?room=${roomName}`,
      }).toString(),
    })

    const agentData = await agentCallResponse.json()
    console.log('Agent call response:', agentData)

    if (!agentCallResponse.ok) {
      console.warn('Agent call failed but lead call succeeded:', agentData)
    }

    // Insert call row immediately so status + recording webhooks have something to update.
    // Without this, both webhooks no-op silently and we never log the call.
    try {
      await supabase.from('calls').insert({
        user_id: userId,
        campaign_id: campaignId || null,
        lead_id: leadId || null,
        phone_number: toFormatted,
        signalwire_call_id: leadData.sid,
        duration: 0,
        recording_status: 'pending',
      })
    } catch (e) {
      console.error('Failed to insert call row:', e)
    }

    // Track the room->user mapping so when the recording webhook fires we know who owns it
    try {
      await supabase.from('call_rooms').upsert({
        room_name: roomName,
        user_id: userId,
        phone_number: toFormatted,
        lead_call_sid: leadData.sid,
        agent_call_sid: agentData?.sid || null,
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('call_rooms tracking skipped:', e)
    }

    return NextResponse.json({
      success: true,
      callSid: leadData.sid,
      agentCallSid: agentData?.sid,
      roomName,
      status: leadData.status,
    })
  } catch (error: any) {
    console.error('Call error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}