import { NextResponse } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { hashKey, randomBase62 } from '@/lib/developers/keys'
import { requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * For the console's "Try it": a test seat for the signed-in developer and a
 * session for it, exactly as their server would make with POST /v1/seats and
 * POST /v1/seats/{id}/sessions. Test mode only; nothing dials.
 */
export async function POST() {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  const store = devStore()
  const seat = await store.upsertSeat({
    platform_id: platform.id, env: 'test', external_user_id: 'console_test_user',
    email: null, name: 'Console test seat', billed_to: 'user', status: 'active',
  })
  const token = 'dss_test_' + randomBase62(40)
  await store.insertSession({ seat_id: seat.id, token_hash: hashKey(token), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
  const pk = (await store.listKeys(platform.id)).find(k => k.kind === 'publishable' && k.env === 'test' && !k.revoked_at)
  return NextResponse.json({ session: token, publishable_key: pk?.token || null, seat_id: seat.id })
}
