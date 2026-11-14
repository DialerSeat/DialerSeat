// =============================================================================
// DEVELOPER PLATFORM STORAGE
// =============================================================================
// One interface, two backends:
//   - Supabase: the dev_* tables in db/migrations/2026-11-13-developer-platform.sql.
//   - Local file: .dev-platform-store.json, used ONLY when DEV_PLATFORM_STORE=local
//     on a developer's machine, so the console can be worked on end to end
//     without the tables existing in production. Refused in production.
//
// Every read is scoped by platform id, and the platform is always resolved from
// the signed-in user or the presented API key — never from a request body.
// =============================================================================

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase'
import type { DialMode } from './catalog'

export type Env = 'test' | 'live'
export type LiveStatus = 'not_activated' | 'requested' | 'active' | 'past_due' | 'paused'
export type BillingModel = 'user' | 'platform' | 'mixed'
export type Tier = 'sandbox' | 'launch' | 'scale' | 'partner'

export interface Platform {
  id: string
  owner_user_id: string
  name: string
  slug: string
  website: string | null
  activated_at: string
  live_status: LiveStatus
  live_requested_at: string | null
  live_activated_at: string | null
  tier: Tier
  billing_model: BillingModel
  default_dial_mode: DialMode
  allowed_dial_modes: DialMode[]
  seats_may_choose_mode: boolean
  allowed_origins: string[]
  rate_seat_week: number | null
  rate_included_dials: number | null
  rate_per_dial: number | null
  revenue_share_pct: number | null
  notes: string | null
  /** The signup survey: what the project is and what it is for. */
  profile: ProjectProfile
  integration_approach: Approach | null
  setup_completed_at: string | null
  /** How DialerSeat's cut is worked out once sales sets a rate. */
  cut_model: 'seat_week' | 'revenue_share'
  created_at: string
  updated_at: string
}

export type Approach = 'script' | 'iframe' | 'react' | 'headless' | 'hosted'

export interface ProjectProfile {
  kind?: string
  audience?: string[]
  goals?: string[]
  modes?: string[]
  billing?: string
  size?: string
  stack?: string[]
}

export interface DevAccount {
  user_id: string
  activated_at: string
  current_platform_id: string | null
}

export type LedgerKind = 'signup' | 'renewal' | 'refund' | 'owner_payment' | 'adjustment'

export interface LedgerRow {
  id: string
  platform_id: string
  env: Env
  kind: LedgerKind
  seat_id: string | null
  external_user_id: string | null
  external_subscription_id: string | null
  /** What the platform's user paid the platform. Negative for a refund. */
  customer_amount_cents: number | null
  /** DialerSeat's cut, owed by the owner. Negative for a payment or credit. Null: no rate set yet. */
  fee_cents: number | null
  currency: string
  period_start: string | null
  period_end: string | null
  source: 'api' | 'stripe' | 'checkout' | 'console'
  idempotency_key: string | null
  note: string | null
  created_at: string
}

export interface BillingSource {
  id: string
  platform_id: string
  env: Env
  kind: 'stripe'
  token: string
  signing_secret: string | null
  created_at: string
  last_event_at: string | null
  disabled_at: string | null
}

export interface ApiKey {
  id: string
  platform_id: string
  kind: 'secret' | 'publishable'
  env: Env
  name: string
  key_hash: string | null
  token: string | null
  prefix: string
  last4: string
  scopes: string[]
  created_by: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface WebhookEndpoint {
  id: string
  platform_id: string
  env: Env
  url: string
  description: string | null
  events: string[]
  signing_secret: string
  created_at: string
  disabled_at: string | null
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  event_type: string
  payload: unknown
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  next_attempt_at: string | null
  last_status_code: number | null
  last_error: string | null
  delivered_at: string | null
  created_at: string
}

export interface DialModeException {
  id: string
  platform_id: string
  scope: 'seat' | 'campaign'
  external_id: string
  dial_mode: DialMode | null
  allowed_modes: DialMode[] | null
  note: string | null
  created_at: string
}

export interface Disposition {
  id: string
  platform_id: string
  code: string
  label: string
  outcome: string
  sort: number
  created_at: string
}

export interface Seat {
  id: string
  platform_id: string
  env: Env
  external_user_id: string
  user_id: string | null
  email: string | null
  name: string | null
  status: 'pending' | 'active' | 'past_due' | 'disabled'
  billed_to: 'user' | 'platform'
  /** The end of the period the platform's user has paid for. Null: not billed through us. */
  paid_through: string | null
  external_subscription_id: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

type SeatBilling = 'status' | 'paid_through' | 'external_subscription_id' | 'canceled_at'

export interface SeatSession {
  id: string
  seat_id: string
  token_hash: string
  expires_at: string
  used_at: string | null
  /** Leads the platform's server sent with the session (hosted link and plain iframe). */
  leads?: SessionLead[] | null
  campaign?: string | null
  created_at: string
}

export interface SessionLead { external_id?: string; first_name?: string; last_name?: string; phone: string; state?: string; company?: string; note?: string }

export interface CampaignLink {
  id: string
  platform_id: string
  env: Env
  external_id: string
  campaign_id: string | null
  name: string
  dial_mode: DialMode | null
  created_at: string
}

export interface DevCall {
  id: string
  platform_id: string
  seat_id: string
  env: Env
  campaign_external_id: string | null
  lead_external_id: string | null
  phone: string
  from_number: string | null
  dial_mode: string | null
  status: 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed'
  amd_enabled: boolean
  amd_result: string | null
  agent_call_control_id: string | null
  lead_call_control_id: string | null
  agent_answered_at: string | null
  answered_at: string | null
  ended_at: string | null
  hangup_source: string | null
  hangup_cause: string | null
  talk_seconds: number | null
  disposition_code: string | null
  disposition_outcome: string | null
  notes: string | null
  created_at: string
}

export type DevCallPatch = Partial<Omit<DevCall, 'id' | 'platform_id' | 'seat_id' | 'env' | 'created_at'>>

export interface DevNumber { id: string; phone: string; platform_id: string | null; area_code: string; active: boolean; last_used_at: string | null }

export interface SeatCredential { seat_id: string; telnyx_credential_id: string; sip_username: string }

export interface RequestLogRow {
  id: number
  platform_id: string
  key_id: string | null
  env: Env
  method: string
  path: string
  status: number
  duration_ms: number | null
  created_at: string
}

export type PlatformPatch = Partial<Pick<Platform,
  'name' | 'website' | 'billing_model' | 'default_dial_mode' | 'allowed_dial_modes' |
  'seats_may_choose_mode' | 'allowed_origins' | 'live_status' | 'live_requested_at' |
  'profile' | 'integration_approach' | 'setup_completed_at'>>

export type NewPlatform = { owner_user_id: string; name: string; slug: string; website: string | null; profile?: ProjectProfile; integration_approach?: Approach | null }

export interface DevStore {
  readonly backend: 'supabase' | 'local'
  /** The DialerSeat users.id for a Clerk user, or null if the users row does not exist yet. */
  resolveUserId(clerkUserId: string): Promise<string | null>

  getAccount(userId: string): Promise<DevAccount | null>
  createAccount(userId: string): Promise<DevAccount>
  setCurrentPlatform(userId: string, platformId: string): Promise<void>
  /** Every project the user owns, oldest first. */
  listPlatformsByOwner(userId: string): Promise<Platform[]>
  getPlatform(id: string): Promise<Platform | null>
  createPlatform(input: NewPlatform): Promise<Platform>
  updatePlatform(id: string, patch: PlatformPatch): Promise<Platform>
  slugTaken(slug: string): Promise<boolean>

  listKeys(platformId: string): Promise<ApiKey[]>
  insertKey(row: Omit<ApiKey, 'id' | 'created_at' | 'last_used_at' | 'revoked_at'>): Promise<ApiKey>
  revokeKey(platformId: string, keyId: string): Promise<ApiKey | null>
  findKeyByHash(hash: string): Promise<ApiKey | null>
  findKeyByToken(token: string): Promise<ApiKey | null>
  touchKey(keyId: string): Promise<void>

  listWebhooks(platformId: string): Promise<WebhookEndpoint[]>
  insertWebhook(row: Omit<WebhookEndpoint, 'id' | 'created_at' | 'disabled_at'>): Promise<WebhookEndpoint>
  setWebhookDisabled(platformId: string, id: string, disabled: boolean): Promise<WebhookEndpoint | null>
  deleteWebhook(platformId: string, id: string): Promise<void>
  insertDelivery(row: Omit<WebhookDelivery, 'id' | 'created_at'>): Promise<WebhookDelivery>
  listDeliveries(endpointIds: string[], limit: number): Promise<WebhookDelivery[]>
  /** Pending deliveries whose next attempt is due, oldest first, with their endpoint. */
  dueDeliveries(limit: number): Promise<{ delivery: WebhookDelivery; endpoint: WebhookEndpoint }[]>
  updateDelivery(id: string, patch: Partial<Omit<WebhookDelivery, 'id' | 'endpoint_id' | 'created_at'>>): Promise<void>

  listExceptions(platformId: string): Promise<DialModeException[]>
  upsertException(row: Omit<DialModeException, 'id' | 'created_at'>): Promise<DialModeException>
  deleteException(platformId: string, id: string): Promise<void>

  listDispositions(platformId: string): Promise<Disposition[]>
  upsertDisposition(row: Omit<Disposition, 'id' | 'created_at'>): Promise<Disposition>
  deleteDisposition(platformId: string, id: string): Promise<void>

  listSeats(platformId: string, env?: Env): Promise<Seat[]>
  getSeat(platformId: string, id: string): Promise<Seat | null>
  upsertSeat(row: Omit<Seat, 'id' | 'created_at' | 'updated_at' | 'user_id' | SeatBilling> & Partial<Pick<Seat, SeatBilling>>): Promise<Seat>
  updateSeat(platformId: string, id: string, patch: Partial<Pick<Seat, 'name' | 'email' | 'billed_to' | SeatBilling>>): Promise<Seat | null>
  findSeatBySubscription(platformId: string, env: Env, subscriptionId: string): Promise<Seat | null>

  insertSession(row: Omit<SeatSession, 'id' | 'created_at' | 'used_at'>): Promise<SeatSession>
  findSessionByHash(hash: string): Promise<SeatSession | null>
  /** Marks a session used; false if it was already used (so a token works once even under a race). */
  claimSession(id: string): Promise<boolean>
  getSeatById(id: string): Promise<Seat | null>

  listCampaignLinks(platformId: string, env: Env): Promise<CampaignLink[]>
  getCampaignLink(platformId: string, env: Env, idOrExternalId: string): Promise<CampaignLink | null>
  upsertCampaignLink(row: Omit<CampaignLink, 'id' | 'created_at' | 'campaign_id'>): Promise<CampaignLink>

  insertCall(row: Omit<DevCall, 'created_at'>): Promise<DevCall>
  getCall(id: string): Promise<DevCall | null>
  findCallByControlId(ccid: string): Promise<{ call: DevCall; leg: 'agent' | 'lead' } | null>
  /**
   * Apply a patch. With `onlyIfNotEnded`, nothing changes once ended_at is set,
   * and the return is null: that is how a duplicate hangup webhook is told
   * apart from the first one, so call.ended is sent once.
   */
  updateCall(id: string, patch: DevCallPatch, opts?: { onlyIfNotEnded?: boolean }): Promise<DevCall | null>
  listCalls(platformId: string, env: Env, since: string | null, limit: number): Promise<DevCall[]>

  addDnc(platformId: string, env: Env, phone: string, source: string | null): Promise<void>
  isDnc(platformId: string, env: Env, phone: string): Promise<boolean>

  listCallerIds(platformId: string): Promise<DevNumber[]>
  markCallerIdUsed(id: string): Promise<void>

  getSeatCredential(seatId: string): Promise<SeatCredential | null>
  insertSeatCredential(row: SeatCredential): Promise<boolean>

  /** Records a ledger row once per idempotency key; a repeat returns the first row with duplicate true. */
  insertLedger(row: Omit<LedgerRow, 'id' | 'created_at'>): Promise<{ row: LedgerRow; duplicate: boolean }>
  listLedger(platformId: string, env: Env, limit: number): Promise<LedgerRow[]>
  hasLedgerForSubscription(platformId: string, env: Env, subscriptionId: string): Promise<boolean>

  getBillingSource(platformId: string, env: Env): Promise<BillingSource | null>
  upsertBillingSource(row: Pick<BillingSource, 'platform_id' | 'env' | 'kind' | 'token' | 'signing_secret'>): Promise<BillingSource>
  findBillingSourceByToken(token: string): Promise<BillingSource | null>
  touchBillingSource(id: string): Promise<void>

  logRequest(row: Omit<RequestLogRow, 'id' | 'created_at'>): Promise<void>
  listRequests(platformId: string, limit: number): Promise<RequestLogRow[]>
}

const now = () => new Date().toISOString()

// ── LOCAL FILE BACKEND ────────────────────────────────────────────────

interface LocalData {
  users: Record<string, string>
  platforms: Platform[]
  keys: ApiKey[]
  webhooks: WebhookEndpoint[]
  deliveries: WebhookDelivery[]
  exceptions: DialModeException[]
  dispositions: Disposition[]
  seats: Seat[]
  sessions: SeatSession[]
  campaigns: CampaignLink[]
  calls: DevCall[]
  dnc: { platform_id: string; env: Env; phone: string; source: string | null; created_at: string }[]
  numbers: DevNumber[]
  credentials: SeatCredential[]
  requests: RequestLogRow[]
  accounts: DevAccount[]
  ledger: LedgerRow[]
  sources: BillingSource[]
}

const LOCAL_FILE = path.join(process.cwd(), '.dev-platform-store.json')

// The queue lives on globalThis: a hot reload makes a second copy of this
// module, and two queues writing one file is how the first version of this
// store wiped itself.
const g = globalThis as unknown as { __devStoreQueue?: Promise<unknown> }
g.__devStoreQueue ??= Promise.resolve()

const EMPTY = (): LocalData => ({ users: {}, platforms: [], keys: [], webhooks: [], deliveries: [], exceptions: [], dispositions: [], seats: [], sessions: [], campaigns: [], calls: [], dnc: [], numbers: [], credentials: [], requests: [], accounts: [], ledger: [], sources: [] })

async function readLocal(): Promise<LocalData> {
  let text: string
  try {
    text = await fs.readFile(LOCAL_FILE, 'utf8')
  } catch (e) {
    // Only a missing file means "start empty". Anything else must not be
    // mistaken for empty, or the next write would save nothing over everything.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY()
    throw e
  }
  return { ...EMPTY(), ...(JSON.parse(text) as Partial<LocalData>) }
}

/** Serialise every read-modify-write, and write atomically (temp file, then rename). */
function withLocal<T>(fn: (d: LocalData) => T | Promise<T>, write = false): Promise<T> {
  const run = g.__devStoreQueue!.then(async () => {
    const d = await readLocal()
    const out = await fn(d)
    if (write) {
      const tmp = `${LOCAL_FILE}.${process.pid}.tmp`
      await fs.writeFile(tmp, JSON.stringify(d, null, 2))
      // Windows refuses a rename over a file another request has open
      // (EPERM / EBUSY). Retry briefly; as a last resort write in place,
      // which is safe here because the queue above serialises every write.
      for (let attempt = 0; ; attempt++) {
        try { await fs.rename(tmp, LOCAL_FILE); break } catch (e) {
          const code = (e as NodeJS.ErrnoException).code
          if ((code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') && attempt < 5) { await new Promise(r => setTimeout(r, 25 * (attempt + 1))); continue }
          await fs.writeFile(LOCAL_FILE, await fs.readFile(tmp, 'utf8'))
          await fs.rm(tmp, { force: true })
          break
        }
      }
    }
    return out
  })
  g.__devStoreQueue = run.catch(() => undefined)
  return run
}

function platformDefaults(input: NewPlatform): Platform {
  const t = now()
  return {
    id: randomUUID(), ...input, profile: input.profile || {}, integration_approach: input.integration_approach ?? null,
    setup_completed_at: null, cut_model: 'seat_week', activated_at: t, live_status: 'not_activated', live_requested_at: null,
    live_activated_at: null, tier: 'sandbox', billing_model: 'platform', default_dial_mode: 'power',
    allowed_dial_modes: ['preview', 'progressive', 'power', 'predictive'], seats_may_choose_mode: true,
    allowed_origins: [], rate_seat_week: null, rate_included_dials: null, rate_per_dial: null,
    revenue_share_pct: null, notes: null, created_at: t, updated_at: t,
  }
}

const localStore: DevStore = {
  backend: 'local',
  resolveUserId: (clerkId) => withLocal(d => {
    if (!d.users[clerkId]) d.users[clerkId] = randomUUID()
    return d.users[clerkId]
  }, true),
  getAccount: (uid) => withLocal(d => {
    const a = d.accounts.find(x => x.user_id === uid)
    if (a) return a
    // Files written before accounts existed: an owner of a project is activated.
    const first = d.platforms.find(p => p.owner_user_id === uid)
    return first ? { user_id: uid, activated_at: first.activated_at, current_platform_id: first.id } : null
  }),
  createAccount: (uid) => withLocal(d => {
    const ex = d.accounts.find(x => x.user_id === uid); if (ex) return ex
    const a = { user_id: uid, activated_at: now(), current_platform_id: d.platforms.find(p => p.owner_user_id === uid)?.id ?? null }
    d.accounts.push(a); return a
  }, true),
  setCurrentPlatform: (uid, pid) => withLocal(d => {
    let a = d.accounts.find(x => x.user_id === uid)
    if (!a) { a = { user_id: uid, activated_at: now(), current_platform_id: null }; d.accounts.push(a) }
    a.current_platform_id = pid
  }, true),
  listPlatformsByOwner: (uid) => withLocal(d => d.platforms.filter(p => p.owner_user_id === uid).map(p => ({ ...platformDefaults(p), ...p })).sort((a, b) => a.created_at.localeCompare(b.created_at))),
  getPlatform: (id) => withLocal(d => { const p = d.platforms.find(x => x.id === id); return p ? { ...platformDefaults(p), ...p } : null }),
  createPlatform: (input) => withLocal(d => { const p = platformDefaults(input); d.platforms.push(p); return p }, true),
  updatePlatform: (id, patch) => withLocal(d => {
    const p = d.platforms.find(x => x.id === id); if (!p) throw new Error('not_found')
    Object.assign(p, patch, { updated_at: now() }); return p
  }, true),
  slugTaken: (slug) => withLocal(d => d.platforms.some(p => p.slug === slug)),

  listKeys: (pid) => withLocal(d => d.keys.filter(k => k.platform_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at))),
  insertKey: (row) => withLocal(d => {
    const k: ApiKey = { ...row, id: randomUUID(), created_at: now(), last_used_at: null, revoked_at: null }
    d.keys.push(k); return k
  }, true),
  revokeKey: (pid, id) => withLocal(d => {
    const k = d.keys.find(x => x.id === id && x.platform_id === pid); if (!k) return null
    if (!k.revoked_at) k.revoked_at = now(); return k
  }, true),
  findKeyByHash: (h) => withLocal(d => d.keys.find(k => k.key_hash === h) || null),
  findKeyByToken: (t) => withLocal(d => d.keys.find(k => k.token === t) || null),
  touchKey: (id) => withLocal(d => { const k = d.keys.find(x => x.id === id); if (k) k.last_used_at = now() }, true),

  listWebhooks: (pid) => withLocal(d => d.webhooks.filter(w => w.platform_id === pid)),
  insertWebhook: (row) => withLocal(d => { const w = { ...row, id: randomUUID(), created_at: now(), disabled_at: null }; d.webhooks.push(w); return w }, true),
  setWebhookDisabled: (pid, id, off) => withLocal(d => {
    const w = d.webhooks.find(x => x.id === id && x.platform_id === pid); if (!w) return null
    w.disabled_at = off ? now() : null; return w
  }, true),
  deleteWebhook: (pid, id) => withLocal(d => {
    d.webhooks = d.webhooks.filter(x => !(x.id === id && x.platform_id === pid))
    d.deliveries = d.deliveries.filter(x => x.endpoint_id !== id)
  }, true),
  insertDelivery: (row) => withLocal(d => { const x = { ...row, id: randomUUID(), created_at: now() }; d.deliveries.push(x); return x }, true),
  listDeliveries: (ids, limit) => withLocal(d => d.deliveries.filter(x => ids.includes(x.endpoint_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)),
  dueDeliveries: (limit) => withLocal(d => {
    const t = now()
    return d.deliveries
      .filter(x => x.status === 'pending' && x.next_attempt_at && x.next_attempt_at <= t)
      .sort((a, b) => (a.next_attempt_at || '').localeCompare(b.next_attempt_at || ''))
      .slice(0, limit)
      .flatMap(x => { const endpoint = d.webhooks.find(w => w.id === x.endpoint_id); return endpoint ? [{ delivery: x, endpoint }] : [] })
  }),
  updateDelivery: (id, patch) => withLocal(d => { const x = d.deliveries.find(r => r.id === id); if (x) Object.assign(x, patch) }, true),

  listExceptions: (pid) => withLocal(d => d.exceptions.filter(x => x.platform_id === pid)),
  upsertException: (row) => withLocal(d => {
    const ex = d.exceptions.find(x => x.platform_id === row.platform_id && x.scope === row.scope && x.external_id === row.external_id)
    if (ex) { Object.assign(ex, row); return ex }
    const n = { ...row, id: randomUUID(), created_at: now() }; d.exceptions.push(n); return n
  }, true),
  deleteException: (pid, id) => withLocal(d => { d.exceptions = d.exceptions.filter(x => !(x.id === id && x.platform_id === pid)) }, true),

  listDispositions: (pid) => withLocal(d => d.dispositions.filter(x => x.platform_id === pid).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))),
  upsertDisposition: (row) => withLocal(d => {
    const ex = d.dispositions.find(x => x.platform_id === row.platform_id && x.code === row.code)
    if (ex) { Object.assign(ex, row); return ex }
    const n = { ...row, id: randomUUID(), created_at: now() }; d.dispositions.push(n); return n
  }, true),
  deleteDisposition: (pid, id) => withLocal(d => { d.dispositions = d.dispositions.filter(x => !(x.id === id && x.platform_id === pid)) }, true),

  listSeats: (pid, env) => withLocal(d => d.seats.filter(s => s.platform_id === pid && (!env || s.env === env)).sort((a, b) => b.created_at.localeCompare(a.created_at))),
  getSeat: (pid, id) => withLocal(d => d.seats.find(s => s.platform_id === pid && s.id === id) || null),
  upsertSeat: (row) => withLocal(d => {
    const ex = d.seats.find(s => s.platform_id === row.platform_id && s.env === row.env && s.external_user_id === row.external_user_id)
    if (ex) {
      Object.assign(ex, { email: row.email ?? ex.email, name: row.name ?? ex.name, billed_to: row.billed_to, updated_at: now() })
      for (const k of ['status', 'paid_through', 'external_subscription_id', 'canceled_at'] as const) if (row[k] !== undefined) Object.assign(ex, { [k]: row[k] })
      return ex
    }
    const t = now()
    const s: Seat = { paid_through: null, external_subscription_id: null, canceled_at: null, ...row, status: row.status || 'pending', id: randomUUID(), user_id: null, created_at: t, updated_at: t }
    d.seats.push(s); return s
  }, true),
  updateSeat: (pid, id, patch) => withLocal(d => {
    const s = d.seats.find(x => x.platform_id === pid && x.id === id); if (!s) return null
    Object.assign(s, patch, { updated_at: now() }); return s
  }, true),

  insertSession: (row) => withLocal(d => { const s = { ...row, id: randomUUID(), used_at: null, created_at: now() }; d.sessions.push(s); return s }, true),
  findSessionByHash: (h) => withLocal(d => d.sessions.find(x => x.token_hash === h) || null),
  claimSession: (id) => withLocal(d => {
    const x = d.sessions.find(y => y.id === id)
    if (!x || x.used_at) return false
    x.used_at = now(); return true
  }, true),
  getSeatById: (id) => withLocal(d => d.seats.find(x => x.id === id) || null),
  findSeatBySubscription: (pid, env, sub) => withLocal(d => d.seats.find(x => x.platform_id === pid && x.env === env && x.external_subscription_id === sub) || null),

  listCampaignLinks: (pid, env) => withLocal(d => (d.campaigns || []).filter(c => c.platform_id === pid && c.env === env).sort((a, b) => b.created_at.localeCompare(a.created_at))),
  getCampaignLink: (pid, env, key) => withLocal(d => (d.campaigns || []).find(c => c.platform_id === pid && c.env === env && (c.id === key || c.external_id === key)) || null),
  upsertCampaignLink: (row) => withLocal(d => {
    d.campaigns = d.campaigns || []
    const ex = d.campaigns.find(c => c.platform_id === row.platform_id && c.env === row.env && c.external_id === row.external_id)
    if (ex) { Object.assign(ex, row); return ex }
    const n: CampaignLink = { ...row, id: randomUUID(), campaign_id: null, created_at: now() }; d.campaigns.push(n); return n
  }, true),

  insertCall: (row) => withLocal(d => { const c: DevCall = { ...row, created_at: now() }; d.calls.push(c); if (d.calls.length > 5000) d.calls = d.calls.slice(-5000); return c }, true),
  getCall: (id) => withLocal(d => d.calls.find(c => c.id === id) || null),
  findCallByControlId: (ccid) => withLocal(d => {
    const c = d.calls.find(x => x.lead_call_control_id === ccid || x.agent_call_control_id === ccid)
    if (!c) return null
    const leg: 'agent' | 'lead' = c.agent_call_control_id === ccid ? 'agent' : 'lead'
    return { call: c, leg }
  }),
  updateCall: (id, patch, opts) => withLocal(d => {
    const c = d.calls.find(x => x.id === id); if (!c) return null
    if (opts?.onlyIfNotEnded && c.ended_at) return null
    Object.assign(c, patch); return c
  }, true),
  listCalls: (pid, env, since, limit) => withLocal(d => d.calls
    .filter(c => c.platform_id === pid && c.env === env && (!since || c.created_at >= since))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)),

  addDnc: (pid, env, phone, source) => withLocal(d => {
    if (!d.dnc.some(x => x.platform_id === pid && x.env === env && x.phone === phone)) d.dnc.push({ platform_id: pid, env, phone, source, created_at: now() })
  }, true),
  isDnc: (pid, env, phone) => withLocal(d => d.dnc.some(x => x.platform_id === pid && x.env === env && x.phone === phone)),

  listCallerIds: (pid) => withLocal(d => d.numbers.filter(n => n.active && (n.platform_id === pid || n.platform_id === null))),
  markCallerIdUsed: (id) => withLocal(d => { const n = d.numbers.find(x => x.id === id); if (n) n.last_used_at = now() }, true),

  getSeatCredential: (seatId) => withLocal(d => d.credentials.find(c => c.seat_id === seatId) || null),
  insertSeatCredential: (row) => withLocal(d => {
    if (d.credentials.some(c => c.seat_id === row.seat_id)) return false
    d.credentials.push(row); return true
  }, true),

  insertLedger: (row) => withLocal(d => {
    const ex = row.idempotency_key ? d.ledger.find(x => x.platform_id === row.platform_id && x.env === row.env && x.idempotency_key === row.idempotency_key) : null
    if (ex) return { row: ex, duplicate: true }
    const x = { ...row, id: randomUUID(), created_at: now() }; d.ledger.push(x); return { row: x, duplicate: false }
  }, true),
  listLedger: (pid, env, limit) => withLocal(d => d.ledger.filter(x => x.platform_id === pid && x.env === env).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)),
  hasLedgerForSubscription: (pid, env, sub) => withLocal(d => d.ledger.some(x => x.platform_id === pid && x.env === env && x.external_subscription_id === sub)),
  getBillingSource: (pid, env) => withLocal(d => d.sources.find(x => x.platform_id === pid && x.env === env && !x.disabled_at) || null),
  upsertBillingSource: (row) => withLocal(d => {
    const ex = d.sources.find(x => x.platform_id === row.platform_id && x.env === row.env && x.kind === row.kind)
    if (ex) { Object.assign(ex, row, { disabled_at: null }); return ex }
    const x: BillingSource = { ...row, id: randomUUID(), created_at: now(), last_event_at: null, disabled_at: null }; d.sources.push(x); return x
  }, true),
  findBillingSourceByToken: (t) => withLocal(d => d.sources.find(x => x.token === t && !x.disabled_at) || null),
  touchBillingSource: (id) => withLocal(d => { const x = d.sources.find(y => y.id === id); if (x) x.last_event_at = now() }, true),
  logRequest: (row) => withLocal(d => {
    d.requests.push({ ...row, id: (d.requests.at(-1)?.id || 0) + 1, created_at: now() })
    if (d.requests.length > 2000) d.requests = d.requests.slice(-2000)
  }, true),
  listRequests: (pid, limit) => withLocal(d => d.requests.filter(r => r.platform_id === pid).slice(-limit).reverse()),
}

// ── SUPABASE BACKEND ─────────────────────────────────────────────────

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

function supabaseStore(): DevStore {
  const db = getServiceClient('developers')
  return {
    backend: 'supabase',
    async resolveUserId(clerkId) {
      const r = await db.from('users').select('id').eq('clerk_id', clerkId).maybeSingle()
      return (must(r, 'users') as { id: string } | null)?.id ?? null
    },
    async getAccount(uid) {
      return must(await db.from('dev_accounts').select('*').eq('user_id', uid).maybeSingle(), 'account') as DevAccount | null
    },
    async createAccount(uid) {
      must(await db.from('dev_accounts').upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true }), 'create account')
      return must(await db.from('dev_accounts').select('*').eq('user_id', uid).single(), 'account') as DevAccount
    },
    async setCurrentPlatform(uid, pid) {
      must(await db.from('dev_accounts').upsert({ user_id: uid, current_platform_id: pid }, { onConflict: 'user_id' }), 'current project')
    },
    async listPlatformsByOwner(uid) {
      return must(await db.from('dev_platforms').select('*').eq('owner_user_id', uid).order('created_at'), 'projects') as Platform[]
    },
    async getPlatform(id) {
      return must(await db.from('dev_platforms').select('*').eq('id', id).maybeSingle(), 'platform') as Platform | null
    },
    async createPlatform(input) {
      return must(await db.from('dev_platforms').insert(input).select('*').single(), 'create platform') as Platform
    },
    async updatePlatform(id, patch) {
      return must(await db.from('dev_platforms').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single(), 'update platform') as Platform
    },
    async slugTaken(slug) {
      const r = await db.from('dev_platforms').select('id').eq('slug', slug).maybeSingle()
      return !!must(r, 'slug')
    },

    async listKeys(pid) {
      return must(await db.from('dev_api_keys').select('*').eq('platform_id', pid).order('created_at', { ascending: false }), 'keys') as ApiKey[]
    },
    async insertKey(row) {
      return must(await db.from('dev_api_keys').insert(row).select('*').single(), 'insert key') as ApiKey
    },
    async revokeKey(pid, id) {
      const r = await db.from('dev_api_keys').update({ revoked_at: now() }).eq('platform_id', pid).eq('id', id).is('revoked_at', null).select('*').maybeSingle()
      return must(r, 'revoke key') as ApiKey | null
    },
    async findKeyByHash(h) {
      return must(await db.from('dev_api_keys').select('*').eq('key_hash', h).maybeSingle(), 'key') as ApiKey | null
    },
    async findKeyByToken(t) {
      return must(await db.from('dev_api_keys').select('*').eq('token', t).maybeSingle(), 'key') as ApiKey | null
    },
    async touchKey(id) {
      await db.from('dev_api_keys').update({ last_used_at: now() }).eq('id', id)
    },

    async listWebhooks(pid) {
      return must(await db.from('dev_webhook_endpoints').select('*').eq('platform_id', pid).order('created_at'), 'webhooks') as WebhookEndpoint[]
    },
    async insertWebhook(row) {
      return must(await db.from('dev_webhook_endpoints').insert(row).select('*').single(), 'insert webhook') as WebhookEndpoint
    },
    async setWebhookDisabled(pid, id, off) {
      return must(await db.from('dev_webhook_endpoints').update({ disabled_at: off ? now() : null }).eq('platform_id', pid).eq('id', id).select('*').maybeSingle(), 'webhook') as WebhookEndpoint | null
    },
    async deleteWebhook(pid, id) {
      must(await db.from('dev_webhook_endpoints').delete().eq('platform_id', pid).eq('id', id), 'delete webhook')
    },
    async insertDelivery(row) {
      return must(await db.from('dev_webhook_deliveries').insert(row).select('*').single(), 'delivery') as WebhookDelivery
    },
    async listDeliveries(ids, limit) {
      if (!ids.length) return []
      return must(await db.from('dev_webhook_deliveries').select('*').in('endpoint_id', ids).order('created_at', { ascending: false }).limit(limit), 'deliveries') as WebhookDelivery[]
    },
    async dueDeliveries(limit) {
      const rows = must(await db.from('dev_webhook_deliveries')
        .select('*, endpoint:dev_webhook_endpoints(*)')
        .eq('status', 'pending').lte('next_attempt_at', now())
        .order('next_attempt_at').limit(limit), 'due deliveries') as (WebhookDelivery & { endpoint: WebhookEndpoint | null })[]
      return rows.flatMap(({ endpoint, ...delivery }) => endpoint ? [{ delivery, endpoint }] : [])
    },
    async updateDelivery(id, patch) {
      must(await db.from('dev_webhook_deliveries').update(patch).eq('id', id), 'update delivery')
    },

    async listExceptions(pid) {
      return must(await db.from('dev_dial_mode_exceptions').select('*').eq('platform_id', pid).order('created_at'), 'exceptions') as DialModeException[]
    },
    async upsertException(row) {
      return must(await db.from('dev_dial_mode_exceptions').upsert(row, { onConflict: 'platform_id,scope,external_id' }).select('*').single(), 'exception') as DialModeException
    },
    async deleteException(pid, id) {
      must(await db.from('dev_dial_mode_exceptions').delete().eq('platform_id', pid).eq('id', id), 'delete exception')
    },

    async listDispositions(pid) {
      return must(await db.from('dev_dispositions').select('*').eq('platform_id', pid).order('sort').order('created_at'), 'dispositions') as Disposition[]
    },
    async upsertDisposition(row) {
      return must(await db.from('dev_dispositions').upsert(row, { onConflict: 'platform_id,code' }).select('*').single(), 'disposition') as Disposition
    },
    async deleteDisposition(pid, id) {
      must(await db.from('dev_dispositions').delete().eq('platform_id', pid).eq('id', id), 'delete disposition')
    },

    async listSeats(pid, env) {
      let q = db.from('dev_seats').select('*').eq('platform_id', pid)
      if (env) q = q.eq('env', env)
      return must(await q.order('created_at', { ascending: false }).limit(500), 'seats') as Seat[]
    },
    async getSeat(pid, id) {
      return must(await db.from('dev_seats').select('*').eq('platform_id', pid).eq('id', id).maybeSingle(), 'seat') as Seat | null
    },
    async upsertSeat(row) {
      const r = await db.from('dev_seats')
        .upsert({ ...row, updated_at: now() }, { onConflict: 'platform_id,env,external_user_id' })
        .select('*').single()
      return must(r, 'seat') as Seat
    },
    async updateSeat(pid, id, patch) {
      return must(await db.from('dev_seats').update({ ...patch, updated_at: now() }).eq('platform_id', pid).eq('id', id).select('*').maybeSingle(), 'seat') as Seat | null
    },

    async insertSession(row) {
      return must(await db.from('dev_seat_sessions').insert(row).select('*').single(), 'session') as SeatSession
    },

    async findSeatBySubscription(pid, env, sub) {
      return must(await db.from('dev_seats').select('*').eq('platform_id', pid).eq('env', env).eq('external_subscription_id', sub).limit(1).maybeSingle(), 'seat') as Seat | null
    },

    async findSessionByHash(h) {
      return must(await db.from('dev_seat_sessions').select('*').eq('token_hash', h).maybeSingle(), 'session') as SeatSession | null
    },
    async claimSession(id) {
      // Conditional update: only the first caller sees a row come back.
      const r = await db.from('dev_seat_sessions').update({ used_at: now() }).eq('id', id).is('used_at', null).select('id').maybeSingle()
      return !!must(r, 'claim session')
    },
    async getSeatById(id) {
      return must(await db.from('dev_seats').select('*').eq('id', id).maybeSingle(), 'seat') as Seat | null
    },

    async listCampaignLinks(pid, env) {
      return must(await db.from('dev_campaign_links').select('*').eq('platform_id', pid).eq('env', env).order('created_at', { ascending: false }), 'campaigns') as CampaignLink[]
    },
    async getCampaignLink(pid, env, key) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(key)
      const r = await db.from('dev_campaign_links').select('*').eq('platform_id', pid).eq('env', env)
        .or(isUuid ? `id.eq.${key},external_id.eq.${key}` : `external_id.eq.${key.replace(/[,()]/g, '')}`).maybeSingle()
      return must(r, 'campaign') as CampaignLink | null
    },
    async upsertCampaignLink(row) {
      return must(await db.from('dev_campaign_links').upsert(row, { onConflict: 'platform_id,env,external_id' }).select('*').single(), 'campaign') as CampaignLink
    },

    async insertCall(row) {
      return must(await db.from('dev_calls').insert(row).select('*').single(), 'insert call') as DevCall
    },
    async getCall(id) {
      return must(await db.from('dev_calls').select('*').eq('id', id).maybeSingle(), 'call') as DevCall | null
    },
    async findCallByControlId(ccid) {
      const safe = ccid.replace(/[,()]/g, '')
      const r = await db.from('dev_calls').select('*').or(`lead_call_control_id.eq.${safe},agent_call_control_id.eq.${safe}`).limit(1).maybeSingle()
      const c = must(r, 'call by control id') as DevCall | null
      if (!c) return null
      const leg: 'agent' | 'lead' = c.agent_call_control_id === ccid ? 'agent' : 'lead'
      return { call: c, leg }
    },
    async updateCall(id, patch, opts) {
      let q = db.from('dev_calls').update(patch).eq('id', id)
      if (opts?.onlyIfNotEnded) q = q.is('ended_at', null)
      return must(await q.select('*').maybeSingle(), 'update call') as DevCall | null
    },
    async listCalls(pid, env, since, limit) {
      let q = db.from('dev_calls').select('*').eq('platform_id', pid).eq('env', env)
      if (since) q = q.gte('created_at', since)
      return must(await q.order('created_at', { ascending: false }).limit(limit), 'calls') as DevCall[]
    },

    async addDnc(pid, env, phone, source) {
      must(await db.from('dev_dnc').upsert({ platform_id: pid, env, phone, source }, { onConflict: 'platform_id,env,phone', ignoreDuplicates: true }), 'dnc')
    },
    async isDnc(pid, env, phone) {
      return !!must(await db.from('dev_dnc').select('phone').eq('platform_id', pid).eq('env', env).eq('phone', phone).maybeSingle(), 'dnc check')
    },

    async listCallerIds(pid) {
      return must(await db.from('dev_numbers').select('*').eq('active', true).or(`platform_id.eq.${pid},platform_id.is.null`), 'numbers') as DevNumber[]
    },
    async markCallerIdUsed(id) {
      await db.from('dev_numbers').update({ last_used_at: now() }).eq('id', id)
    },

    async getSeatCredential(seatId) {
      return must(await db.from('dev_seat_credentials').select('seat_id, telnyx_credential_id, sip_username').eq('seat_id', seatId).maybeSingle(), 'credential') as SeatCredential | null
    },
    async insertSeatCredential(row) {
      const { error } = await db.from('dev_seat_credentials').insert(row)
      return !error
    },

    async insertLedger(row) {
      const r = await db.from('dev_ledger').insert(row).select('*').single()
      if (r.error && r.error.code === '23505' && row.idempotency_key) {
        const ex = must(await db.from('dev_ledger').select('*').eq('platform_id', row.platform_id).eq('env', row.env).eq('idempotency_key', row.idempotency_key).single(), 'ledger') as unknown as LedgerRow
        return { row: ex, duplicate: true }
      }
      return { row: must(r, 'ledger') as LedgerRow, duplicate: false }
    },
    async listLedger(pid, env, limit) {
      return must(await db.from('dev_ledger').select('*').eq('platform_id', pid).eq('env', env).order('created_at', { ascending: false }).limit(limit), 'ledger') as LedgerRow[]
    },
    async hasLedgerForSubscription(pid, env, sub) {
      const r = must(await db.from('dev_ledger').select('id').eq('platform_id', pid).eq('env', env).eq('external_subscription_id', sub).limit(1), 'ledger') as { id: string }[]
      return r.length > 0
    },
    async getBillingSource(pid, env) {
      return must(await db.from('dev_billing_sources').select('*').eq('platform_id', pid).eq('env', env).is('disabled_at', null).maybeSingle(), 'billing source') as BillingSource | null
    },
    async upsertBillingSource(row) {
      return must(await db.from('dev_billing_sources').upsert({ ...row, disabled_at: null }, { onConflict: 'platform_id,env,kind' }).select('*').single(), 'billing source') as BillingSource
    },
    async findBillingSourceByToken(t) {
      return must(await db.from('dev_billing_sources').select('*').eq('token', t).is('disabled_at', null).maybeSingle(), 'billing source') as BillingSource | null
    },
    async touchBillingSource(id) {
      await db.from('dev_billing_sources').update({ last_event_at: now() }).eq('id', id)
    },

    async logRequest(row) {
      await db.from('dev_request_log').insert(row)
    },
    async listRequests(pid, limit) {
      return must(await db.from('dev_request_log').select('*').eq('platform_id', pid).order('created_at', { ascending: false }).limit(limit), 'requests') as RequestLogRow[]
    },
  }
}

let cached: DevStore | null = null

export function devStore(): DevStore {
  if (cached) return cached
  if (process.env.DEV_PLATFORM_STORE === 'local') {
    if (process.env.VERCEL_ENV === 'production') throw new Error('DEV_PLATFORM_STORE=local is refused in production')
    cached = localStore
  } else {
    cached = supabaseStore()
  }
  return cached
}
