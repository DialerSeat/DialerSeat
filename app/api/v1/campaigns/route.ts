import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str } from '@/lib/developers/v1'
import { DIAL_MODES, type DialMode } from '@/lib/developers/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODES = DIAL_MODES.map(m => m.id) as string[]

function out(c: { id: string; env: string; external_id: string; name: string; dial_mode: string | null; created_at: string }, fallback: string) {
  return { object: 'campaign', id: c.id, livemode: c.env === 'live', external_id: c.external_id, name: c.name, dial_mode: c.dial_mode || fallback, created_at: c.created_at }
}

export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const rows = await store.listCampaignLinks(platform.id, env)
    return v1Json({ object: 'list', data: rows.map(c => out(c, platform.default_dial_mode)) })
  })
}

/** Tie one of your campaigns to DialerSeat, by your external_id. Calling again updates it. */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, env, store }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const external = str(r.body.external_id, 120)
    const name = str(r.body.name, 120)
    if (!external) return v1Error('invalid_request', 'external_id is required: your own id for this campaign.', 'external_id')
    if (!name) return v1Error('invalid_request', 'name is required.', 'name')
    let mode: DialMode | null = null
    if (r.body.dial_mode !== undefined) {
      const m = String(r.body.dial_mode)
      if (!MODES.includes(m)) return v1Error('invalid_request', `dial_mode must be one of: ${MODES.join(', ')}`, 'dial_mode')
      if (!platform.allowed_dial_modes.includes(m as DialMode)) {
        // A campaign exception in the console can still allow it for this one campaign.
        const ex = (await store.listExceptions(platform.id)).find(e => e.scope === 'campaign' && e.external_id === external)
        const allowed = ex?.allowed_modes || (ex?.dial_mode ? [ex.dial_mode] : null)
        if (!allowed || !allowed.includes(m as DialMode)) {
          return v1Error('forbidden', `${m} is not allowed by your platform's dial-mode policy. Allow it under Dial modes, or add an exception for this campaign.`, 'dial_mode')
        }
      }
      mode = m as DialMode
    }
    const c = await store.upsertCampaignLink({ platform_id: platform.id, env, external_id: external, name, dial_mode: mode })
    return v1Json(out(c, platform.default_dial_mode))
  })
}
