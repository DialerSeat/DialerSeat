// =============================================================================
// BILLING: a platform's users pay the platform; the platform pays DialerSeat
// =============================================================================
// Joshua, 13 Nov 2026: "there is a trigger api event when a user signs up to a
// service or platform with dialerseat attached which then uses that data to
// create a dialerseat user ... dialerseat takes its cut from the owner of the
// service." Platform-billed is the default.
//
//   1. One of the platform's users pays the platform (any biller).
//   2. The platform tells us: POST /v1/subscriptions, or its Stripe webhook
//      forwarded to /v1/billing/stripe/{token}.
//   3. We create or renew the seat, active through the period paid for.
//   4. DialerSeat's cut for that period goes on the project's ledger, owed by
//      the owner, paid from the console.
//
// THE CUT. Per project: a flat rate per seat-week, or a share of what the user
// paid. No rate is published yet (Joshua: "not disclosed until we crunch
// numbers"), so until sales sets one on the project, a row's fee is null and
// the console says "rate not set". Nothing is invented.
//
// PAID DAYS. A cancellation never cuts a seat short: it dials until the end of
// the period already paid for, then stops (memory: access only for paid days).
// =============================================================================

import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { devStore, type Env, type LedgerRow, type Platform, type Seat } from './store'
import { emitEvent } from './emit'

const DAY = 24 * 60 * 60 * 1000

export type Interval = 'week' | 'month' | 'year'

/** The end of a period that starts at `start` and lasts one `interval`. */
export function periodEnd(start: Date, interval: Interval): Date {
  const d = new Date(start.getTime())
  if (interval === 'week') return new Date(d.getTime() + 7 * DAY)
  if (interval === 'month') { d.setUTCMonth(d.getUTCMonth() + 1); return d }
  d.setUTCFullYear(d.getUTCFullYear() + 1); return d
}

/**
 * DialerSeat's cut of one payment, in cents, or null when the project has no
 * rate yet. Seat-week: the rate times the weeks the period covers (to the day).
 * Revenue share: the percentage of what the user paid.
 */
export function computeFee(
  p: Pick<Platform, 'cut_model' | 'rate_seat_week' | 'revenue_share_pct'>,
  customerAmountCents: number,
  start: Date,
  end: Date,
): number | null {
  if (p.cut_model === 'revenue_share') {
    if (p.revenue_share_pct == null) return null
    return Math.round((customerAmountCents * Number(p.revenue_share_pct)) / 100)
  }
  if (p.rate_seat_week == null) return null
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY))
  return Math.round(Number(p.rate_seat_week) * 100 * (days / 7))
}

export interface SubscriptionInput {
  external_user_id: string
  email?: string | null
  name?: string | null
  external_subscription_id?: string | null
  /** What the user paid the platform for this period, in cents. */
  amount: number
  currency?: string
  period_start?: Date
  period_end?: Date
  interval?: Interval
}

export interface RecordResult {
  seat: Seat
  entry: LedgerRow
  duplicate: boolean
  kind: 'signup' | 'renewal'
}

/** Steps 3 and 4: the seat through the paid period, and the cut on the ledger. Idempotent per key. */
export async function recordSubscription(
  platform: Platform, env: Env, input: SubscriptionInput,
  source: LedgerRow['source'], idempotencyKey: string | null,
): Promise<RecordResult> {
  const store = devStore()
  const start = input.period_start || new Date()
  const end = input.period_end || periodEnd(start, input.interval || 'month')
  const sub = input.external_subscription_id || null

  const renewal = sub ? await store.hasLedgerForSubscription(platform.id, env, sub) : false
  const existing = (await store.listSeats(platform.id, env)).find(s => s.external_user_id === input.external_user_id) || null
  // Never shorten paid days: a late or out-of-order event keeps the later date.
  const paidThrough = existing?.paid_through && Date.parse(existing.paid_through) > end.getTime() ? existing.paid_through : end.toISOString()

  const seat = await store.upsertSeat({
    platform_id: platform.id, env, external_user_id: input.external_user_id,
    email: input.email ?? null, name: input.name ?? null, billed_to: 'platform',
    status: 'active', paid_through: paidThrough, external_subscription_id: sub ?? existing?.external_subscription_id ?? null, canceled_at: null,
  })

  const kind: 'signup' | 'renewal' = renewal ? 'renewal' : 'signup'
  const { row: entry, duplicate } = await store.insertLedger({
    platform_id: platform.id, env, kind, seat_id: seat.id,
    external_user_id: input.external_user_id, external_subscription_id: sub,
    customer_amount_cents: Math.round(input.amount), fee_cents: computeFee(platform, input.amount, start, end),
    currency: (input.currency || 'usd').toLowerCase().slice(0, 3),
    period_start: start.toISOString(), period_end: end.toISOString(),
    source, idempotency_key: idempotencyKey, note: null,
  })

  if (!duplicate) {
    const payload = {
      seat: { id: seat.id, external_user_id: seat.external_user_id, status: seat.status, paid_through: seat.paid_through },
      subscription: { external_id: sub, kind, amount: entry.customer_amount_cents, currency: entry.currency, period_start: entry.period_start, period_end: entry.period_end },
      fee: { amount: entry.fee_cents, status: entry.fee_cents == null ? 'rate_not_set' : 'owed' },
    }
    await emitEvent(platform, env, 'subscription.recorded', payload)
    if (!existing || existing.status !== 'active') await emitEvent(platform, env, 'seat.activated', { seat: payload.seat })
  }
  // A repeat reports what the first delivery recorded.
  return { seat, entry, duplicate, kind: duplicate ? (entry.kind === 'renewal' ? 'renewal' : 'signup') : kind }
}

/** A cancellation: the seat keeps its paid days, or stops now with end_now. */
export async function cancelSubscription(
  platform: Platform, env: Env,
  by: { external_user_id?: string | null; external_subscription_id?: string | null },
  endNow: boolean,
): Promise<Seat | null> {
  const store = devStore()
  const seat = by.external_subscription_id
    ? await store.findSeatBySubscription(platform.id, env, by.external_subscription_id)
    : by.external_user_id ? (await store.listSeats(platform.id, env)).find(s => s.external_user_id === by.external_user_id) || null : null
  if (!seat) return null
  const nowIso = new Date().toISOString()
  const updated = await store.updateSeat(platform.id, seat.id, endNow
    ? { canceled_at: nowIso, paid_through: nowIso, status: 'disabled' }
    : { canceled_at: nowIso })
  if (!updated) return null
  await emitEvent(platform, env, 'subscription.canceled', {
    seat: { id: updated.id, external_user_id: updated.external_user_id, status: updated.status, paid_through: updated.paid_through },
    subscription: { external_id: updated.external_subscription_id }, access_until: updated.paid_through,
  })
  if (endNow) await emitEvent(platform, env, 'seat.disabled', { seat: { id: updated.id, external_user_id: updated.external_user_id, status: updated.status } })
  return updated
}

/** True when a platform-billed seat's paid period is over. */
export function seatLapsed(seat: Pick<Seat, 'paid_through'>, now = Date.now()): boolean {
  return !!seat.paid_through && Date.parse(seat.paid_through) <= now
}

export interface Balance {
  currency: string
  /** Fees owed minus payments made, in cents. Never counts a row with no rate. */
  due_cents: number
  fees_cents: number
  paid_cents: number
  /** Signups and renewals recorded before a rate was set. */
  rate_not_set: number
  customer_revenue_cents: number
}

export function summarise(rows: LedgerRow[]): Balance {
  let fees = 0, paid = 0, pending = 0, revenue = 0
  for (const r of rows) {
    if (r.kind === 'owner_payment') paid += -(r.fee_cents || 0)
    else if (r.fee_cents == null) pending += 1
    else fees += r.fee_cents
    if (r.kind === 'signup' || r.kind === 'renewal' || r.kind === 'refund') revenue += r.customer_amount_cents || 0
  }
  return { currency: rows[0]?.currency || 'usd', due_cents: fees - paid, fees_cents: fees, paid_cents: paid, rate_not_set: pending, customer_revenue_cents: revenue }
}

export async function balanceFor(platform: Platform, env: Env): Promise<{ balance: Balance; rows: LedgerRow[] }> {
  const rows = await devStore().listLedger(platform.id, env, 5000)
  return { balance: summarise(rows), rows }
}

// ── STRIPE FORWARDING ────────────────────────────────────────────────────
// A platform that bills on Stripe adds an endpoint in its own Stripe account
// (Snapshot payload) pointing at /v1/billing/stripe/{token}, and pastes that
// endpoint's whsec_ signing secret into the console. Verified per Stripe's
// docs (docs.stripe.com/webhooks#verify-manually, read 14 Nov 2026): the
// Stripe-Signature header holds t= and one or more v1=; v1 is HMAC-SHA256 of
// "t.rawBody" keyed with the whsec_ secret as given; 5-minute tolerance; every
// other entry (v0, secret, destination, payload) is ignored.

export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false
  let t: number | null = null
  const sigs: string[] = []
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim()
    if (k === 't') t = Number(v)
    else if (k === 'v1') sigs.push(v)
  }
  if (t == null || !Number.isFinite(t) || !sigs.length) return false
  if (Math.abs(nowSec - t) > toleranceSec) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'))
  return sigs.some(s => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected) })
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const text = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** The subscription id and its metadata from an invoice, on old and new API versions. */
export function invoiceSubscription(inv: Obj): { id: string | null; metadata: Obj } {
  const parent = obj(obj(inv.parent).subscription_details)
  const legacyDetails = obj(inv.subscription_details)
  const id = text(parent.subscription) || text(inv.subscription) || (typeof inv.subscription === 'object' ? text(obj(inv.subscription).id) : null)
  const metadata = { ...obj(inv.metadata), ...obj(legacyDetails.metadata), ...obj(parent.metadata) }
  return { id, metadata }
}

/** What a paid Stripe invoice means to us, or null if it is not one we act on. */
export function subscriptionFromInvoice(inv: Obj): (SubscriptionInput & { invoice_id: string }) | null {
  if (text(inv.status) && inv.status !== 'paid') return null
  const amount = Number(inv.amount_paid)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const { id: subId, metadata } = invoiceSubscription(inv)
  if (!subId) return null
  const lines = Array.isArray(obj(inv.lines).data) ? (obj(inv.lines).data as unknown[]) : []
  const periods = lines.map(l => obj(obj(l).period)).filter(p => Number(p.end) > 0)
  const start = periods.length ? Math.min(...periods.map(p => Number(p.start))) : Number(inv.period_start)
  const end = periods.length ? Math.max(...periods.map(p => Number(p.end))) : Number(inv.period_end)
  const customer = text(inv.customer) || text(obj(inv.customer).id)
  const userId = text(metadata.dialerseat_user_id) || text(metadata.dialerseat_external_user_id) || customer
  if (!userId) return null
  return {
    invoice_id: text(inv.id) || '',
    external_user_id: userId.slice(0, 120),
    email: text(inv.customer_email),
    name: text(inv.customer_name),
    external_subscription_id: subId,
    amount,
    currency: text(inv.currency) || 'usd',
    period_start: start > 0 ? new Date(start * 1000) : undefined,
    period_end: end > start ? new Date(end * 1000) : undefined,
  }
}
