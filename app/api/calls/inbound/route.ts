import { NextResponse } from 'next/server'

// SignalWire requires every owned phone number to have a voice_url configured —
// otherwise inbound calls fail audibly. DialerSeat is outbound-only (for now),
// so this route just plays a polite "we don't accept inbound" message.
//
// Public route — no auth needed (SignalWire calls this directly when an inbound
// call hits one of our pool numbers).
export async function POST() {
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
export async function GET() {
  return POST()
}