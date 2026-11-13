import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { deliver, isKnownEvent, sampleEvent } from '@/lib/developers/webhooks'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Send one signed example event to an endpoint, now, and record the result.
 * The fastest way for a developer to prove their signature check works.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  const { id } = await params
  let b: { type?: unknown } = {}
  try { b = await req.json() } catch { /* */ }
  const type = typeof b.type === 'string' && isKnownEvent(b.type) && b.type !== '*' ? b.type : 'call.dispositioned'

  const store = devStore()
  const ep = (await store.listWebhooks(platform.id)).find(w => w.id === id)
  if (!ep) return jsonError(404, 'not_found', 'No such endpoint.')

  const event = sampleEvent(type, platform.id)
  const result = await deliver(ep.url, ep.signing_secret, event)
  const delivery = await store.insertDelivery({
    endpoint_id: ep.id, event_type: type, payload: event,
    status: result.ok ? 'delivered' : 'failed', attempts: 1, next_attempt_at: null,
    last_status_code: result.status, last_error: result.error,
    delivered_at: result.ok ? new Date().toISOString() : null,
  })
  return NextResponse.json({ delivery, duration_ms: result.durationMs })
}
