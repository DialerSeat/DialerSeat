import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { generateWebhookSecret } from '@/lib/developers/keys'
import { isKnownEvent, validateWebhookUrl } from '@/lib/developers/webhooks'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return jsonError(400, 'invalid_json', 'The body is not valid JSON.') }

  const v = validateWebhookUrl(String(b.url || ''))
  if ('error' in v) return jsonError(400, 'invalid_url', v.error)
  const events = Array.isArray(b.events) && b.events.length ? b.events.map(String) : ['*']
  const unknown = events.filter(e => !isKnownEvent(e))
  if (unknown.length) return jsonError(400, 'unknown_event', `Unknown event: ${unknown.join(', ')}`)
  const env = b.env === 'live' ? 'live' : 'test'

  const store = devStore()
  if ((await store.listWebhooks(platform.id)).length >= 16) return jsonError(400, 'too_many', 'A platform can have 16 endpoints.')
  const ep = await store.insertWebhook({
    platform_id: platform.id, env, url: v.url,
    description: typeof b.description === 'string' ? b.description.trim().slice(0, 120) || null : null,
    events: events.includes('*') ? ['*'] : events,
    signing_secret: generateWebhookSecret(),
  })
  return NextResponse.json({ endpoint: ep })
}
