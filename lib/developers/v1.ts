// =============================================================================
// /v1 — THE PUBLIC API'S FRONT DOOR
// =============================================================================
// Every /v1 route runs through withV1: it reads the secret key, finds the
// platform, applies the rate limit, runs the handler, and logs the request for
// the console's request log. Handlers never see a request without a platform.
//
// Test keys see test data and never dial. Live keys see live data and refuse
// anything that would place a call (402) until live dialing is active.
// =============================================================================

import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { hashKey, parseKey } from './keys'
import { devStore, type ApiKey, type DevStore, type Env, type Platform } from './store'

export interface V1Context {
  req: NextRequest
  platform: Platform
  key: ApiKey
  env: Env
  store: DevStore
}

type ErrorType = 'invalid_request' | 'unauthorized' | 'live_dialing_inactive' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'not_available' | 'server_error'

const STATUS: Record<ErrorType, number> = {
  invalid_request: 400, unauthorized: 401, live_dialing_inactive: 402, forbidden: 403,
  not_found: 404, conflict: 409, rate_limited: 429, not_available: 501, server_error: 500,
}

export function v1Error(type: ErrorType, message: string, param?: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { type, code: type, message, ...(param ? { param } : {}) } }, { status: STATUS[type], headers })
}

export function v1Json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

// A token bucket per key, per server instance: 25 requests a second, bursts
// to 50. Generous for an integration, tight for a runaway loop.
const buckets = new Map<string, { tokens: number; at: number }>()
function allow(keyId: string): number | null {
  const rate = 25, burst = 50
  const t = Date.now()
  const b = buckets.get(keyId) || { tokens: burst, at: t }
  b.tokens = Math.min(burst, b.tokens + ((t - b.at) / 1000) * rate)
  b.at = t
  if (b.tokens < 1) { buckets.set(keyId, b); return Math.ceil((1 - b.tokens) / rate) || 1 }
  b.tokens -= 1
  buckets.set(keyId, b)
  return null
}

export async function withV1(req: NextRequest, handler: (ctx: V1Context) => Promise<NextResponse>): Promise<NextResponse> {
  const started = Date.now()
  const header = req.headers.get('authorization') || ''
  const presented = header.replace(/^Bearer\s+/i, '').trim()
  if (!presented) return v1Error('unauthorized', 'No API key. Send it as: Authorization: Bearer sk_test_...')
  const parsed = parseKey(presented)
  if (!parsed) return v1Error('unauthorized', 'That is not a DialerSeat API key. Keys start with sk_test_ or sk_live_.')
  if (parsed.kind !== 'secret') return v1Error('unauthorized', 'Publishable keys (pk_) only work in the miniplayer loader. Use a secret key (sk_) from your server.')

  const store = devStore()
  const key = await store.findKeyByHash(hashKey(presented))
  if (!key) return v1Error('unauthorized', 'This API key does not exist. Check you copied all of it.')
  if (key.revoked_at) return v1Error('unauthorized', `This API key was revoked on ${key.revoked_at.slice(0, 10)}.`)
  const platform = await store.getPlatform(key.platform_id)
  if (!platform) return v1Error('unauthorized', 'This API key belongs to a platform that no longer exists.')

  const wait = allow(key.id)
  if (wait) return v1Error('rate_limited', `Too many requests. Try again in ${wait} second(s).`, undefined, { 'Retry-After': String(wait) })

  let res: NextResponse
  try {
    res = await handler({ req, platform, key, env: key.env, store })
  } catch (e) {
    console.error('[v1] handler failed', req.nextUrl.pathname, e)
    res = v1Error('server_error', 'Something went wrong on our side. It has been logged.')
  }
  res.headers.set('DialerSeat-Environment', key.env)

  // The log and last-used stamp are best effort; a failure here never fails the call.
  const path = req.nextUrl.pathname.replace(/^\/api/, '')
  await Promise.allSettled([
    store.touchKey(key.id),
    store.logRequest({ platform_id: platform.id, key_id: key.id, env: key.env, method: req.method, path, status: res.status, duration_ms: Date.now() - started }),
  ])
  return res
}

/** For anything that would place a real call: test always passes (it simulates); live needs live dialing. */
export function requireLiveDialing(ctx: V1Context): NextResponse | null {
  if (ctx.env === 'test') return null
  if (ctx.platform.live_status === 'active') return null
  return v1Error('live_dialing_inactive', 'Live dialing is not active on this platform, so live keys cannot dial. Use a test key while building, or activate live dialing under Billing in the console.')
}

export async function readJson(req: NextRequest): Promise<{ body: Record<string, unknown> } | { res: NextResponse }> {
  try {
    const b = await req.json()
    if (!b || typeof b !== 'object') return { res: v1Error('invalid_request', 'The body must be a JSON object.') }
    return { body: b as Record<string, unknown> }
  } catch {
    return { res: v1Error('invalid_request', 'The body is not valid JSON.') }
  }
}

export function str(v: unknown, max = 200): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

/** Public shape of a seat: our ids, never a Telnyx or internal user id. */
export function seatOut(s: { id: string; env: string; external_user_id: string; email: string | null; name: string | null; status: string; billed_to: string; created_at: string; updated_at: string }) {
  return { object: 'seat', id: s.id, livemode: s.env === 'live', external_user_id: s.external_user_id, email: s.email, name: s.name, status: s.status, billed_to: s.billed_to, created_at: s.created_at, updated_at: s.updated_at }
}
