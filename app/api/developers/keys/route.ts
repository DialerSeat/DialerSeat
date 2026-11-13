import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { generateKey } from '@/lib/developers/keys'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ACTIVE_KEYS = 20

/** Create a key. A secret key's full text is in this response and nowhere else, ever. */
export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform, userId } = r.ctx
  let body: { kind?: unknown; env?: unknown; name?: unknown } = {}
  try { body = await req.json() } catch { /* defaults */ }
  const kind = body.kind === 'publishable' ? 'publishable' : 'secret'
  const env = body.env === 'live' ? 'live' : 'test'
  const name = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim().slice(0, 60) : (kind === 'secret' ? 'Secret key' : 'Publishable key')

  const store = devStore()
  const active = (await store.listKeys(platform.id)).filter(k => !k.revoked_at)
  if (active.length >= MAX_ACTIVE_KEYS) return jsonError(400, 'too_many_keys', `A platform can have ${MAX_ACTIVE_KEYS} active keys. Revoke one you no longer use.`)

  const k = generateKey(kind, env)
  const row = await store.insertKey({
    platform_id: platform.id, kind, env, name,
    key_hash: kind === 'secret' ? k.hash : null,
    token: kind === 'publishable' ? k.key : null,
    prefix: k.prefix, last4: k.last4, scopes: kind === 'secret' ? ['*'] : ['embed'], created_by: userId,
  })
  return NextResponse.json({ id: row.id, key: k.key, kind, env, name })
}
