// The developer platform's live call engine against a fake Telnyx. No network,
// no DialerSeat tables: the local store runs in a temp directory, and Telnyx,
// platform_config, the calling window and the compliance-hold timings are
// stubbed so the sequence can be checked exactly and quickly.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

vi.hoisted(() => {
  // DialerSeat's Supabase helper wants these at load; nothing here talks to it.
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://supabase.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'unused'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'unused'
})
vi.mock('server-only', () => ({}))
vi.mock('@/lib/platformConfig', () => ({
  getPlatformConfig: async () => ({
    amd_total_analysis_ms: 6000, amd_tuning_enabled: true, amd_after_greeting_silence_ms: 800,
    amd_greeting_duration_ms: 3000, amd_max_words: 8, amd_initial_silence_ms: 3000,
    amd_hold_seconds_after_machine: 8, amd_max_seconds_after_answer: 10,
  }),
}))
const callable = { allowed: true as boolean, reason: undefined as string | undefined }
vi.mock('@/lib/callingWindow', () => ({ isCallableNow: () => ({ ...callable }) }))
vi.mock('@/lib/complianceHold', () => ({ AGENT_LEG_MIN_SECONDS: 0, remainingHoldMs: () => 0 }))

type Req = { url: string; method: string; body: Record<string, unknown> | null }
let requests: Req[] = []
let ccid = 0

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input)
  const body = init?.body ? JSON.parse(String(init.body)) : null
  requests.push({ url, method: init?.method || 'GET', body })
  const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
  if (url.endsWith('/telephony_credentials') && init?.method === 'POST') return json({ data: { id: 'cred_1', sip_username: 'devseat01' } })
  if (url.includes('/telephony_credentials/cred_1')) return json({ data: { sip_password: 'pw', expired: false } })
  if (url.endsWith('/v2/calls') && init?.method === 'POST') return json({ data: { call_control_id: `cc_${++ccid}` } })
  if (url.includes('/actions/hangup')) return json({ data: { result: 'ok' } })
  if (url.startsWith('https://hooks.example')) return Promise.resolve(new Response('ok', { status: 200 }))
  return json({ errors: [{ title: 'unexpected ' + url }] }, 500)
}

// Imported after the cwd and env are set, because the store fixes its file path at load.
let store: typeof import('@/lib/developers/store')
let engine: typeof import('@/lib/developers/live/engine')
let tx: typeof import('@/lib/developers/live/telnyx')
let platformId = ''
let seat: import('@/lib/developers/store').Seat
let n = 0

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'devlive-')))
  Object.assign(process.env, {
    DEV_PLATFORM_STORE: 'local',
    DEV_TELNYX_API_KEY: 'KEY_dev', DEV_TELNYX_CONNECTION_ID: 'conn_dev_cc',
    DEV_TELNYX_CREDENTIAL_CONNECTION_ID: 'conn_dev_cred', DEV_TELNYX_PUBLIC_KEY: 'AAAA',
  })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  store = await import('@/lib/developers/store')
  engine = await import('@/lib/developers/live/engine')
  tx = await import('@/lib/developers/live/telnyx')
  const s = store.devStore()
  const owner = await s.resolveUserId('clerk_test')
  const p = await s.createPlatform({ owner_user_id: owner!, name: 'Acme', slug: 'acme', website: null })
  platformId = p.id
  await s.updatePlatform(p.id, { live_status: 'active' })
  seat = await s.upsertSeat({ platform_id: p.id, env: 'live', external_user_id: 'u1', email: null, name: 'Agent', billed_to: 'platform', status: 'active' })
  await s.insertWebhook({ platform_id: p.id, env: 'live', url: 'https://hooks.example/dialerseat', description: null, events: ['*'], signing_secret: 'dswh_x' })
  // A caller-ID number in the shared developer pool, same area code as the leads.
  const d = JSON.parse(readFileSync('.dev-platform-store.json', 'utf8'))
  d.numbers.push({ id: 'num_1', phone: '+15125550000', platform_id: null, area_code: '512', active: true, last_used_at: null })
  writeFileSync('.dev-platform-store.json', JSON.stringify(d))
})

beforeEach(() => { requests = []; callable.allowed = true })

const dials = () => requests.filter(r => r.url.endsWith('/v2/calls'))
const hangups = () => requests.filter(r => r.url.includes('/actions/hangup')).map(r => r.url.split('/calls/')[1].split('/')[0])
const platformEvents = () => requests.filter(r => r.url.startsWith('https://hooks.example')).map(r => (r.body as { type: string }).type)
const evt = (type: string, callId: string, role: 'agent' | 'lead', extra: Record<string, unknown> = {}) => ({
  data: { event_type: type, payload: { call_control_id: 'x', client_state: tx.encodeState(callId, role), ...extra } },
})

async function start(mode = 'power', phone = '+15125550101') {
  const platform = (await store.devStore().getPlatform(platformId))!
  const callId = `call_live_${String(++n).padStart(18, '0')}_${'a'.repeat(16)}`
  const r = await engine.startLiveCall({ platform, seat, callId, lead: { external_id: 'c1', phone }, campaignExternalId: 'camp', mode })
  return { r, callId }
}

describe('placing a live call', () => {
  it('dials the seat first, then the lead linked to it, as the regular dialer does', async () => {
    const { r } = await start('power')
    expect(r.ok).toBe(true)
    const [agent, lead] = dials()
    expect(agent.body).toMatchObject({ connection_id: 'conn_dev_cc', to: 'sip:devseat01@sip.telnyx.com', from: '+15125550000', timeout_secs: 30 })
    expect(lead.body).toMatchObject({
      connection_id: 'conn_dev_cc', to: '+15125550101', from: '+15125550000',
      bridge_on_answer: true, park_after_unbridge: 'self', time_limit_secs: 14400, timeout_secs: 60,
      answering_machine_detection: 'detect',
    })
    const row = (await store.devStore().getCall((r as { ok: true; call: { id: string } }).call.id))!
    expect(lead.body!.link_to).toBe(row.agent_call_control_id)
    expect(row.status).toBe('ringing')
    expect(lead.body!.answering_machine_detection_config).toMatchObject({ total_analysis_time_millis: 6000 })
    // Never DialerSeat's connection.
    expect(JSON.stringify(dials())).not.toContain(process.env.TELNYX_CONNECTION_ID || 'zzz-no-main-connection')
  })

  it('preview mode rings 60 seconds and runs no AMD; progressive rings 30–43', async () => {
    await start('preview')
    expect(dials()[1].body!.answering_machine_detection).toBeUndefined()
    requests = []
    await start('progressive')
    const t = dials()[1].body!.timeout_secs as number
    expect(t).toBeGreaterThanOrEqual(30); expect(t).toBeLessThanOrEqual(43)
  })

  it('refuses a number on the platform DNC list and a lead outside calling hours, before dialling', async () => {
    await store.devStore().addDnc(platformId, 'live', '+15125550199', 'test')
    const a = await start('power', '+15125550199')
    expect(a.r.ok).toBe(false)
    callable.allowed = false; callable.reason = 'Outside calling hours'
    const b = await start('power', '+15125550102')
    expect(b.r.ok).toBe(false)
    expect(dials()).toHaveLength(0)
  })
})

describe('following a live call through Telnyx webhooks', () => {
  it('answered, then the lead hangs up: agent leg ended, call.ended sent once', async () => {
    const { callId } = await start('power')
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'agent'))
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'lead'))
    let c = await store.devStore().getCall(callId)
    expect(c!.status).toBe('connected')
    requests = []
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'lead', { hangup_cause: 'normal_clearing', hangup_source: 'callee' }))
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'lead', { hangup_cause: 'normal_clearing', hangup_source: 'callee' })) // duplicate
    c = await store.devStore().getCall(callId)
    expect(c!.status).toBe('ended')
    expect(c!.hangup_source).toBe('lead')
    expect(hangups()).toContain(c!.agent_call_control_id)
    expect(platformEvents().filter(t => t === 'call.ended')).toHaveLength(1)
  })

  it('a machine verdict releases the agent first, then ends the held lead leg', async () => {
    const { callId } = await start('power')
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'agent'))
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'lead'))
    const before = (await store.devStore().getCall(callId))!
    requests = []
    await engine.handleTelnyxEvent(evt('call.machine.detection.ended', callId, 'lead', { result: 'machine' }))
    expect(hangups()).toEqual([before.agent_call_control_id, before.lead_call_control_id])
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'agent', {}))   // ours: ignored
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'lead', { hangup_cause: 'normal_clearing', hangup_source: 'caller' }))
    const c = await store.devStore().getCall(callId)
    expect(c!.hangup_source).toBe('amd')
    expect(c!.amd_result).toBe('machine')
    expect(c!.talk_seconds).toBe(0)
  })

  it('a busy lead ends the agent leg and reports busy', async () => {
    const { callId } = await start('power')
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'agent'))
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'lead', { hangup_cause: 'user_busy' }))
    const c = await store.devStore().getCall(callId)
    expect(c!.hangup_source).toBe('busy')
    expect(c!.answered_at).toBeNull()
  })

  it('a seat whose browser never answers its own leg: the lead is ended and the call says why', async () => {
    const { callId } = await start('power')
    const before = (await store.devStore().getCall(callId))!
    requests = []
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'agent', { hangup_cause: 'timeout' }))
    expect(hangups()).toContain(before.lead_call_control_id)
    expect((await store.devStore().getCall(callId))!.hangup_source).toBe('agent_unreachable')
  })

  it('the agent hanging up a connected call ends the parked lead leg', async () => {
    const { callId } = await start('power')
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'agent'))
    await engine.handleTelnyxEvent(evt('call.answered', callId, 'lead'))
    const before = (await store.devStore().getCall(callId))!
    requests = []
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'agent', {}))
    expect(hangups()).toContain(before.lead_call_control_id)
    await engine.handleTelnyxEvent(evt('call.hangup', callId, 'lead', { hangup_cause: 'normal_clearing', hangup_source: 'caller' }))
    expect((await store.devStore().getCall(callId))!.hangup_source).toBe('agent')
  })

  it('ignores webhooks that are not ours', async () => {
    requests = []
    await engine.handleTelnyxEvent({ data: { event_type: 'call.hangup', payload: { call_control_id: 'x', client_state: Buffer.from(JSON.stringify({ u: 'clerk_x', s: 'user_dial' })).toString('base64') } } })
    await engine.handleTelnyxEvent({ data: { event_type: 'call.hangup', payload: { call_control_id: 'x' } } })
    expect(requests).toHaveLength(0)
  })
})
