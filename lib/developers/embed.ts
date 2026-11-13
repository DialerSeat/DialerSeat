// =============================================================================
// THE MINIPLAYER'S SERVER SIDE
// =============================================================================
// 1. The platform's server mints a one-use session token (dss_…) with its
//    secret key: POST /v1/seats/{id}/sessions.
// 2. The loader puts it in the frame's URL fragment, which never reaches a
//    server log. The frame trades it here, once, for a frame token (dsf_…)
//    that lives 12 hours and only in that frame's memory.
// 3. Every later call from the frame carries "Authorization: Frame dsf_…".
//
// Call ids are signed with the frame token's hash, so a frame can only report
// events for calls it started, and the server keeps no call state in test mode.
// =============================================================================

import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { hashKey, randomBase62 } from './keys'
import { devStore, type Platform, type Seat, type SeatSession } from './store'
import { DEFAULT_DISPOSITIONS, type DialMode } from './catalog'
import { liveConfig } from './live/telnyx'

const FRAME_TTL_MS = 12 * 60 * 60 * 1000

export interface FrameContext {
  platform: Platform
  seat: Seat
  env: 'test' | 'live'
  frameHash: string
}

export function embedError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** Is a parent page allowed to hold the miniplayer? The console (our own origin) always is. */
export function originAllowed(platform: Platform, parentOrigin: string | null, selfOrigin: string): boolean {
  if (!parentOrigin) return false
  if (parentOrigin === selfOrigin) return true
  return platform.allowed_origins.includes(parentOrigin.toLowerCase())
}

export async function exchangeSession(token: string, parentOrigin: string | null, selfOrigin: string):
  Promise<{ ok: true; frameToken: string; ctx: FrameContext } | { ok: false; status: number; code: string; message: string }> {
  const m = /^dss_(test|live)_[0-9A-Za-z]{40}$/.exec(token || '')
  if (!m) return { ok: false, status: 401, code: 'bad_session', message: 'This dialer was opened without a valid session. Your app should create one with POST /v1/seats/{id}/sessions each time it opens the dialer.' }
  const store = devStore()
  const session = await store.findSessionByHash(hashKey(token))
  if (!session) return { ok: false, status: 401, code: 'bad_session', message: 'That session does not exist.' }
  if (session.used_at) return { ok: false, status: 401, code: 'session_used', message: 'That session was already used. Sessions work once; your app should create a new one each time it opens the dialer.' }
  if (new Date(session.expires_at).getTime() < Date.now()) return { ok: false, status: 401, code: 'session_expired', message: 'That session expired. Sessions last 15 minutes.' }
  const seat = await store.getSeatById(session.seat_id)
  if (!seat || seat.status === 'disabled') return { ok: false, status: 403, code: 'seat_disabled', message: 'This seat is disabled.' }
  const platform = await store.getPlatform(seat.platform_id)
  if (!platform) return { ok: false, status: 403, code: 'no_platform', message: 'This seat belongs to a platform that no longer exists.' }
  if (!originAllowed(platform, parentOrigin, selfOrigin)) {
    return { ok: false, status: 403, code: 'origin_not_allowed', message: `${parentOrigin || 'This page'} is not allowed to load the DialerSeat dialer. Add it under Miniplayer → Allowed origins in the console.` }
  }
  if (!(await store.claimSession(session.id))) return { ok: false, status: 401, code: 'session_used', message: 'That session was already used.' }

  const frameToken = `dsf_${seat.env}_` + randomBase62(40)
  const frameHash = hashKey(frameToken)
  await store.insertSession({ seat_id: seat.id, token_hash: frameHash, expires_at: new Date(Date.now() + FRAME_TTL_MS).toISOString() })
  return { ok: true, frameToken, ctx: { platform, seat, env: seat.env, frameHash } }
}

export async function authFrame(req: NextRequest): Promise<{ ctx: FrameContext } | { res: NextResponse }> {
  const raw = (req.headers.get('authorization') || '').replace(/^Frame\s+/i, '').trim()
  if (!/^dsf_(test|live)_[0-9A-Za-z]{40}$/.test(raw)) return { res: embedError(401, 'no_frame_session', 'The dialer is not signed in. Reload it from your app.') }
  const store = devStore()
  const frameHash = hashKey(raw)
  const s: SeatSession | null = await store.findSessionByHash(frameHash)
  if (!s || new Date(s.expires_at).getTime() < Date.now()) return { res: embedError(401, 'frame_expired', 'The dialer session ended. Reload it from your app.') }
  const seat = await store.getSeatById(s.seat_id)
  if (!seat || seat.status === 'disabled') return { res: embedError(403, 'seat_disabled', 'This seat is disabled.') }
  const platform = await store.getPlatform(seat.platform_id)
  if (!platform) return { res: embedError(403, 'no_platform', 'Platform not found.') }
  return { ctx: { platform, seat, env: seat.env, frameHash } }
}

/** What the frame needs to draw itself: who, which modes, which dispositions, can it dial. */
export async function frameConfig(ctx: FrameContext, campaignExternalId: string | null) {
  const store = devStore()
  const { platform, seat, env } = ctx
  const [exceptions, dispositions, campaign] = await Promise.all([
    store.listExceptions(platform.id),
    store.listDispositions(platform.id),
    campaignExternalId ? store.getCampaignLink(platform.id, env, campaignExternalId) : Promise.resolve(null),
  ])
  // Most specific wins: a campaign exception, then a seat exception, then the platform.
  const campEx = campaignExternalId ? exceptions.find(e => e.scope === 'campaign' && e.external_id === campaignExternalId) : undefined
  const seatEx = exceptions.find(e => e.scope === 'seat' && e.external_id === seat.external_user_id)
  const ex = campEx || seatEx
  const allowed: DialMode[] = ex?.allowed_modes?.length ? ex.allowed_modes : ex?.dial_mode ? [ex.dial_mode] : platform.allowed_dial_modes
  const preferred = (ex?.dial_mode || campaign?.dial_mode || platform.default_dial_mode) as DialMode
  const defaultMode = allowed.includes(preferred) ? preferred : allowed[0]

  const canDial = env === 'test' ? 'simulated' as const
    : platform.live_status !== 'active' ? 'live_inactive' as const
    : seat.status === 'active' ? (liveConfig().ok ? 'live' as const : 'live_unavailable' as const)
    : seat.billed_to === 'user' ? 'needs_payment' as const
    : 'waiting_for_platform' as const

  return {
    env,
    platform: { name: platform.name },
    seat: { id: seat.id, external_user_id: seat.external_user_id, name: seat.name, status: seat.status, billed_to: seat.billed_to },
    campaign: campaign ? { id: campaign.id, external_id: campaign.external_id, name: campaign.name } : campaignExternalId ? { id: null, external_id: campaignExternalId, name: null } : null,
    dial_modes: { allowed, default: defaultMode, may_choose: platform.seats_may_choose_mode && allowed.length > 1, exception: ex ? ex.scope : null },
    dispositions: (dispositions.length ? dispositions : DEFAULT_DISPOSITIONS).map(d => ({ code: d.code, label: d.label, outcome: d.outcome })),
    can_dial: canDial,
    allowed_origins: platform.allowed_origins,
  }
}

// ── signed call ids ─────────────────────────────────────────────────────

export function newCallId(env: string, frameHash: string): string {
  const r = randomBytes(9).toString('hex')
  const sig = createHmac('sha256', frameHash).update(r).digest('hex').slice(0, 16)
  return `call_${env}_${r}_${sig}`
}

export function callIdValid(id: string, frameHash: string): boolean {
  const m = /^call_(test|live)_([0-9a-f]{18})_([0-9a-f]{16})$/.exec(id)
  if (!m) return false
  const want = createHmac('sha256', frameHash).update(m[2]).digest('hex').slice(0, 16)
  return timingSafeEqual(Buffer.from(want), Buffer.from(m[3]))
}

/** The call object every call.* webhook carries. Our ids and the platform's ids, never carrier ids. */
export function callPayload(ctx: FrameContext, callId: string, lead: { external_id: string | null; phone: string; name?: string | null }, campaign: { id: string | null; external_id: string } | null, mode: string) {
  return {
    id: callId,
    seat: { id: ctx.seat.id, external_user_id: ctx.seat.external_user_id },
    campaign: campaign ? { id: campaign.id, external_id: campaign.external_id } : null,
    lead: { external_id: lead.external_id, phone: lead.phone },
    dial_mode: mode,
  }
}
