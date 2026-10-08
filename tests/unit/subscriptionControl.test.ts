import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fakes for Stripe and the subscriptions table ───────────────────────────
const calls: string[] = []
let rows: Array<Record<string, unknown>> = []
const stripeSubs: Record<string, Record<string, unknown>> = {}
// Paid invoices Stripe would list for the customer, and how pay() behaves.
let paidInvoices: Array<Record<string, unknown> & { created: number }> = []
let payDeclines = false
let previewTotal = 3500

const NOW_SEC = Math.floor(Date.now() / 1000)
const DAY = 24 * 60 * 60

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        calls.push(`stripe.update ${id} ${JSON.stringify(patch)}`)
        const s = stripeSubs[id]
        if ('pause_collection' in patch) s.pause_collection = patch.pause_collection
        if ('cancel_at_period_end' in patch) s.cancel_at_period_end = patch.cancel_at_period_end as boolean
        return { id, ...s }
      }),
      retrieve: vi.fn(async (id: string) => ({ id, ...stripeSubs[id] })),
    },
    invoices: {
      list: vi.fn(async (q: { status?: string; created?: { gte: number } }) => {
        if (q.status === 'paid') return { data: paidInvoices.filter(i => i.created >= (q.created?.gte ?? 0)) }
        return { data: [] }
      }),
      createPreview: vi.fn(async () => ({ total: previewTotal, currency: 'usd' })),
      create: vi.fn(async (p: Record<string, unknown>) => {
        calls.push(`invoice.create ${JSON.stringify(p)}`)
        return { id: 'in_resume' }
      }),
      finalizeInvoice: vi.fn(async (id: string) => { calls.push(`invoice.finalize ${id}`); return { id } }),
      pay: vi.fn(async (id: string) => {
        calls.push(`invoice.pay ${id}`)
        if (payDeclines) {
          throw Object.assign(new Error('Your card has insufficient funds.'), { type: 'StripeCardError' })
        }
        return { id, amount_paid: previewTotal }
      }),
      voidInvoice: vi.fn(async (id: string) => { calls.push(`invoice.void ${id}`); return { id } }),
      del: vi.fn(async (id: string) => { calls.push(`invoice.del ${id}`); return { id } }),
    },
    invoiceItems: {
      create: vi.fn(async (p: Record<string, unknown>) => {
        calls.push(`invoiceItem.create ${JSON.stringify(p)}`)
        return { id: 'ii_1' }
      }),
    },
  },
}))

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: () => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = []
      let patch: Record<string, unknown> | null = null
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => { patch = p; return q },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return q },
        not: (k: string) => { filters.push(r => r[k] != null); return q },
        order: () => q,
        then: (resolve: (v: unknown) => void) => {
          const hit = rows.filter(r => filters.every(f => f(r)))
          if (patch) {
            hit.forEach(r => Object.assign(r, patch))
            calls.push(`db.update ${JSON.stringify(patch)}`)
          }
          resolve({ data: hit, error: null })
        },
      }
      return q
    },
  }),
}))
vi.mock('@/lib/billingEvents', () => ({ logBillingEvent: vi.fn(async () => {}) }))
vi.mock('@/lib/userDisplayName', () => ({ lookupUserIdentity: vi.fn(async () => ({ name: 'Hussein', email: null })) }))

import {
  applySubscriptionAction,
  paidThroughAtPause,
  reconcilePausedSubscriptions,
  resumePausedSubscription,
  RESUME_INVOICE_KEY,
} from '@/lib/subscriptionControl'

const periodStart = NOW_SEC - 3 * DAY
const periodEnd = NOW_SEC + 4 * DAY

beforeEach(() => {
  calls.length = 0
  paidInvoices = []
  payDeclines = false
  previewTotal = 3500
  rows = [{
    user_id: 'u1', stripe_subscription_id: 'sub_pro', status: 'active', plan: 'pro',
    paused_at: null, paused_access_until: null, cancel_at_period_end: false,
  }]
  stripeSubs.sub_pro = {
    status: 'active', pause_collection: null, cancel_at_period_end: false,
    customer: 'cus_1', default_payment_method: 'pm_1',
    billing_mode: { type: 'flexible' },
    items: { data: [{ current_period_start: periodStart, current_period_end: periodEnd }] },
  }
})

const iso = (sec: number) => new Date(sec * 1000).toISOString()
const pausedOut = () => {
  rows[0].paused_at = '2026-10-01T13:25:46Z'
  rows[0].paused_access_until = iso(NOW_SEC - DAY)
  stripeSubs.sub_pro.pause_collection = { behavior: 'void' }
}

describe('applySubscriptionAction', () => {
  it('writes the pause to Stripe even when our row already says paused', async () => {
    // Hussein's case: paused here, billing in Stripe.
    rows[0].paused_at = '2026-09-17T22:35:53Z'
    const [r] = await applySubscriptionAction('u1', 'pause', 'admin')
    expect(r.ok).toBe(true)
    expect(r.stripe?.paused).toBe(true)
    expect(stripeSubs.sub_pro.pause_collection).toEqual({ behavior: 'void' })
  })

  it('a pause records the paid days: to period end when this period was paid', async () => {
    paidInvoices = [{ created: periodStart, parent: { subscription_details: { subscription: 'sub_pro' } } }]
    await applySubscriptionAction('u1', 'pause', 'admin')
    expect(rows[0].paused_at).not.toBeNull()
    expect(rows[0].paused_access_until).toBe(iso(periodEnd))
  })

  it('clears our pause marker before un-pausing Stripe', async () => {
    rows[0].paused_at = '2026-09-17T22:35:53Z'
    rows[0].paused_access_until = iso(periodEnd)
    stripeSubs.sub_pro.pause_collection = { behavior: 'void' }
    await applySubscriptionAction('u1', 'resume', 'admin')
    const db = calls.findIndex(c => c.startsWith('db.update') && c.includes('"paused_at":null'))
    const st = calls.findIndex(c => c.startsWith('stripe.update') && c.includes('"pause_collection":null'))
    expect(db).toBeGreaterThanOrEqual(0)
    expect(st).toBeGreaterThan(db)
    expect(rows[0].paused_at).toBeNull()
  })

  it('cancel and renew flip the scheduled cancel in Stripe and here', async () => {
    await applySubscriptionAction('u1', 'cancel', 'admin')
    expect(stripeSubs.sub_pro.cancel_at_period_end).toBe(true)
    expect(rows[0].cancel_at_period_end).toBe(true)
    await applySubscriptionAction('u1', 'renew', 'admin')
    expect(stripeSubs.sub_pro.cancel_at_period_end).toBe(false)
    expect(rows[0].cancel_at_period_end).toBe(false)
  })
})

describe('paidThroughAtPause', () => {
  it('a period whose invoice was voided gives no paid days', async () => {
    const until = await paidThroughAtPause({ id: 'sub_pro', ...stripeSubs.sub_pro } as never)
    expect(new Date(until).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('the invoice a resume paid counts for the period it opened', async () => {
    paidInvoices = [{ created: periodStart + 60, metadata: { [RESUME_INVOICE_KEY]: 'sub_pro' } }]
    const until = await paidThroughAtPause({ id: 'sub_pro', ...stripeSubs.sub_pro } as never)
    expect(until).toBe(iso(periodEnd))
  })

  it('a paid invoice from an earlier period does not count', async () => {
    paidInvoices = [{ created: periodStart - 7 * DAY, parent: { subscription_details: { subscription: 'sub_pro' } } }]
    const until = await paidThroughAtPause({ id: 'sub_pro', ...stripeSubs.sub_pro } as never)
    expect(new Date(until).getTime()).toBeLessThanOrEqual(Date.now())
  })
})

describe('resumePausedSubscription', () => {
  it('with paid days left: un-pauses and charges nothing', async () => {
    rows[0].paused_at = '2026-10-06T00:04:38Z'
    rows[0].paused_access_until = iso(periodEnd)
    const r = await resumePausedSubscription(rows[0] as never)
    expect(r.chargedCents).toBe(0)
    expect(calls.some(c => c.startsWith('invoice.'))).toBe(false)
    expect(calls.some(c => c.includes('billing_cycle_anchor'))).toBe(false)
    expect(stripeSubs.sub_pro.pause_collection).toBeNull()
    expect(rows[0].paused_at).toBeNull()
  })

  it('flexible, paid days over: charges a week, THEN restarts the week from now', async () => {
    pausedOut()
    const r = await resumePausedSubscription({ ...rows[0] } as never)
    expect(r).toEqual({ status: 'active', chargedCents: 3500 })
    const paid = calls.findIndex(c => c === 'invoice.pay in_resume')
    const restart = calls.findIndex(c => c.startsWith('stripe.update') && c.includes('"billing_cycle_anchor":"now"'))
    expect(paid).toBeGreaterThanOrEqual(0)
    expect(restart).toBeGreaterThan(paid)
    expect(calls[restart]).toContain('"proration_behavior":"none"')
    expect(calls.find(c => c.startsWith('invoiceItem.create'))).toContain('"amount":3500')
    expect(rows[0].paused_at).toBeNull()
    expect(rows[0].paused_access_until).toBeNull()
  })

  it('flexible, card declined: voids the charge, stays paused, nothing restarted', async () => {
    pausedOut()
    payDeclines = true
    const before = { ...rows[0] }
    const r = await resumePausedSubscription(before as never)
    expect(r.declined).toMatch(/insufficient funds/)
    expect(r.chargedCents).toBe(0)
    expect(calls).toContain('invoice.void in_resume')
    expect(calls.some(c => c.startsWith('stripe.update'))).toBe(false)
    expect(rows[0].paused_at).toBe(before.paused_at)
    expect(stripeSubs.sub_pro.pause_collection).toEqual({ behavior: 'void' })
  })

  it('a fully comped plan resumes without an invoice', async () => {
    pausedOut()
    previewTotal = 0
    const r = await resumePausedSubscription({ ...rows[0] } as never)
    expect(r.chargedCents).toBe(0)
    expect(calls.some(c => c.startsWith('invoice.create'))).toBe(false)
    expect(calls.some(c => c.includes('"billing_cycle_anchor":"now"'))).toBe(true)
  })

  it('classic, paid days over: one update that bills the week and refuses on a decline', async () => {
    pausedOut()
    stripeSubs.sub_pro.billing_mode = { type: 'classic' }
    await resumePausedSubscription({ ...rows[0] } as never)
    expect(calls.some(c => c.startsWith('invoice.create'))).toBe(false)
    const u = calls.find(c => c.startsWith('stripe.update'))!
    expect(u).toContain('"billing_cycle_anchor":"now"')
    expect(u).toContain('"proration_behavior":"none"')
    expect(u).toContain('"payment_behavior":"error_if_incomplete"')
  })

  it('an unknown billing mode charges nothing and changes nothing', async () => {
    pausedOut()
    stripeSubs.sub_pro.billing_mode = undefined
    await expect(resumePausedSubscription({ ...rows[0] } as never)).rejects.toThrow(/billing mode/)
    expect(calls.some(c => c.startsWith('invoice.') || c.startsWith('stripe.update'))).toBe(false)
    expect(rows[0].paused_at).not.toBeNull()
  })
})

describe('reconcilePausedSubscriptions', () => {
  it('re-pauses in Stripe what is paused here', async () => {
    rows[0].paused_at = '2026-09-17T22:35:53Z'
    const fixed = await reconcilePausedSubscriptions()
    expect(fixed).toEqual([{ stripeSubscriptionId: 'sub_pro', clerkId: 'u1', repaused: true }])
    expect(stripeSubs.sub_pro.pause_collection).toEqual({ behavior: 'void' })
  })

  it('leaves alone what already matches, and what is not paused here', async () => {
    rows[0].paused_at = '2026-09-17T22:35:53Z'
    stripeSubs.sub_pro.pause_collection = { behavior: 'void' }
    expect(await reconcilePausedSubscriptions()).toEqual([])
    rows[0].paused_at = null
    stripeSubs.sub_pro.pause_collection = null
    expect(await reconcilePausedSubscriptions()).toEqual([])
    expect(stripeSubs.sub_pro.pause_collection).toBeNull()
  })
})
