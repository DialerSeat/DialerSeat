import { NextResponse } from 'next/server'
import { verifyWebhook, webhookUrl } from '@/lib/verifyWebhook'

// SECURITY (Step 8): this TwiML document is fetched by SignalWire when a call
// connects. We verify the `whk` secret so a forged request can't drive call
// behavior. The recordingStatusCallback URL embedded below ALSO carries the
// secret so the recording-status webhook can verify in turn.

function buildTwiML(room: string, record: boolean, appUrl: string) {
  // Record at the <Dial> level — this records the parent call leg and fires
  // recordingStatusCallback with CallSid matching our `signalwire_call_id`.
  // Recording on <Conference> is unreliable across LaML implementations.
  const recordingCb = webhookUrl(`${appUrl}/api/calls/recording-status`)
  const dialAttrs = record
    ? ` record="record-from-answer" recordingStatusCallback="${recordingCb}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>
    <Conference waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
      ${room}
    </Conference>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}