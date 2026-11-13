import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson } from '@/lib/developers/v1'
import { normalisePhone } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Suppress a number on every campaign of the platform. */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const phone = normalisePhone(r.body.phone)
    if (!phone) return v1Error('invalid_request', 'phone must be a US number: 10 digits, or 11 starting with 1.', 'phone')
    // Checked before every live dial from the miniplayer. Test and live lists are separate.
    await store.addDnc(platform.id, env, '+1' + phone, 'api')
    return v1Json({ object: 'dnc_entry', livemode: env === 'live', phone: '+1' + phone, stored: true })
  })
}
