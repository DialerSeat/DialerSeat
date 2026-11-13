// =============================================================================
// WEBHOOK SIGNING AND DELIVERY
// =============================================================================
// DialerSeat-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">
// The same scheme the docs show a developer how to verify; the test in
// tests/unit/developersWebhooks.test.ts checks the docs' verifier against
// this signer, so the two cannot drift.
// =============================================================================

import { createHmac, randomUUID } from 'node:crypto'
import { WEBHOOK_EVENTS } from './catalog'

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${v1}`
}

export function isKnownEvent(type: string): boolean {
  return type === '*' || WEBHOOK_EVENTS.some(e => e.type === type)
}

/** A realistic example of an event, marked livemode: false. Used by "Send test event". */
export function sampleEvent(type: string, platformId: string) {
  const at = new Date().toISOString()
  const call = {
    id: 'call_test_' + randomUUID().slice(0, 8),
    seat: { id: 'seat_test_1', external_user_id: 'usr_829' },
    campaign: { id: 'cmp_test_1', external_id: 'crm_campaign_77' },
    lead: { external_id: 'c_5501', phone: '+15125550142' },
    dial_mode: 'power',
  }
  const data: Record<string, unknown> = (() => {
    switch (type) {
      case 'seat.activated': return { seat: { id: 'seat_test_1', external_user_id: 'usr_829', billed_to: 'user', status: 'active' } }
      case 'seat.payment_failed': return { seat: { id: 'seat_test_1', external_user_id: 'usr_829', status: 'past_due' }, access_until: at }
      case 'seat.disabled': return { seat: { id: 'seat_test_1', external_user_id: 'usr_829', status: 'disabled' } }
      case 'call.started': return { call: { ...call, started_at: at } }
      case 'call.answered': return { call: { ...call, answered_at: at, amd_result: 'human' } }
      case 'call.ended': return { call: { ...call, ended_at: at, duration_seconds: 94, talk_seconds: 81, hangup_source: 'agent' } }
      case 'call.dispositioned': return { call, disposition: { code: 'APPT_SET', label: 'Appointment set', outcome: 'conversion' }, notes: 'Tuesday 2pm' }
      case 'recording.ready': return { call: { id: call.id }, recording: { url: 'https://api.dialerseat.com/v1/calls/' + call.id + '/recording', seconds: 81, expires_at: at } }
      case 'lead.exhausted': return { lead: call.lead, campaign: call.campaign, attempts: 6 }
      case 'campaign.completed': return { campaign: { ...call.campaign, total_leads: 1200, dialled: 1200 } }
      default: return {}
    }
  })()
  return { id: 'evt_' + randomUUID().replace(/-/g, '').slice(0, 24), type, created_at: at, livemode: false, platform_id: platformId, data }
}

export interface DeliveryResult {
  ok: boolean
  status: number | null
  error: string | null
  durationMs: number
}

/** POST one signed event. 10 seconds, no redirects followed, nothing thrown. */
export async function deliver(url: string, secret: string, event: object): Promise<DeliveryResult> {
  const body = JSON.stringify(event)
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DialerSeat-Webhooks/1.0',
        'DialerSeat-Signature': signPayload(secret, body),
      },
      body,
    })
    return { ok: res.status >= 200 && res.status < 300, status: res.status, error: res.status >= 300 ? `HTTP ${res.status}` : null, durationMs: Date.now() - started }
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'TimeoutError' ? 'Timed out after 10 seconds' : e.message) : 'Request failed'
    return { ok: false, status: null, error: msg, durationMs: Date.now() - started }
  }
}

/**
 * A webhook URL we will send to. https only (http allowed for localhost while
 * building), and never an address inside our own network.
 */
export function validateWebhookUrl(raw: string): { url: string } | { error: string } {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return { error: 'That is not a full URL. Start it with https://' } }
  const host = u.hostname.toLowerCase()
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return { error: 'Webhook URLs must use https.' }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host) || host.endsWith('.internal') || host === 'metadata.google.internal') {
    return { error: 'That address is on a private network.' }
  }
  if (local && process.env.VERCEL_ENV === 'production') return { error: 'localhost cannot receive webhooks from DialerSeat. Use a tunnel such as ngrok while building.' }
  return { url: u.toString() }
}
