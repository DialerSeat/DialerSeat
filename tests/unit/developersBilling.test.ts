// Platform billing: a platform's user pays the platform, the platform tells us,
// the seat dials through the paid period, and DialerSeat's cut goes on the
// project's ledger. Runs on the local store in a temp directory; no network.

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://supabase.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'unused'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'unused'
})
vi.mock('server-only', () => ({}))

let store: typeof import('@/lib/developers/store')
let billing: typeof import('@/lib/developers/billing')
let survey: typeof import('@/lib/developers/survey')
let platform: import('@/lib/developers/store').Platform

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'devbill-')))
  process.env.DEV_PLATFORM_STORE = 'local'
  vi.stubGlobal('fetch', vi.fn(async () => new Response('ok')))
  store = await import('@/lib/developers/store')
  billing = await import('@/lib/developers/billing')
  survey = await import('@/lib/developers/survey')
  const s = store.devStore()
  const owner = await s.resolveUserId('clerk_bill')
  await s.createAccount(owner!)
  platform = await s.createPlatform({ owner_user_id: owner!, name: 'Acme CRM', slug: 'acme-crm', website: null })
})

const day = 24 * 3600 * 1000

describe('the cut', () => {
  const start = new Date('2026-11-01T00:00:00Z')
  const week = new Date(start.getTime() + 7 * day)
  const month = new Date('2026-12-01T00:00:00Z')
  it('is null until sales sets a rate: nothing invented', () => {
    expect(billing.computeFee({ cut_model: 'seat_week', rate_seat_week: null, revenue_share_pct: null }, 4900, start, week)).toBeNull()
    expect(billing.computeFee({ cut_model: 'revenue_share', rate_seat_week: 20, revenue_share_pct: null }, 4900, start, week)).toBeNull()
  })
  it('seat-week: the rate times the weeks covered, to the day', () => {
    expect(billing.computeFee({ cut_model: 'seat_week', rate_seat_week: 20, revenue_share_pct: null }, 4900, start, week)).toBe(2000)
    // 30 days is 30/7 weeks
    expect(billing.computeFee({ cut_model: 'seat_week', rate_seat_week: 7, revenue_share_pct: null }, 4900, start, month)).toBe(3000)
  })
  it('revenue share: a percentage of what the user paid', () => {
    expect(billing.computeFee({ cut_model: 'revenue_share', rate_seat_week: null, revenue_share_pct: 30 }, 4900, start, week)).toBe(1470)
  })
  it('periods: week, month, year', () => {
    expect(billing.periodEnd(start, 'week').toISOString()).toBe('2026-11-08T00:00:00.000Z')
    expect(billing.periodEnd(start, 'month').toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(billing.periodEnd(start, 'year').toISOString()).toBe('2027-11-01T00:00:00.000Z')
  })
})

describe('a signup, a renewal, a repeat and a cancellation', () => {
  it('activates the seat through the paid period and records the cut once', async () => {
    const start = new Date(Date.now() - day)
    const end = new Date(Date.now() + 29 * day)
    const r1 = await billing.recordSubscription(platform, 'test', { external_user_id: 'usr_1', external_subscription_id: 'sub_1', amount: 4900, period_start: start, period_end: end }, 'api', 'api:evt_1')
    expect(r1.kind).toBe('signup')
    expect(r1.duplicate).toBe(false)
    expect(r1.seat.status).toBe('active')
    expect(r1.seat.billed_to).toBe('platform')
    expect(r1.seat.paid_through).toBe(end.toISOString())
    expect(r1.entry.fee_cents).toBeNull()

    const again = await billing.recordSubscription(platform, 'test', { external_user_id: 'usr_1', external_subscription_id: 'sub_1', amount: 4900, period_start: start, period_end: end }, 'api', 'api:evt_1')
    expect(again.duplicate).toBe(true)
    expect((await store.devStore().listLedger(platform.id, 'test', 100)).length).toBe(1)

    const later = new Date(end.getTime() + 30 * day)
    const r2 = await billing.recordSubscription(platform, 'test', { external_user_id: 'usr_1', external_subscription_id: 'sub_1', amount: 4900, period_start: end, period_end: later }, 'api', 'api:evt_2')
    expect(r2.kind).toBe('renewal')
    expect(r2.seat.paid_through).toBe(later.toISOString())
  })

  it('an out-of-order older event never shortens paid days', async () => {
    const before = (await store.devStore().listSeats(platform.id, 'test')).find(s => s.external_user_id === 'usr_1')!
    const r = await billing.recordSubscription(platform, 'test', { external_user_id: 'usr_1', external_subscription_id: 'sub_1', amount: 4900, interval: 'week' }, 'api', 'api:evt_old')
    expect(r.seat.paid_through).toBe(before.paid_through)
  })

  it('a cancellation keeps the paid days; end_now stops at once', async () => {
    const kept = await billing.cancelSubscription(platform, 'test', { external_subscription_id: 'sub_1' }, false)
    expect(kept?.canceled_at).toBeTruthy()
    expect(billing.seatLapsed(kept!)).toBe(false)
    await billing.recordSubscription(platform, 'test', { external_user_id: 'usr_2', amount: 1500, interval: 'week' }, 'api', 'api:evt_3')
    const now = await billing.cancelSubscription(platform, 'test', { external_user_id: 'usr_2' }, true)
    expect(now?.status).toBe('disabled')
    expect(billing.seatLapsed(now!)).toBe(true)
  })

  it('the balance counts fees and payments, and rows without a rate apart', () => {
    const b = billing.summarise([
      { kind: 'signup', fee_cents: 2000, customer_amount_cents: 4900, currency: 'usd' },
      { kind: 'renewal', fee_cents: null, customer_amount_cents: 4900, currency: 'usd' },
      { kind: 'owner_payment', fee_cents: -1500, customer_amount_cents: null, currency: 'usd' },
    ] as import('@/lib/developers/store').LedgerRow[])
    expect(b.due_cents).toBe(500)
    expect(b.fees_cents).toBe(2000)
    expect(b.paid_cents).toBe(1500)
    expect(b.rate_not_set).toBe(1)
    expect(b.customer_revenue_cents).toBe(9800)
  })
})

describe('forwarded Stripe webhooks', () => {
  // Made at run time: a literal secret in a test trips secret scanners.
  const secret = 'whsec_' + randomBytes(24).toString('hex')
  const sign = (body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

  it('verifies a Stripe signature, and ignores v0 and debug entries', () => {
    const body = JSON.stringify({ id: 'evt_1' })
    expect(billing.verifyStripeSignature(body, sign(body), secret)).toBe(true)
    expect(billing.verifyStripeSignature(body, `${sign(body)},v0=abc,secret=whsec_****,destination=we_1,payload=abc`, secret)).toBe(true)
    expect(billing.verifyStripeSignature(body + ' ', sign(body), secret)).toBe(false)
    expect(billing.verifyStripeSignature(body, sign(body, Math.floor(Date.now() / 1000) - 600), secret)).toBe(false)
    expect(billing.verifyStripeSignature(body, null, secret)).toBe(false)
  })

  const lines = { data: [{ period: { start: 1793500000, end: 1796092000 } }] }
  it('reads a paid invoice on the current API (parent.subscription_details)', () => {
    const s = billing.subscriptionFromInvoice({
      id: 'in_1', status: 'paid', amount_paid: 4900, currency: 'usd', customer: 'cus_9', customer_email: 'd@acme.com', customer_name: 'Dana',
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_9', metadata: { dialerseat_user_id: 'usr_9' } } }, lines,
    })
    expect(s).toMatchObject({ external_user_id: 'usr_9', external_subscription_id: 'sub_9', amount: 4900, email: 'd@acme.com', invoice_id: 'in_1' })
    expect(s?.period_end?.getTime()).toBe(1796092000 * 1000)
  })
  it('reads an older invoice (invoice.subscription) and falls back to the customer id', () => {
    const s = billing.subscriptionFromInvoice({ id: 'in_2', status: 'paid', amount_paid: 1500, currency: 'usd', customer: 'cus_7', subscription: 'sub_7', lines })
    expect(s).toMatchObject({ external_user_id: 'cus_7', external_subscription_id: 'sub_7' })
  })
  it('ignores unpaid, zero and one-off invoices', () => {
    expect(billing.subscriptionFromInvoice({ status: 'open', amount_paid: 4900, subscription: 'sub_1', customer: 'c' })).toBeNull()
    expect(billing.subscriptionFromInvoice({ status: 'paid', amount_paid: 0, subscription: 'sub_1', customer: 'c' })).toBeNull()
    expect(billing.subscriptionFromInvoice({ status: 'paid', amount_paid: 900, customer: 'c' })).toBeNull()
  })
})

describe('the project survey', () => {
  it('keeps only real options, never free text', () => {
    const { profile, approach } = survey.cleanProfile({ kind: 'crm', goals: ['add_calling', '<script>', 'resell_seats'], modes: ['power', 'nope'], billing: 'free text', integration_approach: 'react', extra: 'x' })
    expect(profile).toEqual({ kind: 'crm', goals: ['add_calling', 'resell_seats'], modes: ['power'] })
    expect(approach).toBe('react')
  })
  it('allows the dial modes picked, or all four', () => {
    expect(survey.modesFromProfile({ modes: ['power', 'preview'] })).toEqual(['preview', 'power'])
    expect(survey.modesFromProfile({ modes: ['unsure'] })).toEqual(['preview', 'progressive', 'power', 'predictive'])
  })
  it('a new project is platform-billed by default', () => {
    expect(platform.billing_model).toBe('platform')
  })
})
