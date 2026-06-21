import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'

// SignalWire requires every owned phone number to have a voice_url configured —
// otherwise inbound calls fail audibly. DialerSeat is outbound-only (for now),
// so this route just plays a polite "we don't accept inbound" message.
//
// Public route — no Clerk auth (SignalWire calls this directly when an inbound
// call hits one of our pool numbers). Authenticity is via the `whk` secret we
// register on the number's VoiceUrl. NOTE: numbers provisioned BEFORE the
// secret was configured won't carry it until re-registered — that's why the
// check is fail-open until SIGNALWIRE_WEBHOOK_SECRET is set. Re-run your number
// provisioning/sync after enabling the secret so existing DIDs get the new URL.
export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. This number does not accept incoming calls. Please call back the number that contacted you, or visit dialerseat dot com for support. Goodbye.</Say>
  <Hangup/>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Allow GET too in case SignalWire's health check uses it
export async function GET(req: Request) {
  return POST(req)
}