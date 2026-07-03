import { NextResponse } from 'next/server'
import { verifyWebhook, webhookUrl } from '@/lib/verifyWebhook'
import { escapeXml } from '@/lib/xml'

function buildTwiML(room: string, record: boolean, appUrl: string) {
  const safeRoom = escapeXml(room)
  const dialAttrs = record
    ? ` record="record-from-answer" recordingStatusCallback="${webhookUrl(`${appUrl}/api/calls/recording-status`)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>
    <Conference waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${safeRoom}</Conference>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  const url = new URL(req.url)
  const room = (url.searchParams.get('room') || 'DialerSeatRoom').trim()
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
  const room = (url.searchParams.get('room') || 'DialerSeatRoom').trim()
  const record = url.searchParams.get('record') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return new NextResponse(buildTwiML(room, record, appUrl), {
    headers: { 'Content-Type': 'text/xml' },
  })
}