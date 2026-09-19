import { describe, it, expect } from 'vitest'
import {
  billingElapsedMs,
  remainingHoldMs,
  AGENT_LEG_MIN_SECONDS,
  HOLD_SPREAD_SECONDS,
} from '@/lib/complianceHold'

const CREATED = '2026-09-19T03:10:00Z'
const at = (iso: string) => new Date(iso).getTime()

describe('billingElapsedMs', () => {
  it('measures from answer, not from the dial', () => {
    // Rang for 3 seconds, connected 2 seconds ago.
    expect(billingElapsedMs('2026-09-19T03:10:03Z', CREATED, at('2026-09-19T03:10:05Z')))
      .toBe(2000)
  })

  it('does not let a long ring eat the hold', () => {
    // The 26-second ring from the logs. Measured from creation this reads as
    // 27s elapsed and the leg is released instantly, billing five seconds.
    const now = at('2026-09-19T03:10:27Z')
    expect(billingElapsedMs('2026-09-19T03:10:26Z', CREATED, now)).toBe(1000)
    expect(billingElapsedMs(null, CREATED, now)).toBe(27000)
  })

  it('falls back to creation when the answer stamp has not landed yet', () => {
    expect(billingElapsedMs(null, CREATED, at('2026-09-19T03:10:04Z'))).toBe(4000)
    expect(billingElapsedMs(undefined, CREATED, at('2026-09-19T03:10:04Z'))).toBe(4000)
  })

  it('returns 0 for an unparseable stamp, which holds the full floor', () => {
    expect(billingElapsedMs('not a date', null, at(CREATED))).toBe(0)
    expect(billingElapsedMs(null, null, at(CREATED))).toBe(0)
  })

  it('never returns negative for a clock skewed into the future', () => {
    expect(billingElapsedMs('2026-09-19T03:10:10Z', CREATED, at('2026-09-19T03:10:05Z')))
      .toBe(0)
  })
})

describe('the hold clears the short-duration line', () => {
  const SHORT_DURATION_SECONDS = 6

  it('holds a just-answered leg past six billed seconds', () => {
    const elapsed = billingElapsedMs('2026-09-19T03:10:03Z', CREATED, at('2026-09-19T03:10:04Z'))
    const billedAtRelease = (elapsed + remainingHoldMs(AGENT_LEG_MIN_SECONDS, elapsed)) / 1000
    expect(billedAtRelease).toBeGreaterThan(SHORT_DURATION_SECONDS)
    expect(billedAtRelease).toBeLessThanOrEqual(AGENT_LEG_MIN_SECONDS + HOLD_SPREAD_SECONDS)
  })

  it('still clears it after a long ring, which it did not before', () => {
    // Same call that used to bill five seconds.
    const elapsed = billingElapsedMs('2026-09-19T03:10:26Z', CREATED, at('2026-09-19T03:10:27Z'))
    const billedAtRelease = (elapsed + remainingHoldMs(AGENT_LEG_MIN_SECONDS, elapsed)) / 1000
    expect(billedAtRelease).toBeGreaterThan(SHORT_DURATION_SECONDS)
  })

  it('leaves a leg that is already past the line alone', () => {
    const elapsed = 30_000
    expect(remainingHoldMs(AGENT_LEG_MIN_SECONDS, elapsed)).toBe(0)
  })
})
