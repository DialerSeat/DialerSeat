import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error } from '@/lib/developers/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Calls since a timestamp, newest first: every call the platform's seats have
 * made from the miniplayer in this environment. Test calls are the simulated
 * ones; live calls are real. Empty until something has been dialled, never
 * filled with examples.
 */
export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env, store, req: r }) => {
    const since = r.nextUrl.searchParams.get('since')
    if (since && isNaN(new Date(since).getTime())) return v1Error('invalid_request', 'since must be an ISO 8601 timestamp.', 'since')
    const limit = Math.min(500, Math.max(1, Number(r.nextUrl.searchParams.get('limit')) || 100))
    const rows = await store.listCalls(platform.id, env, since ? new Date(since).toISOString() : null, limit + 1)
    return v1Json({
      object: 'list', livemode: env === 'live', has_more: rows.length > limit,
      data: rows.slice(0, limit).map(c => ({
        object: 'call', id: c.id, livemode: c.env === 'live', status: c.status,
        seat: { id: c.seat_id }, campaign: c.campaign_external_id ? { external_id: c.campaign_external_id } : null,
        lead: { external_id: c.lead_external_id, phone: c.phone }, from: c.from_number, dial_mode: c.dial_mode,
        amd_result: c.amd_result, created_at: c.created_at, answered_at: c.answered_at, ended_at: c.ended_at,
        hangup_source: c.hangup_source, talk_seconds: c.talk_seconds,
        disposition: c.disposition_code ? { code: c.disposition_code, outcome: c.disposition_outcome, notes: c.notes } : null,
      })),
    })
  })
}
