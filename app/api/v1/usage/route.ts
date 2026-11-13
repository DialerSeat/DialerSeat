import type { NextRequest } from 'next/server'
import { withV1, v1Json } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Seats are counted from the platform's own records. Dials and seat-weeks are
 * null, not 0, until live dialing has produced some: a number we have not
 * measured is never shown as one we have.
 */
export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const seats = await store.listSeats(platform.id, env)
    return v1Json({
      object: 'usage', livemode: env === 'live',
      seats: {
        total: seats.length,
        active: seats.filter(s => s.status === 'active').length,
        pending: seats.filter(s => s.status === 'pending').length,
        disabled: seats.filter(s => s.status === 'disabled').length,
      },
      dials: null,
      seat_weeks: null,
    })
  })
}
