import { NextResponse, type NextRequest } from 'next/server'
import { authFrame, callIdValid, callPayload, embedError, frameConfig } from '@/lib/developers/embed'
import { emitEvent } from '@/lib/developers/emit'
import { OUTCOME_CLASSES } from '@/lib/developers/catalog'
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

/**
 * The frame reports a step of a call it started: answered, ended, or the
 * agent's disposition. Each becomes the matching signed webhook. The call id
 * is signed to this frame, so nothing else can report on it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await authFrame(req); if ('res' in a) return a.res
  const ctx = a.ctx
  if (!callIdValid(id, ctx.frameHash)) return embedError(404, 'unknown_call', 'No such call in this dialer session.')
  let b: Body = {}
  try { b = await req.json() } catch { return embedError(400, 'invalid_json', 'Bad request.') }

  const digits = normalisePhone(b.lead?.phone)
  if (!digits) return embedError(400, 'bad_number', 'The lead has no usable phone number.')
  const lead = { external_id: typeof b.lead?.external_id === 'string' ? b.lead.external_id.slice(0, 120) : null, phone: '+1' + digits }
  const campaignId = typeof b.campaign === 'string' && b.campaign ? b.campaign.slice(0, 120) : null
  const config = await frameConfig(ctx, campaignId)
  const mode = typeof b.mode === 'string' ? b.mode : config.dial_modes.default
  const campaign = config.campaign ? { id: config.campaign.id, external_id: config.campaign.external_id } : null
  const call = callPayload(ctx, id, lead, campaign, mode)
  const at = new Date().toISOString()
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : 0)

  switch (b.event) {
    case 'answered': {
      const amd = b.amd_result === 'machine' ? 'machine' : 'human'
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.answered', { call: { ...call, answered_at: at, amd_result: amd } })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    case 'ended': {
      const src = ['agent', 'lead', 'amd', 'no_answer', 'busy'].includes(String(b.hangup_source)) ? String(b.hangup_source) : 'agent'
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.ended', {
        call: { ...call, ended_at: at, duration_seconds: num(b.duration_seconds), talk_seconds: num(b.talk_seconds), hangup_source: src },
      })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    case 'dispositioned': {
      const code = typeof b.disposition?.code === 'string' ? b.disposition.code : ''
      const d = config.dispositions.find(x => x.code === code)
      if (!d) return embedError(400, 'unknown_disposition', `${code || 'That'} is not one of this platform's dispositions.`)
      const notes = typeof b.disposition?.notes === 'string' ? b.disposition.notes.slice(0, 2000) : null
      const sent = await emitEvent(ctx.platform, ctx.env, 'call.dispositioned', {
        call, disposition: { code: d.code, label: d.label, outcome: OUTCOMES.includes(d.outcome) ? d.outcome : 'other' }, notes,
      })
      return NextResponse.json({ ok: true, webhooks: sent })
    }
    default:
      return embedError(400, 'unknown_event', 'event must be answered, ended or dispositioned.')
  }
}
