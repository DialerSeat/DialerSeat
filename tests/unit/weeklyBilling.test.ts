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
    expect(billedCost(bySlug('readymode'), 1, 1)).toBe(199)
    expect(billedCost(bySlug('readymode'), 4, 1)).toBe(199)
  })

  it('applies seat minimums and annual terms', () => {
    // Orum: annual, three-seat minimum. One agent for one week is a year for three.
    expect(billedCost(bySlug('orum'), 1, 1)).toBe(250 * 3 * 12)
    expect(billedCost(bySlug('orum'), 1, 5)).toBe(250 * 5 * 12)
  })

  it('never estimates a quoted-only price', () => {
    expect(billedCost(bySlug('convoso'), 4, 1)).toBeNull()
    expect(billedCost(bySlug('five9'), 4, 1)).toBeNull()
  })

  it('every figure says where it is published', () => {
    for (const d of BILLED_DIALERS) expect(d.basis.length).toBeGreaterThan(10)
  })
})
