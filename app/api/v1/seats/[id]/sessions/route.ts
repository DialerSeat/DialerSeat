import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error } from '@/lib/developers/v1'
import { hashKey, randomBase62 } from '@/lib/developers/keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TTL_MS = 15 * 60 * 1000

/** A one-use, 15-minute token that signs this seat into the miniplayer. Stored hashed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withV1(req, async ({ platform, env, store }) => {
    const seat = await store.getSeat(platform.id, id)
    if (!seat || seat.env !== env) return v1Error('not_found', `No seat ${id} in ${env} mode.`)
    if (seat.status === 'disabled') return v1Error('forbidden', 'This seat is disabled. Create it again with POST /v1/seats to use it.')
    const token = `dss_${env}_` + randomBase62(40)
    const expires = new Date(Date.now() + TTL_MS).toISOString()
    await store.insertSession({ seat_id: seat.id, token_hash: hashKey(token), expires_at: expires })
    return v1Json({
      object: 'session', token, expires_at: expires, livemode: env === 'live',
      seat: { id: seat.id, status: seat.status },
      // A pending user-billed seat opens on checkout inside the miniplayer.
      opens_on: seat.status === 'active' ? 'dialer' : seat.billed_to === 'user' ? 'checkout' : 'waiting_for_platform',
    }, 201)
  })
}
