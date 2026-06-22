import { NextResponse } from 'next/server'

function buildTwiML(room: string, record: boolean, appUrl: string) {
  // Record at the <Dial> level — this records the parent call leg and fires
  // recordingStatusCallback with CallSid matching our `signalwire_call_id`.
  // Recording on <Conference> is unreliable across LaML implementations.
  const dialAttrs = record
    ? ` record="record-from-answer" recordingStatusCallback="${appUrl}/api/calls/recording-status" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>
    <Conference waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${room}</Conference>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const room = (url.searchParams.get('room') || 'DialerSeatRoom').trim()
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const room = (url.searchParams.get('room') || 'DialerSeatRoom').trim()
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}