import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str, seatOut } from '@/lib/developers/v1'
import { cancelSubscription } from '@/lib/developers/billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One of your users cancelled. The seat keeps dialing until the end of the
 * period already paid for, then stops. Pass end_now: true to stop it at once
 * (a refund, a ban).
 */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, env }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const b = r.body
    const user = str(b.external_user_id, 120)
    const sub = str(b.external_subscription_id, 200)
    if (!user && !sub) return v1Error('invalid_request', 'Send external_user_id or external_subscription_id.', 'external_user_id')
    const seat = await cancelSubscription(platform, env, { external_user_id: user, external_subscription_id: sub }, b.end_now === true)
    if (!seat) return v1Error('not_found', `No ${env} seat matches that ${sub ? 'subscription' : 'user'}.`)
    return v1Json({ object: 'cancellation', livemode: env === 'live', seat: seatOut(seat), access_until: seat.paid_through })
  })
}
