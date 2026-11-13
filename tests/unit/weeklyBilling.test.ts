import { describe, expect, it } from 'vitest'
import {
  BILLED_DIALERS,
  DIALERSEAT_WEEKLY,
  billedCost,
  dialerSeatCost,
  monthsToCover,
} from '@/lib/weeklyBilling'

const bySlug = (slug: string) => {
  const d = BILLED_DIALERS.find((x) => x.slug === slug)
  if (!d) throw new Error(`no ${slug}`)
  return d
}

describe('weekly against monthly billing', () => {
  it('one week of DialerSeat is one week, not a month', () => {
    expect(dialerSeatCost(1, 1)).toBe(DIALERSEAT_WEEKLY)
    expect(dialerSeatCost(4, 1)).toBe(140)
    expect(dialerSeatCost(2, 5)).toBe(350)
  })

  it('a monthly plan bills every month the weeks touch', () => {
    expect(monthsToCover(1)).toBe(1)
    expect(monthsToCover(4)).toBe(1)
    expect(monthsToCover(5)).toBe(2)
    expect(monthsToCover(13)).toBe(3)
    expect(monthsToCover(52)).toBe(12)
  })

  it('one week of a monthly dialer costs its full month', () => {
    expect(billedCost(bySlug('mojo'), 1, 1)).toBe(149)
    expect(billedCost(bySlug('readymode'), 1, 1)).toBe(239)
    expect(billedCost(bySlug('readymode'), 4, 1)).toBe(239)
  })

  it('applies seat minimums', () => {
    // Five9 Core: $159 per seat per month, 50-seat minimum (its pricing page, 13 Nov 2026).
    // One agent for one week is a month for fifty.
    expect(billedCost(bySlug('five9'), 1, 1)).toBe(159 * 50)
    expect(billedCost(bySlug('five9'), 1, 60)).toBe(159 * 60)
  })

  it('bills an annual term as at least twelve months', () => {
    // No dialer in the list sells only by the year today, so the rule is checked on a
    // constructed one: a three-seat annual plan, one agent for one week.
    const annual = { ...bySlug('five9'), commitment: 'year' as const, minimumSeats: 3, perSeatMonth: 100 }
    expect(billedCost(annual, 1, 1)).toBe(100 * 3 * 12)
    expect(billedCost(annual, 60, 1)).toBe(100 * 3 * 14)
  })

  it('never estimates a quoted-only price', () => {
    expect(billedCost(bySlug('convoso'), 4, 1)).toBeNull()
    expect(billedCost(bySlug('orum'), 4, 1)).toBeNull()
  })

  it('every figure says where it is published', () => {
    for (const d of BILLED_DIALERS) expect(d.basis.length).toBeGreaterThan(10)
  })
})
