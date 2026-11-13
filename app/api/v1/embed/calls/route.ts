import { NextResponse, type NextRequest } from 'next/server'
import { authFrame, callPayload, embedError, frameConfig, newCallId } from '@/lib/developers/embed'
import { emitEvent } from '@/lib/developers/emit'
import { testOutcomeFor } from '@/lib/developers/catalog'
import { devStore } from '@/lib/developers/store'
import { startLiveCall } from '@/lib/developers/live/engine'
import { normalisePhone } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Start a call from the miniplayer.
 *
 * Test: nothing is dialled. The outcome is chosen by the number's last digit
 * (TEST_NUMBERS) and the frame plays the call out, reporting each step back so
 * the platform receives the same webhooks a real call sends.
 *
 * Live: the developer platform's own call engine dials the seat's agent leg
 * and the lead, exactly as DialerSeat dials for its own users
 * (lib/developers/live/engine.ts). The frame follows it by polling the call.
 */
export async function POST(req: NextRequest) {
  const a = await authFrame(req); if ('res' in a) return a.res
  const ctx = a.ctx
  let b: { lead?: { external_id?: unknown; phone?: unknown; state?: unknown }; campaign?: unknown; mode?: unknown } = {}
  try { b = await req.json() } catch { return embedError(400, 'invalid_json', 'Bad request.') }
  const digits = normalisePhone(b.lead?.phone)
  if (!digits) return embedError(400, 'bad_number', 'That lead has no usable US phone number.')
  const campaignId = typeof b.campaign === 'string' && b.campaign ? b.campaign.slice(0, 120) : null
  const config = await frameConfig(ctx, campaignId)
  const mode = typeof b.mode === 'string' && (config.dial_modes.allowed as string[]).includes(b.mode) ? b.mode : config.dial_modes.default

  if (config.can_dial === 'live_inactive') return embedError(402, 'live_dialing_inactive', 'Live dialing is not active on this platform yet.')
  if (config.can_dial === 'needs_payment') return embedError(402, 'payment_required', 'This seat needs to be paid for before it can dial.')
  if (config.can_dial === 'waiting_for_platform') return embedError(402, 'seat_pending', 'This seat is waiting for the platform to activate it.')

  const callId = newCallId(ctx.env, ctx.frameHash)
  const lead = {
    external_id: typeof b.lead?.external_id === 'string' ? b.lead.external_id.slice(0, 120) : null,
    phone: '+1' + digits,
    state: typeof b.lead?.state === 'string' ? b.lead.state.slice(0, 40) : null,
  }

  if (config.can_dial === 'live') {
    const r = await startLiveCall({ platform: ctx.platform, seat: ctx.seat, callId, lead, campaignExternalId: campaignId, mode })
    if (!r.ok) return embedError(r.status, r.code, r.message)
    const campaign = config.campaign ? { id: config.campaign.id, external_id: config.campaign.external_id } : null
    const sent = await emitEvent(ctx.platform, 'live', 'call.started', { call: { ...callPayload(ctx, callId, lead, campaign, mode), started_at: r.call.created_at } })
    return NextResponse.json({ call_id: callId, live: true, mode, webhooks: sent })
  }

  // Test: recorded like a live call so GET /v1/calls has something true to show.
  await devStore().insertCall({
    id: callId, platform_id: ctx.platform.id, seat_id: ctx.seat.id, env: 'test',
    campaign_external_id: campaignId, lead_external_id: lead.external_id, phone: lead.phone, from_number: null,
    dial_mode: mode, status: 'ringing', amd_enabled: mode !== 'preview', amd_result: null,
    agent_call_control_id: null, lead_call_control_id: null, agent_answered_at: null, answered_at: null,
    ended_at: null, hangup_source: null, hangup_cause: null, talk_seconds: null,
    disposition_code: null, disposition_outcome: null, notes: null,
  })
  const campaign = config.campaign ? { id: config.campaign.id, external_id: config.campaign.external_id } : null
  const sent = await emitEvent(ctx.platform, 'test', 'call.started', { call: { ...callPayload(ctx, callId, lead, campaign, mode), started_at: new Date().toISOString() } })
  return NextResponse.json({ call_id: callId, live: false, outcome: testOutcomeFor(digits), mode, webhooks: sent })
}
