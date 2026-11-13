import { NextResponse, type NextRequest } from 'next/server'
import { liveConfig, verifyTelnyxSignature } from '@/lib/developers/live/telnyx'
import { handleTelnyxEvent } from '@/lib/developers/live/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// The machine-verdict path holds the lead leg up to ~10.5 s before ending it,
// inside this request, the same as DialerSeat's own events handler.
export const maxDuration = 30

/**
 * Webhooks for the developer platform's Telnyx connection only. DialerSeat's
 * own call webhooks go to /api/calls/events and never arrive here; anything
 * without our client_state tag is ignored.
 */
export async function POST(req: NextRequest) {
  const lc = liveConfig()
  if (!lc.ok) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const raw = await req.text()
  if (!verifyTelnyxSignature(lc.config, req, raw)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  try {
    await handleTelnyxEvent(body as Parameters<typeof handleTelnyxEvent>[0])
  } catch (e) {
    console.error('[dev/live/telnyx] handler failed', e)
  }
  // Always 200 once verified: a retry would replay an action already taken.
  return NextResponse.json({ ok: true })
}
