// =============================================================================
// LIVE CALLS FOR DEVELOPER SEATS — the regular dialer's sequence, on its own platform
// =============================================================================
// A seat dials the way any DialerSeat user dials (lib/placeOutboundCall.ts):
//
//   1. Dial the seat's own SIP credential (the agent leg). The miniplayer's
//      browser phone auto-answers it.
//   2. Immediately dial the lead with link_to = the agent leg,
//      bridge_on_answer = true and park_after_unbridge = 'self', so Telnyx
//      connects the two the instant the lead picks up, with no dead air.
//   3. Standard AMD ('detect') runs alongside the live call when the mode uses
//      it. A machine verdict inside the window releases the agent at once and
//      holds the lead leg to the compliance floor before hanging it up.
//   4. A lead leg that fails fast keeps the agent leg up to the 7-second
//      floor, so it is not billed as a short call.
//
// Every value that is tunable on DialerSeat is read from DialerSeat's own
// platform_config (read only), so a developer call behaves like a DialerSeat
// call today and follows any retune. Nothing here writes to a DialerSeat table.
// =============================================================================

import 'server-only'
import { getPlatformConfig } from '@/lib/platformConfig'
import { isCallableNow } from '@/lib/callingWindow'
import { AGENT_LEG_MIN_SECONDS, remainingHoldMs } from '@/lib/complianceHold'
import { devStore, type DevCall, type Platform, type Seat } from '../store'
import { emitEvent } from '../emit'
import { encodeState, decodeState, hangupLeg, liveConfig, telnyx, type LiveConfig } from './telnyx'

const STANDARD_AMD_DETECTOR = 'detect'
const LEAD_LEG_TIME_LIMIT_SECS = 14400 // Telnyx's own ceiling; never a shorter cap (see "Never cap call time")
const RING_MIN_SECONDS = 30
const RING_MAX_SECONDS = 43

/** Ring length by mode, as the regular dialer sets it. */
export function ringSeconds(mode: string): number {
  if (mode === 'predictive') return 20
  if (mode === 'progressive') return RING_MIN_SECONDS + Math.floor(Math.random() * (RING_MAX_SECONDS - RING_MIN_SECONDS + 1))
  return 60
}

// ── seat credentials: one Telnyx telephony credential per seat ──────────

export async function ensureSeatCredential(cfg: LiveConfig, seat: Seat): Promise<{ id: string; sipUsername: string } | null> {
  const store = devStore()
  const existing = await store.getSeatCredential(seat.id)
  if (existing) return { id: existing.telnyx_credential_id, sipUsername: existing.sip_username }
  const r = await telnyx<{ id?: string; sip_username?: string }>(cfg, '/telephony_credentials', {
    method: 'POST',
    body: { connection_id: cfg.credentialConnectionId, name: `dialerseat-dev-seat-${seat.id}` },
  })
  if (!r.ok || !r.data?.id || !r.data.sip_username) {
    console.error('[dev/live] credential create failed', seat.id, r.error)
    return null
  }
  const stored = await store.insertSeatCredential({ seat_id: seat.id, telnyx_credential_id: r.data.id, sip_username: r.data.sip_username })
  if (!stored) {
    // A concurrent request for the same seat won. Use theirs; delete ours so it does not sit on the account.
    void telnyx(cfg, `/telephony_credentials/${r.data.id}`, { method: 'DELETE' })
    const winner = await store.getSeatCredential(seat.id)
    return winner ? { id: winner.telnyx_credential_id, sipUsername: winner.sip_username } : null
  }
  return { id: r.data.id, sipUsername: r.data.sip_username }
}

export async function seatRegistration(seat: Seat) {
  const lc = liveConfig()
  if (!lc.ok) return { ok: false as const, error: `Live calling is not configured (${lc.missing.join(', ')}).` }
  const cfg = lc.config
  const cred = await ensureSeatCredential(cfg, seat)
  if (!cred) return { ok: false as const, error: 'Could not create this seat\'s phone line. Try again in a moment.' }
  // The password is fetched on demand and never stored, as DialerSeat does.
  const r = await telnyx<{ sip_password?: string; expired?: boolean }>(cfg, `/telephony_credentials/${cred.id}`)
  if (!r.ok || !r.data?.sip_password || r.data.expired) return { ok: false as const, error: 'This seat\'s phone line is unavailable.' }
  return {
    ok: true as const,
    registration: {
      sipUsername: cred.sipUsername,
      sipPassword: r.data.sip_password,
      sipDomain: cfg.sipDomain,
      sipWssUrl: cfg.sipWssUrl,
      iceServers: [{ urls: ['stun:stun.telnyx.com:3478', 'stun:stun.l.google.com:19302'] }],
    },
  }
}

// ── caller ID: the platform's own numbers first, then the shared developer pool ──

async function pickCallerId(platformId: string, leadE164: string): Promise<string | null> {
  const store = devStore()
  const numbers = await store.listCallerIds(platformId)
  if (!numbers.length) return null
  const area = leadE164.replace(/^\+1/, '').slice(0, 3)
  const rank = (n: typeof numbers[number]) =>
    (n.platform_id === platformId ? 0 : 2) + (n.area_code === area ? 0 : 1)
  const pick = [...numbers].sort((a, b) => rank(a) - rank(b) || (a.last_used_at || '').localeCompare(b.last_used_at || ''))[0]
  void store.markCallerIdUsed(pick.id)
  return pick.phone
}

// ── place a live call ────────────────────────────────────────────────────

export interface StartInput {
  platform: Platform
  seat: Seat
  callId: string
  lead: { external_id: string | null; phone: string; state?: string | null }   // phone in E.164
  campaignExternalId: string | null
  mode: string
}

export type StartResult = { ok: true; call: DevCall } | { ok: false; status: number; code: string; message: string }

export async function startLiveCall(p: StartInput): Promise<StartResult> {
  const lc = liveConfig()
  if (!lc.ok) return { ok: false, status: 503, code: 'live_not_configured', message: 'Live calling is not configured on the developer platform yet.' }
  const cfg = lc.config
  const store = devStore()

  // Compliance gates, the same ones every DialerSeat dial passes.
  const callable = isCallableNow({ phone: p.lead.phone.replace(/^\+1/, ''), state: p.lead.state ?? null })
  if (!callable.allowed) return { ok: false, status: 422, code: 'outside_calling_hours', message: callable.reason || 'Outside this lead\'s calling hours.' }
  if (await store.isDnc(p.platform.id, 'live', p.lead.phone)) return { ok: false, status: 422, code: 'do_not_call', message: 'This number is on your do-not-call list.' }

  const from = await pickCallerId(p.platform.id, p.lead.phone)
  if (!from) return { ok: false, status: 503, code: 'no_caller_id', message: 'No caller-ID number is available on the developer platform.' }
  const cred = await ensureSeatCredential(cfg, p.seat)
  if (!cred) return { ok: false, status: 503, code: 'no_agent_line', message: 'This seat\'s phone line could not be set up.' }

  const amd = p.mode !== 'preview' // the regular dialer keeps AMD off in preview (amd_in_preview: false)
  const call = await store.insertCall({
    id: p.callId, platform_id: p.platform.id, seat_id: p.seat.id, env: 'live',
    campaign_external_id: p.campaignExternalId, lead_external_id: p.lead.external_id, phone: p.lead.phone,
    from_number: from, dial_mode: p.mode, status: 'dialing', amd_enabled: amd, amd_result: null,
    agent_call_control_id: null, lead_call_control_id: null, agent_answered_at: null, answered_at: null,
    ended_at: null, hangup_source: null, hangup_cause: null, talk_seconds: null,
    disposition_code: null, disposition_outcome: null, notes: null,
  })

  // 1. The agent leg: the seat's own SIP credential.
  const agent = await telnyx<{ call_control_id?: string }>(cfg, '/calls', {
    method: 'POST',
    body: {
      connection_id: cfg.connectionId,
      to: `sip:${cred.sipUsername}@${cfg.sipDomain}`,
      from,
      client_state: encodeState(p.callId, 'agent'),
      webhook_url: cfg.webhookUrl,
      timeout_secs: 30,
    },
  })
  if (!agent.ok || !agent.data?.call_control_id) {
    await store.updateCall(p.callId, { status: 'failed', ended_at: new Date().toISOString(), hangup_source: 'agent_unreachable', hangup_cause: agent.error })
    return { ok: false, status: 502, code: 'agent_leg_failed', message: 'Could not ring this seat\'s browser phone.' }
  }
  const agentCcid = agent.data.call_control_id
  await store.updateCall(p.callId, { agent_call_control_id: agentCcid })

  // 2. The lead leg, linked to the agent so Telnyx bridges on answer.
  const leadBody: Record<string, unknown> = {
    connection_id: cfg.connectionId,
    to: p.lead.phone,
    from,
    client_state: encodeState(p.callId, 'lead'),
    webhook_url: cfg.webhookUrl,
    timeout_secs: ringSeconds(p.mode),
    link_to: agentCcid,
    bridge_on_answer: true,
    park_after_unbridge: 'self',
    time_limit_secs: LEAD_LEG_TIME_LIMIT_SECS,
  }
  if (amd) {
    const pc = await getPlatformConfig()
    const ceiling = pc.amd_total_analysis_ms
    const clamp = (ms: number) => (ms < ceiling ? ms : Math.max(500, ceiling - 1000))
    leadBody.answering_machine_detection = STANDARD_AMD_DETECTOR
    if (pc.amd_tuning_enabled) {
      leadBody.answering_machine_detection_config = {
        total_analysis_time_millis: ceiling,
        after_greeting_silence_millis: pc.amd_after_greeting_silence_ms,
        greeting_duration_millis: clamp(pc.amd_greeting_duration_ms),
        maximum_number_of_words: pc.amd_max_words,
        initial_silence_millis: clamp(pc.amd_initial_silence_ms),
      }
    }
  }
  const lead = await telnyx<{ call_control_id?: string }>(cfg, '/calls', { method: 'POST', body: leadBody })
  if (!lead.ok || !lead.data?.call_control_id) {
    void hangupLeg(cfg, agentCcid)
    await store.updateCall(p.callId, { status: 'failed', ended_at: new Date().toISOString(), hangup_source: 'failed', hangup_cause: lead.error })
    return { ok: false, status: 502, code: 'lead_leg_failed', message: lead.error || 'The call could not be placed.' }
  }
  const updated = await store.updateCall(p.callId, { lead_call_control_id: lead.data.call_control_id, status: 'ringing' })
  return { ok: true, call: updated || call }
}

/** The agent pressed hang up in the miniplayer. */
export async function hangupFromSeat(call: DevCall): Promise<void> {
  const lc = liveConfig(); if (!lc.ok) return
  if (call.lead_call_control_id) await hangupLeg(lc.config, call.lead_call_control_id)
  if (call.agent_call_control_id) await hangupLeg(lc.config, call.agent_call_control_id)
}

// ── Telnyx webhooks ──────────────────────────────────────────────────────

interface TelnyxEvent {
  data?: {
    event_type?: string
    payload?: {
      call_control_id?: string
      client_state?: string
      hangup_cause?: string
      hangup_source?: string
      result?: string
    }
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function platformCall(call: DevCall, seat: Seat | null) {
  return {
    id: call.id,
    seat: { id: call.seat_id, external_user_id: seat?.external_user_id ?? null },
    campaign: call.campaign_external_id ? { id: null, external_id: call.campaign_external_id } : null,
    lead: { external_id: call.lead_external_id, phone: call.phone },
    dial_mode: call.dial_mode,
  }
}

async function finishCall(call: DevCall, source: string, cause: string | null): Promise<void> {
  const store = devStore()
  const endedAt = new Date()
  const talk = call.answered_at && call.amd_result !== 'machine'
    ? Math.max(0, Math.round((endedAt.getTime() - new Date(call.answered_at).getTime()) / 1000)) : 0
  const ended = await store.updateCall(call.id, {
    status: call.answered_at ? 'ended' : (source === 'failed' ? 'failed' : 'ended'),
    ended_at: endedAt.toISOString(), hangup_source: source, hangup_cause: cause, talk_seconds: talk,
  }, { onlyIfNotEnded: true })
  if (!ended) return // a duplicate webhook: call.ended has already gone out
  const platform = await store.getPlatform(call.platform_id)
  const seat = await store.getSeatById(call.seat_id)
  if (!platform) return
  await emitEvent(platform, 'live', 'call.ended', {
    call: {
      ...platformCall(ended, seat), ended_at: ended.ended_at,
      duration_seconds: Math.max(0, Math.round((endedAt.getTime() - new Date(ended.created_at).getTime()) / 1000)),
      talk_seconds: talk, hangup_source: source, amd_result: ended.amd_result,
    },
  })
}

function leadEndSource(cause: string | undefined, answered: boolean, amd: string | null, telnyxSource: string | undefined): string {
  if (amd === 'machine') return 'amd'
  if (!answered) {
    if (cause === 'timeout' || cause === 'no_answer') return 'no_answer'
    if (cause === 'user_busy') return 'busy'
    return 'failed'
  }
  return telnyxSource === 'callee' ? 'lead' : 'agent'
}

export async function handleTelnyxEvent(evt: TelnyxEvent): Promise<void> {
  const lc = liveConfig(); if (!lc.ok) return
  const cfg = lc.config
  const type = evt.data?.event_type
  const pl = evt.data?.payload
  const st = decodeState(pl?.client_state)
  if (!type || !pl?.call_control_id || !st) return // not one of ours
  const store = devStore()
  const call = await store.getCall(st.c)
  if (!call || call.env !== 'live') return

  if (type === 'call.answered') {
    const at = new Date().toISOString()
    if (st.r === 'agent') {
      await store.updateCall(call.id, { agent_answered_at: at })
      return
    }
    const updated = await store.updateCall(call.id, { answered_at: at, status: 'connected' }, { onlyIfNotEnded: true })
    if (!updated) return
    const platform = await store.getPlatform(call.platform_id)
    const seat = await store.getSeatById(call.seat_id)
    if (platform) await emitEvent(platform, 'live', 'call.answered', {
      call: { ...platformCall(updated, seat), answered_at: at, amd_result: updated.amd_enabled ? 'pending' : 'not_run' },
    })
    return
  }

  if (type === 'call.machine.detection.ended' && st.r === 'lead') {
    const result = pl.result || 'unknown'
    const isMachine = result === 'machine' || result === 'fax_detected'
    const fresh = await store.updateCall(call.id, { amd_result: isMachine ? 'machine' : result === 'human' ? 'human' : result })
    if (!isMachine || !fresh || fresh.ended_at) return
    // Too late to be about the greeting: a conversation is likely underway. Leave it.
    const pc = await getPlatformConfig()
    const windowSecs = Math.max(pc.amd_max_seconds_after_answer, pc.amd_total_analysis_ms / 1000 + 3)
    const answeredAt = fresh.answered_at ? new Date(fresh.answered_at).getTime() : null
    if (answeredAt && (Date.now() - answeredAt) / 1000 > windowSecs) {
      await store.updateCall(call.id, { amd_result: 'machine_late_ignored' })
      return
    }
    // Release the agent now; hold the parked lead leg to the floor, then end it.
    if (fresh.agent_call_control_id) await hangupLeg(cfg, fresh.agent_call_control_id)
    const hold = pc.amd_hold_seconds_after_machine ?? 8
    const wait = remainingHoldMs(hold, answeredAt ? Date.now() - answeredAt : 0)
    if (wait > 0) await sleep(wait)
    if (fresh.lead_call_control_id) await hangupLeg(cfg, fresh.lead_call_control_id)
    return
  }

  if (type === 'call.hangup') {
    if (st.r === 'lead') {
      const answered = !!call.answered_at
      const source = leadEndSource(pl.hangup_cause, answered, call.amd_result, pl.hangup_source)
      // A lead leg that failed fast must not take the agent leg down under the
      // floor, or the agent leg bills as a short call (lib/complianceHold.ts).
      if (!answered && call.agent_call_control_id && call.agent_answered_at) {
        const up = Date.now() - new Date(call.agent_answered_at).getTime()
        const wait = AGENT_LEG_MIN_SECONDS * 1000 - up
        if (wait > 0) await sleep(wait)
      }
      if (call.agent_call_control_id) await hangupLeg(cfg, call.agent_call_control_id)
      await finishCall(call, source, pl.hangup_cause || null)
      return
    }
    // The agent leg ended.
    if (call.amd_result === 'machine') return // we released it ourselves; the hold ends the lead
    if (!call.agent_answered_at && !call.answered_at) {
      // The seat's browser never picked up its own leg.
      if (call.lead_call_control_id) await hangupLeg(cfg, call.lead_call_control_id)
      await finishCall(call, 'agent_unreachable', pl.hangup_cause || null)
      return
    }
    // The agent hung up: the lead leg is parked, end it.
    if (call.lead_call_control_id) await hangupLeg(cfg, call.lead_call_control_id)
    if (!call.answered_at) await finishCall(call, 'agent', pl.hangup_cause || null)
  }
}
