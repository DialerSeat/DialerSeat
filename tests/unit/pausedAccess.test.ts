import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── The gate /api/calls/outbound asks: lib/subscription getAccessTier ──────
// 8 Oct: a paused plan read as 'active' here forever, because Stripe keeps a
// paused subscription's status 'active'. Karol Amado paid to 5 Oct, paused on
// 1 Oct, and dialed 491 calls on 5-8 Oct.

let tables: Record<string, Array<Record<string, unknown>>> = {}

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(async () => ({ userId: 'u1' })) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = []
      const q: Record<string, (...args: never[]) => unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q },
        in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return q },
        order: () => q,
        limit: () => q,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: (tables[table] || []).filter(r => filters.every(f => f(r))), error: null }),
      }
      return q
    },
  }),
}))

import { getAccessTier } from '@/lib/subscription'
import { pausedAccessRunning } from '@/lib/entitlement'

const HOUR = 60 * 60 * 1000
const at = (ms: number) => new Date(Date.now() + ms).toISOString()

beforeEach(() => {
  tables = {
    subscriptions: [{
      user_id: 'u1', status: 'active', cancel_at_period_end: false,
      // Stripe rolls this forward every week while paused. It must not matter.
      current_period_end: at(96 * HOUR),
      paused_at: null, paused_access_until: null,
    }],
    team_members: [],
    team_codes: [],
    team_seat_charges: [],
  }
})

describe('paused plans and the dialer gate', () => {
  it('an unpaused active plan dials', async () => {
    expect(await getAccessTier('u1')).toBe('active')
  })

  it('paused with paid days left still dials', async () => {
    Object.assign(tables.subscriptions[0], { paused_at: at(-48 * HOUR), paused_access_until: at(24 * HOUR) })
    expect(await getAccessTier('u1')).toBe('active')
  })

  it('paused with the paid days over does not, whatever current_period_end says', async () => {
    Object.assign(tables.subscriptions[0], { paused_at: at(-7 * 24 * HOUR), paused_access_until: at(-72 * HOUR) })
    expect(await getAccessTier('u1')).toBe('lapsed')
  })

  it('paused with no paid days recorded does not', async () => {
    Object.assign(tables.subscriptions[0], { paused_at: at(-HOUR), paused_access_until: null })
    expect(await getAccessTier('u1')).toBe('lapsed')
  })

  it('a seat on a code the agent pays for does not stand in for the paused plan', async () => {
    Object.assign(tables.subscriptions[0], { paused_at: at(-7 * 24 * HOUR), paused_access_until: at(-72 * HOUR) })
    tables.team_members = [{
      user_id: 'u1', team_id: 't1', status: 'active', seat_suspended_at: null,
      billing_override: 'free', joined_via_code: 'S66XJ9XG',
    }]
    tables.team_codes = [{ code: 'S66XJ9XG', payer: 'agent' }]
    expect(await getAccessTier('u1')).toBe('lapsed')
  })

  it('a seat the owner pays for does', async () => {
    Object.assign(tables.subscriptions[0], { paused_at: at(-7 * 24 * HOUR), paused_access_until: at(-72 * HOUR) })
    tables.team_members = [{
      user_id: 'u1', team_id: 't1', status: 'active', seat_suspended_at: null,
      billing_override: 'owner', joined_via_code: null,
    }]
    expect(await getAccessTier('u1')).toBe('active')
  })
})

describe('pausedAccessRunning', () => {
  it('is false without a date and once the date has passed', () => {
    expect(pausedAccessRunning({ paused_access_until: null })).toBe(false)
    expect(pausedAccessRunning({ paused_access_until: at(-1000) })).toBe(false)
    expect(pausedAccessRunning({ paused_access_until: at(60_000) })).toBe(true)
  })
})
