import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ getServiceClient: () => ({}) }))

import { numberCosts, readAll } from '@/lib/balanceAccounting'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-08T12:00:00Z')
const SINCE = NOW - 30 * DAY

describe('numberCosts', () => {
  it('charges a purchase only for numbers bought inside the window', () => {
    const r = numberCosts([
      { acquired_at: new Date(NOW - 5 * DAY).toISOString(), monthly_cost_cents: 100, status: 'active' },
      { acquired_at: new Date(NOW - 60 * DAY).toISOString(), monthly_cost_cents: 100, status: 'active' },
    ], SINCE, NOW)
    expect(r.bought).toBe(1)
    expect(r.purchasesUsd).toBe(1)
  })

  it('prorates rent to the part of the window a number was held', () => {
    const r = numberCosts([
      { acquired_at: new Date(NOW - 15 * DAY).toISOString(), monthly_cost_cents: 100, status: 'active' },
      { acquired_at: new Date(NOW - 90 * DAY).toISOString(), monthly_cost_cents: 100, status: 'active' },
    ], SINCE, NOW)
    expect(r.rentUsd).toBeCloseTo(0.5 + 1, 6)
    expect(r.held).toBe(2)
  })

  it('rents nothing for a released number, but still counts its purchase', () => {
    const r = numberCosts([
      { acquired_at: new Date(NOW - 3 * DAY).toISOString(), monthly_cost_cents: 100, status: 'released' },
    ], SINCE, NOW)
    expect(r.rentUsd).toBe(0)
    expect(r.held).toBe(0)
    expect(r.bought).toBe(1)
  })
})

describe('readAll', () => {
  it('keeps reading past the first page', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i)
    const got = await readAll<number>(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(got.length).toBe(2500)
  })

  it('throws instead of returning a partial sum', async () => {
    await expect(readAll(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
