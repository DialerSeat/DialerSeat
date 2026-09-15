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
    // failures 1-2 free, then 500, 1000, 2000, then the ceiling.
    expect(seen).toEqual([0, 0, 500, 1000, 2000, 2500, 2500, 2500])
  })

  it('NEVER approaches the serverless function timeout', () => {
    // The ceiling was 10,000ms, which is EXACTLY Vercel Hobby's default
    // function duration -- and neither /api/calls/outbound nor
    // /api/dialer/heartbeat declares a maxDuration, so both inherit it.
    //
    // At full backoff the function would be killed with no budget left to
    // dial. If that kill landed after Telnyx accepted the agent leg but
    // before we recorded it, the result is a leg placed and BILLED with no
    // calls row pointing at it -- an orphan charge created by the thing meant
    // to reduce charges.
    const HOBBY_FUNCTION_TIMEOUT_MS = 10_000
    for (let i = 0; i < 5000; i++) noteCapacityFailure()
    expect(backoffDelayMs()).toBeLessThanOrEqual(HOBBY_FUNCTION_TIMEOUT_MS / 3)
  })

  it('never exceeds the ceiling however long the outage runs', () => {
    // Ten hours of 11 September would be thousands of failures. The delay must
    // not grow into something that looks like a hang.
    for (let i = 0; i < 5000; i++) noteCapacityFailure()
    expect(backoffDelayMs()).toBe(2_500)
  })

  it('damps the burst that actually happened', () => {
    // The ten-hour average of ~7/minute was never the shape worth fixing. The
    // BURST was: 1,827 attempts in the 16:00 hour of 11 September, roughly one
    // every two seconds. The ceiling must put a floor under that.
    for (let i = 0; i < 10; i++) noteCapacityFailure()
    const observedBurstIntervalMs = 2_000
    expect(backoffDelayMs()).toBeGreaterThan(observedBurstIntervalMs)
  })
})
