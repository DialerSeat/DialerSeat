import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({ stripe: {} }))

import { summariseEarnings } from '@/lib/stripeEarnings'

describe('summariseEarnings', () => {
  it('nets refunds, disputes and fees off what was collected', () => {
    const e = summariseEarnings([
      { type: 'charge', amount: 3500, fee: 132, currency: 'usd' },
      { type: 'charge', amount: 7500, fee: 248, currency: 'usd' },
      { type: 'refund', amount: -3500, fee: 0, currency: 'usd' },
      { type: 'adjustment', amount: -1500, fee: 1500, currency: 'usd' },
      { type: 'payout', amount: -5000, fee: 0, currency: 'usd' },
    ])
    expect(e.grossUsd).toBe(110)
    expect(e.refundsUsd).toBe(35)
    expect(e.disputesUsd).toBe(15)
    expect(e.feesUsd).toBe(18.8)
    expect(e.netUsd).toBe(41.2)
    expect(e.payments).toBe(2)
    expect(e.refunds).toBe(1)
  })

  it('ignores payouts and other currencies', () => {
    const e = summariseEarnings([
      { type: 'payout', amount: -10000, fee: 0, currency: 'usd' },
      { type: 'charge', amount: 1000, fee: 0, currency: 'eur' },
    ])
    expect(e.netUsd).toBe(0)
  })
})
