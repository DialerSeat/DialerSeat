import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'
import { escapeXml } from '@/lib/xml'

function buildTwiML(room: string) {
  const safeRoom = escapeXml(room)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
      ${safeRoom}
    </Conference>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  return new NextResponse(buildTwiML(room), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const url = new URL(req.url)
  const room = url.searchParams.get('room') || 'DialerSeatRoom'
  return new NextResponse(buildTwiML(room), {
    headers: { 'Content-Type': 'text/xml' },
  })
}