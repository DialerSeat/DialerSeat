import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error } from '@/lib/developers/v1'
import { hashKey, randomBase62 } from '@/lib/developers/keys'
import type { SessionLead } from '@/lib/developers/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TTL_MS = 15 * 60 * 1000
const MAX_LEADS = 500

function str(v: unknown, max = 120): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
}

/**
 * A one-use, 15-minute token that signs this seat into the miniplayer. Stored
 * hashed. The body may carry { campaign, leads } so a hosted dialer link or a
 * plain iframe opens with its list already loaded; the script tag can still
 * send leads from the page instead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withV1(req, async ({ platform, env, store }) => {
    const seat = await store.getSeat(platform.id, id)
    if (!seat || seat.env !== env) return v1Error('not_found', `No seat ${id} in ${env} mode.`)
    if (seat.status === 'disabled') return v1Error('forbidden', 'This seat is disabled. Create it again with POST /v1/seats to use it.')
    let body: { leads?: unknown; campaign?: unknown } = {}
    try { const t = await req.text(); if (t.trim()) body = JSON.parse(t) } catch { return v1Error('invalid_request', 'The body is not valid JSON.') }
    let leads: SessionLead[] | null = null
    if (body.leads !== undefined) {
      if (!Array.isArray(body.leads)) return v1Error('invalid_request', 'leads must be an array of { phone, external_id, first_name, ... }.', 'leads')
      if (body.leads.length > MAX_LEADS) return v1Error('invalid_request', `At most ${MAX_LEADS} leads per session; this one had ${body.leads.length}.`, 'leads')
      leads = body.leads.flatMap((l: unknown) => {
        const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
        const phone = str(o.phone, 32)
        if (!phone) return []
        return [{ phone, external_id: str(o.external_id), first_name: str(o.first_name, 80), last_name: str(o.last_name, 80), state: str(o.state, 40), company: str(o.company, 120), note: str(o.note, 500) }]
      })
    }
    const campaign = str(body.campaign) ?? null
    const token = `dss_${env}_` + randomBase62(40)
    const expires = new Date(Date.now() + TTL_MS).toISOString()
    await store.insertSession({ seat_id: seat.id, token_hash: hashKey(token), expires_at: expires, leads, campaign })
    return v1Json({
      object: 'session', token, expires_at: expires, livemode: env === 'live',
      seat: { id: seat.id, status: seat.status },
      leads: leads ? leads.length : 0, campaign,
      // A pending user-billed seat opens on checkout inside the miniplayer.
      opens_on: seat.status === 'active' ? 'dialer' : seat.billed_to === 'user' ? 'checkout' : 'waiting_for_platform',
    }, 201)
  })
}
