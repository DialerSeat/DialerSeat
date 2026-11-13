import { NextResponse, type NextRequest } from 'next/server'
import { authFrame, callPayload, embedError, frameConfig, newCallId } from '@/lib/developers/embed'
import { emitEvent } from '@/lib/developers/emit'
import { testOutcomeFor } from '@/lib/developers/catalog'
import { normalisePhone } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Start a call from the miniplayer. In test mode nothing is dialled: the
 * outcome is chosen by the number's last digit (see TEST_NUMBERS) and the
 * frame plays the call out, reporting each step back so the platform receives
 * the same webhooks a real call sends. Live calls go through the DialerSeat
 * dialer once live dialing is switched on for the miniplayer at launch.
 */
export async function POST(req: NextRequest) {
  const a = await authFrame(req); if ('res' in a) return a.res
  const ctx = a.ctx
  let b: { lead?: { external_id?: unknown; phone?: unknown; name?: unknown }; campaign?: unknown; mode?: unknown } = {}
  try { b = await req.json() } catch { return embedError(400, 'invalid_json', 'Bad request.') }
  const digits = normalisePhone(b.lead?.phone)
  if (!digits) return embedError(400, 'bad_number', 'That lead has no usable US phone number.')
  const campaignId = typeof b.campaign === 'string' && b.campaign ? b.campaign.slice(0, 120) : null
  const config = await frameConfig(ctx, campaignId)
  const mode = typeof b.mode === 'string' && (config.dial_modes.allowed as string[]).includes(b.mode) ? b.mode : config.dial_modes.default

  if (config.can_dial === 'live_inactive') return embedError(402, 'live_dialing_inactive', 'Live dialing is not active on this platform yet.')
  if (config.can_dial === 'needs_payment') return embedError(402, 'payment_required', 'This seat needs to be paid for before it can dial.')
  if (config.can_dial === 'waiting_for_platform') return embedError(402, 'seat_pending', 'This seat is waiting for the platform to activate it.')
  if (config.can_dial === 'live') return embedError(501, 'not_available', 'Live calls from the miniplayer switch on when DialerSeat for Developers launches. Test keys simulate every step.')

  const callId = newCallId(ctx.env, ctx.frameHash)
  const lead = { external_id: typeof b.lead?.external_id === 'string' ? b.lead.external_id.slice(0, 120) : null, phone: '+1' + digits }
  const campaign = config.campaign ? { id: config.campaign.id, external_id: config.campaign.external_id } : null
  const call = callPayload(ctx, callId, lead, campaign, mode)
  const sent = await emitEvent(ctx.platform, ctx.env, 'call.started', { call: { ...call, started_at: new Date().toISOString() } })
  return NextResponse.json({ call_id: callId, outcome: testOutcomeFor(digits), mode, webhooks: sent })
}
