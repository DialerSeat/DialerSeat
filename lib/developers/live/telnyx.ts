// =============================================================================
// THE DEVELOPER PLATFORM'S OWN TELNYX
// =============================================================================
// A separate platform from DialerSeat's: its own variables, so it can never
// pick up DialerSeat's connection by accident.
//
//   DEV_TELNYX_API_KEY                 API key (ideally a separate Telnyx account,
//                                      so balance, CPS and the account's
//                                      short-call ratio are separate too)
//   DEV_TELNYX_CONNECTION_ID           Call Control application both legs dial on
//   DEV_TELNYX_CREDENTIAL_CONNECTION_ID SIP connection seat credentials hang off
//   DEV_TELNYX_PUBLIC_KEY              webhook signing key (ed25519, base64)
//   DEV_TELNYX_SIP_DOMAIN              default sip.telnyx.com
//   DEV_TELNYX_SIP_WSS_URL             default wss://<sip domain>:7443
//   DEV_TELNYX_WEBHOOK_URL             default https://dev.dialerseat.com/api/v1/embed/live/telnyx
//
// DialerSeat's leg watchdog and concurrency count only scan
// TELNYX_CONNECTION_ID, so legs on DEV_TELNYX_CONNECTION_ID are invisible to
// them: never ended as strays, never counted against DialerSeat's agents.
//
// The request shapes below are the ones DialerSeat runs in production
// (lib/placeOutboundCall.ts, lib/agentSipCredentials.ts), copied rather than
// imported so a change to either platform cannot silently change the other.
// =============================================================================

import 'server-only'
import nacl from 'tweetnacl'

const TELNYX = 'https://api.telnyx.com/v2'

export interface LiveConfig {
  apiKey: string
  connectionId: string
  credentialConnectionId: string
  publicKey: string
  sipDomain: string
  sipWssUrl: string
  webhookUrl: string
}

export function liveConfig(): { ok: true; config: LiveConfig } | { ok: false; missing: string[] } {
  const e = process.env
  const missing = ['DEV_TELNYX_API_KEY', 'DEV_TELNYX_CONNECTION_ID', 'DEV_TELNYX_CREDENTIAL_CONNECTION_ID', 'DEV_TELNYX_PUBLIC_KEY']
    .filter(k => !e[k]?.trim())
  if (missing.length) return { ok: false, missing }
  const sipDomain = e.DEV_TELNYX_SIP_DOMAIN?.trim() || 'sip.telnyx.com'
  return {
    ok: true,
    config: {
      apiKey: e.DEV_TELNYX_API_KEY!.trim(),
      connectionId: e.DEV_TELNYX_CONNECTION_ID!.trim(),
      credentialConnectionId: e.DEV_TELNYX_CREDENTIAL_CONNECTION_ID!.trim(),
      publicKey: e.DEV_TELNYX_PUBLIC_KEY!.trim(),
      sipDomain,
      sipWssUrl: e.DEV_TELNYX_SIP_WSS_URL?.trim() || `wss://${sipDomain}:7443`,
      webhookUrl: e.DEV_TELNYX_WEBHOOK_URL?.trim() || 'https://dev.dialerseat.com/api/v1/embed/live/telnyx',
    },
  }
}

export interface TelnyxResult<T> { ok: boolean; status: number; data: T | null; error: string | null }

export async function telnyx<T>(cfg: LiveConfig, path: string, init?: { method?: string; body?: unknown }): Promise<TelnyxResult<T>> {
  try {
    const res = await fetch(TELNYX + path, {
      method: init?.method || 'GET',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json().catch(() => null) as { data?: T; errors?: { title?: string; detail?: string; code?: string }[] } | null
    const err = json?.errors?.length ? json.errors.map(x => [x.code, x.title, x.detail].filter(Boolean).join(' ')).join('; ') : null
    return { ok: res.ok, status: res.status, data: (json?.data ?? null) as T | null, error: res.ok ? null : (err || `HTTP ${res.status}`) }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : 'request failed' }
  }
}

// ── client_state: ours, and tagged so a stray webhook is never mistaken ──

export interface LegState { k: 'dsdev'; c: string; r: 'agent' | 'lead' }

export function encodeState(callId: string, role: 'agent' | 'lead'): string {
  return Buffer.from(JSON.stringify({ k: 'dsdev', c: callId, r: role } satisfies LegState), 'utf8').toString('base64')
}

export function decodeState(raw: unknown): LegState | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    return v?.k === 'dsdev' && typeof v.c === 'string' && (v.r === 'agent' || v.r === 'lead') ? v : null
  } catch { return null }
}

// ── commands ──────────────────────────────────────────────────────────────

export async function hangupLeg(cfg: LiveConfig, ccid: string): Promise<boolean> {
  // Two tries: a hangup that fails leaves a leg billing. 404/422 mean it is
  // already gone, which is the outcome we wanted.
  for (let i = 0; i < 2; i++) {
    const r = await telnyx(cfg, `/calls/${encodeURIComponent(ccid)}/actions/hangup`, { method: 'POST', body: {} })
    if (r.ok || r.status === 404 || r.status === 422) return true
  }
  return false
}

// ── webhook signatures (the same scheme DialerSeat verifies) ─────────────

export function verifyTelnyxSignature(cfg: LiveConfig, req: Request, rawBody: string): boolean {
  const sig = req.headers.get('telnyx-signature-ed25519')
  const ts = req.headers.get('telnyx-timestamp')
  if (!sig || !ts || !/^\d+$/.test(ts)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(`${ts}|${rawBody}`),
      new Uint8Array(Buffer.from(sig, 'base64')),
      new Uint8Array(Buffer.from(cfg.publicKey, 'base64')),
    )
  } catch { return false }
}
