import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { randomBase62 } from '@/lib/developers/keys'
import { consoleEnv, jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The Stripe hookup for the current project and environment: the URL to add
 * in the platform's own Stripe account, and the signing secret it pasted back.
 *   POST   make the URL (or a fresh one, which retires the old)
 *   PATCH  { signing_secret }  save the endpoint's whsec_ secret
 */
export async function POST() {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const env = await consoleEnv()
  const token = `dsbs_${env}_` + randomBase62(32)
  const src = await devStore().upsertBillingSource({ platform_id: r.ctx.platform.id, env, kind: 'stripe', token, signing_secret: null })
  return NextResponse.json({ token: src.token, env })
}

export async function PATCH(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const env = await consoleEnv()
  let b: { signing_secret?: unknown } = {}
  try { b = await req.json() } catch { return jsonError(400, 'invalid_json', 'Bad request.') }
  const secret = typeof b.signing_secret === 'string' ? b.signing_secret.trim() : ''
  if (!/^whsec_[0-9A-Za-z]{16,128}$/.test(secret)) return jsonError(400, 'bad_secret', 'That is not a Stripe signing secret. In Stripe, open the endpoint and reveal its signing secret: it starts with whsec_.')
  const store = devStore()
  const src = await store.getBillingSource(r.ctx.platform.id, env)
  if (!src) return jsonError(404, 'no_source', 'Create the Stripe endpoint URL first.')
  await store.upsertBillingSource({ platform_id: src.platform_id, env, kind: 'stripe', token: src.token, signing_secret: secret })
  return NextResponse.json({ ok: true })
}
