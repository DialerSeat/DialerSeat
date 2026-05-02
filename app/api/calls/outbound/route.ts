import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { to } = body

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

    // 1) Dial the lead — they go into the conference room
    const leadCallResponse = await fetch(callsUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toFormatted,
        From: phoneNumber,
        Url: `${appUrl}/api/calls/twiml?room=${roomName}`,
        StatusCallback: `${appUrl}/api/calls/status`,
        StatusCallbackMethod: 'POST',
      }).toString(),
    })

    const leadData = await leadCallResponse.json()
    console.log('Lead call response:', leadData)

    if (!leadCallResponse.ok) {
      return NextResponse.json({ success: false, error: leadData.message || 'Lead call failed' }, { status: 500 })
    }

    // 2) Dial the agent (browser SIP) — joins same conference room
    // SignalWire INVITEs the browser; sip.js auto-accepts and WebRTC negotiates correctly
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
      // Don't fail the whole request — the lead call is already dialing
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