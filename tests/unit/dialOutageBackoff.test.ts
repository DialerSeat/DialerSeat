import { describe, it, expect, beforeEach } from 'vitest'
import {
  noteCapacityFailure,
  noteDialSuccess,
  backoffDelayMs,
  __resetBackoff,
} from '@/lib/dialOutageBackoff'

// =============================================================================
// A DAMPER, NOT A GATE
// =============================================================================
// This exists because 11 September saw 4,341 dial attempts over ten hours
// against a blocked account. It slows that down. It must never be able to stop
// a dial that would have worked, so the cases below are weighted toward "does
// it get out of the way" rather than "does it clamp hard enough".

beforeEach(() => __resetBackoff())

describe('it stays out of the way', () => {
  it('delays nothing before any failure', () => {
    expect(backoffDelayMs()).toBe(0)
  })

  it('delays nothing for the first two failures', () => {
    // A blip is not an outage. Two failures in a row happen for ordinary
    // reasons and must not slow an otherwise healthy dialer.
    noteCapacityFailure()
    expect(backoffDelayMs()).toBe(0)
    noteCapacityFailure()
    expect(backoffDelayMs()).toBe(0)
  })

  it('is cleared completely by ONE success', () => {
    // The condition is total -- no number to dial from, or a blocked account.
    // When it lifts it lifts for everyone at once, so there is nothing to ease
    // back into.
    for (let i = 0; i < 20; i++) noteCapacityFailure()
    expect(backoffDelayMs()).toBeGreaterThan(0)
    noteDialSuccess()
    expect(backoffDelayMs()).toBe(0)
  })
})

describe('it ramps, and it stops ramping', () => {
  it('doubles from 500ms after the free failures', () => {
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      noteCapacityFailure()
      seen.push(backoffDelayMs())
    }
    // failures 1-2 free, then 500, 1000, 2000, 4000, 8000, then the ceiling.
    expect(seen).toEqual([0, 0, 500, 1000, 2000, 4000, 8000, 10000])
  })

  it('never exceeds the ceiling however long the outage runs', () => {
    // Ten hours of 11 September would be thousands of failures. The delay must
    // not grow into something that looks like a hang.
    for (let i = 0; i < 5000; i++) noteCapacityFailure()
    expect(backoffDelayMs()).toBe(10_000)
  })

  it('turns a runaway into a trickle', () => {
    // 11 Sept ran ~7 attempts a minute for ten hours. At the ceiling that is
    // one attempt per 10s -- six a minute becomes well under one.
    for (let i = 0; i < 10; i++) noteCapacityFailure()
    const perMinuteAtCeiling = 60_000 / backoffDelayMs()
    expect(perMinuteAtCeiling).toBeLessThanOrEqual(6)
  })
})
