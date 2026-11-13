import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str, seatOut } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const seats = await store.listSeats(platform.id, env)
    return v1Json({ object: 'list', data: seats.map(seatOut), has_more: false })
  })
}

/** Create or update the seat for one of the platform's users, keyed on their id. */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const b = r.body
    const external = str(b.external_user_id, 120)
    if (!external) return v1Error('invalid_request', 'external_user_id is required: your own id for this user.', 'external_user_id')
    const email = str(b.email, 200)
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return v1Error('invalid_request', 'email is not an email address.', 'email')
    let billed: 'user' | 'platform'
    if (b.billed_to === 'user' || b.billed_to === 'platform') billed = b.billed_to
    else if (b.billed_to !== undefined) return v1Error('invalid_request', 'billed_to must be "user" or "platform".', 'billed_to')
    else billed = platform.billing_model === 'platform' ? 'platform' : 'user'
    if (billed === 'platform' && platform.billing_model === 'user') {
      return v1Error('forbidden', 'This platform bills users directly. Switch to platform or mixed billing in the console to cover a seat yourself.', 'billed_to')
    }
    const seat = await store.upsertSeat({
      platform_id: platform.id, env, external_user_id: external, email, name: str(b.name, 120), billed_to: billed,
      // A test seat is active at once: nothing it does is real. A live seat
      // waits for payment (user-billed) or for live dialing (platform-billed).
      status: env === 'test' ? 'active' : (billed === 'platform' && platform.live_status === 'active' ? 'active' : 'pending'),
    })
    return v1Json(seatOut(seat))
  })
}
