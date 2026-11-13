import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson } from '@/lib/developers/v1'
import { normalisePhone } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Suppress a number on every campaign of the platform. */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ env }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const phone = normalisePhone(r.body.phone)
    if (!phone) return v1Error('invalid_request', 'phone must be a US number: 10 digits, or 11 starting with 1.', 'phone')
    if (env === 'test') return v1Json({ object: 'dnc_entry', livemode: false, phone: '+1' + phone, stored: false })
    return v1Error('not_available', 'Live do-not-call entries are switched on when DialerSeat for Developers launches.')
  })
}
