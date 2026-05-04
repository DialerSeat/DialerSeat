import { NextResponse } from 'next/server'

function buildTwiML(room: string, record: boolean, appUrl: string) {
  const recordAttrs = record
    ? ` record="record-from-start" recordingStatusCallback="${appUrl}/api/calls/recording-status" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" beep="false"${recordAttrs}>
      ${room}
    </Conference>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}