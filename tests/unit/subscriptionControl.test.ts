import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fakes for Stripe and the subscriptions table ───────────────────────────
const calls: string[] = []
let rows: Array<Record<string, unknown>> = []
const stripeSubs: Record<string, { status: string; pause_collection: unknown; cancel_at_period_end: boolean }> = {}

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

import { applySubscriptionAction, reconcilePausedSubscriptions } from '@/lib/subscriptionControl'

beforeEach(() => {
  calls.length = 0
  rows = [{ user_id: 'u1', stripe_subscription_id: 'sub_pro', status: 'active', plan: 'pro', paused_at: null, cancel_at_period_end: false }]
  stripeSubs.sub_pro = { status: 'active', pause_collection: null, cancel_at_period_end: false }
})

describe('applySubscriptionAction', () => {
  it('writes the pause to Stripe even when our row already says paused', async () => {
    // Hussein's case: paused here, billing in Stripe.
    rows[0].paused_at = '2026-09-17T22:35:53Z'
    const [r] = await applySubscriptionAction('u1', 'pause', 'admin')
    expect(r.ok).toBe(true)
    expect(r.stripe?.paused).toBe(true)
    expect(stripeSubs.sub_pro.pause_collection).toEqual({ behavior: 'void' })
  })

  it('clears our pause marker before un-pausing Stripe', async () => {
    rows[0].paused_at = '2026-09-17T22:35:53Z'
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
