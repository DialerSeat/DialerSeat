import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'











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


export async function GET(req: Request) {
  return POST(req)
}