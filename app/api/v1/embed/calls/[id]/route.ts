import { NextResponse, type NextRequest } from 'next/server'
import { authFrame, callIdValid, callPayload, embedError, frameConfig } from '@/lib/developers/embed'
import { emitEvent } from '@/lib/developers/emit'
import { OUTCOME_CLASSES } from '@/lib/developers/catalog'
import { devStore } from '@/lib/developers/store'
import { hangupFromSeat } from '@/lib/developers/live/engine'
import { normalisePhone } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OUTCOMES = OUTCOME_CLASSES.map(o => o.id) as string[]

type Body = {
  event?: unknown
  lead?: { external_id?: unknown; phone?: unknown }
  campaign?: unknown
  mode?: unknown
  amd_result?: unknown
  duration_seconds?: unknown
  talk_seconds?: unknown
  hangup_source?: unknown
  disposition?: { code?: unknown; notes?: unknown }
}

type P = { params: Promise<{ id: string }> }

/** Where a call stands. The live miniplayer polls this while a call is up. */
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params
  const a = await authFrame(req); if ('res' in a) return a.res
  if (!callIdValid(id, a.ctx.frameHash)) return embedError(404, 'unknown_call', 'No such call in this dialer session.')
  const c = await devStore().getCall(id)
  if (!c) return embedError(404, 'unknown_call', 'No such call.')
  return NextResponse.json({
    status: c.status, answered_at: c.answered_at, ended_at: c.ended_at, amd_result: c.amd_result,
    hangup_source: c.hangup_source, talk_seconds: c.talk_seconds, agent_answered_at: c.agent_answered_at,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * The frame reports a step of a call it started.
 *   Test: answered, ended and dispositioned. Each becomes the matching webhook.
 *   Live: hangup (the agent pressed it) and dispositioned. Answered and ended
 *   come from the carrier, never from a browser.
 * The call id is signed to this frame, so nothing else can report on it.
 */
export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params
  const a = await authFrame(req); if ('res' in a) return a.res
  const ctx = a.ctx
  if (!callIdValid(id, ctx.frameHash)) return embedError(404, 'unknown_call', 'No such call in this dialer session.')
  let b: Body = {}
  try { b = await req.json() } catch { return embedError(400, 'invalid_json', 'Bad request.') }
  const store = devStore()
  const row = await store.getCall(id)
  if (!row) return embedError(404, 'unknown_call', 'No such call.')

  const digits = normalisePhone(b.lead?.phone) || normalisePhone(row.phone)
  if (!digits) return embedError(400, 'bad_number', 'The lead has no usable phone number.')
  const lead = { external_id: typeof b.lead?.external_id === 'string' ? b.lead.external_id.slice(0, 120) : row.lead_external_id, phone: '+1' + digits }
  const campaignId = typeof b.campaign === 'string' && b.campaign ? b.campaign.slice(0, 120) : row.campaign_external_id
  const config = await frameConfig(ctx, campaignId)
  const mode = typeof b.mode === 'string' ? b.mode : (row.dial_mode || config.dial_modes.default)
  const campaign = config.campaign ? { id: config.campaign.id, external_id: config.campaign.external_id } : null
  const call = callPayload(ctx, id, lead, campaign, mode)
  const at = new Date().toISOString()
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : 0)
  const live = row.env === 'live'

  switch (b.event) {
    case 'hangup': {
      if (!live) return embedError(400, 'test_call', 'Test calls end with event "ended".')
      await hangupFromSeat(row)
      return NextResponse.json({ ok: true })
    }
    case 'answered': {
      if (live) return embedError(400, 'live_call', 'Live calls are reported by the carrier.')
      const amd = b.amd_result === 'machine' ? 'machine' : 'human'
      await store.updateCall(id, { status: 'connected', answered_at: at, amd_result: amd })
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.answered', { call: { ...call, answered_at: at, amd_result: amd } })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    case 'ended': {
      if (live) return embedError(400, 'live_call', 'Live calls are reported by the carrier.')
      const src = ['agent', 'lead', 'amd', 'no_answer', 'busy'].includes(String(b.hangup_source)) ? String(b.hangup_source) : 'agent'
      const ended = await store.updateCall(id, { status: 'ended', ended_at: at, hangup_source: src, talk_seconds: num(b.talk_seconds) }, { onlyIfNotEnded: true })
      if (!ended) return NextResponse.json({ ok: true, webhooks: { endpoints: 0, delivered: 0 } })
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.ended', {
        call: { ...call, ended_at: at, duration_seconds: num(b.duration_seconds), talk_seconds: num(b.talk_seconds), hangup_source: src, amd_result: ended.amd_result },
      })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    case 'dispositioned': {
      const code = typeof b.disposition?.code === 'string' ? b.disposition.code : ''
      const d = config.dispositions.find(x => x.code === code)
      if (!d) return embedError(400, 'unknown_disposition', `${code || 'That'} is not one of this platform's dispositions.`)
      if (row.disposition_code) return embedError(409, 'already_dispositioned', 'This call already has a disposition.')
      const notes = typeof b.disposition?.notes === 'string' ? b.disposition.notes.slice(0, 2000) : null
      const outcome = OUTCOMES.includes(d.outcome) ? d.outcome : 'other'
      await store.updateCall(id, { disposition_code: d.code, disposition_outcome: outcome, notes })
      // A disposition mapped to do-not-call suppresses the number on every campaign of the platform.
      if (outcome === 'dnc') await store.addDnc(ctx.platform.id, ctx.env, lead.phone, `disposition ${d.code}`)
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.dispositioned', {
        call, disposition: { code: d.code, label: d.label, outcome }, notes,
      })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    default:
      return embedError(400, 'unknown_event', 'event must be hangup, answered, ended or dispositioned.')
  }
}
