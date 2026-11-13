import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Calls since a timestamp. A platform's calls are the calls its seats make,
 * and a seat is tied to a DialerSeat user when it first dials live. Until a
 * platform has dialled live there are no calls, and the list is empty rather
 * than filled with examples.
 */
export async function GET(req: NextRequest) {
  return withV1(req, async ({ env, req: r }) => {
    const since = r.nextUrl.searchParams.get('since')
    if (since && isNaN(new Date(since).getTime())) return v1Error('invalid_request', 'since must be an ISO 8601 timestamp.', 'since')
    return v1Json({ object: 'list', livemode: env === 'live', data: [], has_more: false })
  })
}
