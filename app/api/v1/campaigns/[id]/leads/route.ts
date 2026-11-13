import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, requireLiveDialing } from '@/lib/developers/v1'
import { extractLeads, normaliseLead } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BATCH = 500

/**
 * Up to 500 leads. Every lead is checked with the same normaliser the
 * production lead drip uses, and the response says what happened to each one.
 * In test mode nothing is stored or dialled: the response is what live would
 * accept. Live insertion into a DialerSeat campaign is switched on at launch.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withV1(req, async (ctx) => {
    const { platform, env, store } = ctx
    const campaign = await store.getCampaignLink(platform.id, env, id)
    if (!campaign) return v1Error('not_found', `No campaign ${id} in ${env} mode. Create it first with POST /v1/campaigns.`)
    const r = await readJson(req); if ('res' in r) return r.res
    const raw = extractLeads(r.body)
    if (raw.length === 0) return v1Error('invalid_request', 'No leads found. Send { "leads": [ ... ] }.', 'leads')
    if (raw.length > MAX_BATCH) return v1Error('invalid_request', `At most ${MAX_BATCH} leads per request; this one had ${raw.length}.`, 'leads')

    const seen = new Set<string>()
    const results = raw.map((input: unknown, i: number) => {
      const external = input && typeof input === 'object' && 'external_id' in input ? String((input as Record<string, unknown>).external_id) : null
      const lead = normaliseLead(input)
      if (!lead) return { index: i, external_id: external, status: 'rejected', reason: 'No usable US phone number (10 digits, or 11 starting with 1).' }
      if (seen.has(lead.phone)) return { index: i, external_id: external, status: 'duplicate', reason: 'The same number appears earlier in this request.' }
      seen.add(lead.phone)
      return { index: i, external_id: external, status: 'accepted', phone: '+1' + lead.phone }
    })
    const counts = {
      received: raw.length,
      accepted: results.filter(x => x.status === 'accepted').length,
      duplicates: results.filter(x => x.status === 'duplicate').length,
      rejected: results.filter(x => x.status === 'rejected').length,
    }

    if (env === 'test') return v1Json({ object: 'lead_batch', livemode: false, campaign: campaign.id, stored: false, ...counts, results })

    const blocked = requireLiveDialing(ctx); if (blocked) return blocked
    return v1Error('not_available', 'Live lead insertion is switched on when DialerSeat for Developers launches. Test keys validate leads exactly as live will.')
  })
}
