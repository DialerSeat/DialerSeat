import { describe, it, expect } from 'vitest'
import {
  billingElapsedMs,
  remainingHoldMs,
  AGENT_LEG_MIN_SECONDS,
  HOLD_SPREAD_SECONDS,
  nextDialDelayMs,
  LEG_SETTLE_MS,
} from '@/lib/complianceHold'

const at = (iso: string) => new Date(iso).getTime()
// Telnyx bills the agent leg in six-second increments, so anything at or
// under six rounds to a six-second leg and counts against the short-call
// ratio. Clearing the line means billing MORE than six seconds of talk.
const SHORT_DURATION_SECONDS = 6

describe('billingElapsedMs', () => {
  it('measures from answer', () => {
    expect(billingElapsedMs('2026-09-19T03:10:03Z', at('2026-09-19T03:10:05Z'))).toBe(2000)
  })

  it('holds the FULL floor when the answer stamp is missing', () => {
    // The regression this was rewritten for. Falling back to the dial time
    // reports a larger elapsed, which asks for LESS hold — so legs kept
    // billing exactly six whenever call.answered had not landed yet.
    expect(billingElapsedMs(null, at('2026-09-19T03:10:05Z'))).toBe(0)
    expect(billingElapsedMs(undefined, at('2026-09-19T03:10:05Z'))).toBe(0)
    expect(billingElapsedMs('not a date', at('2026-09-19T03:10:05Z'))).toBe(0)
  })

  it('never returns negative for a clock skewed into the future', () => {
    expect(billingElapsedMs('2026-09-19T03:10:10Z', at('2026-09-19T03:10:05Z'))).toBe(0)
  })
})

describe('the hold clears the six-second billing increment', () => {
  const billedAtRelease = (elapsedMs: number) =>
    (elapsedMs + remainingHoldMs(AGENT_LEG_MIN_SECONDS, elapsedMs)) / 1000

  it('clears it for a leg that just answered', () => {
    const billed = billedAtRelease(billingElapsedMs('2026-09-19T03:10:03Z', at('2026-09-19T03:10:04Z')))
    expect(billed).toBeGreaterThan(SHORT_DURATION_SECONDS)
    expect(billed).toBeLessThanOrEqual(AGENT_LEG_MIN_SECONDS + HOLD_SPREAD_SECONDS)
  })

  it('clears it after a long ring, which measuring from the dial did not', () => {
    const billed = billedAtRelease(billingElapsedMs('2026-09-19T03:10:26Z', at('2026-09-19T03:10:27Z')))
    expect(billed).toBeGreaterThan(SHORT_DURATION_SECONDS)
  })

  it('clears it with no answer stamp at all', () => {
    // The eight legs still billing six after the first fix.
    const billed = billedAtRelease(billingElapsedMs(null, at('2026-09-19T03:10:04Z')))
    expect(billed).toBeGreaterThan(SHORT_DURATION_SECONDS)
  })

  it('leaves a leg already past the floor alone', () => {
    expect(remainingHoldMs(AGENT_LEG_MIN_SECONDS, 30_000)).toBe(0)
  })

  it('never shortens a call, at any elapsed', () => {
    for (const elapsed of [0, 1_000, 6_999, 9_500, 60_000]) {
      expect(remainingHoldMs(AGENT_LEG_MIN_SECONDS, elapsed)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('nextDialDelayMs', () => {
  const FLOOR = 7200
  const T = 1_000_000

  it('waits out the rest of the floor before dialing again', () => {
    // Leg answered 1s ago, floor is 7.2s — the old flat 800ms would have put
    // a new INVITE on the same credential 6.4s early and cut the leg short.
    const delay = nextDialDelayMs(T - 1000, FLOOR, 800, T)
    expect(delay).toBeGreaterThan(6000)
    expect(delay).toBe(FLOOR - 1000 + LEG_SETTLE_MS)
  })

  it('leaves the caller pacing alone once the floor has passed', () => {
    expect(nextDialDelayMs(T - 10_000, FLOOR, 800, T)).toBe(800)
    expect(nextDialDelayMs(T - 10_000, FLOOR, 300, T)).toBe(300)
  })

  it('does not wait when there is no leg to wait for', () => {
    expect(nextDialDelayMs(null, FLOOR, 300, T)).toBe(300)
    expect(nextDialDelayMs(undefined, FLOOR, 800, T)).toBe(800)
  })

  it('never returns less than the caller asked for', () => {
    for (const ago of [0, 500, 3000, 7199, 7200, 20_000]) {
      expect(nextDialDelayMs(T - ago, FLOOR, 800, T)).toBeGreaterThanOrEqual(800)
    }
  })

  it('leaves room for the BYE to land, not just the floor', () => {
    // Landing exactly on the floor races the teardown it is waiting for.
    expect(nextDialDelayMs(T, FLOOR, 300, T)).toBe(FLOOR + LEG_SETTLE_MS)
  })

  it('an AMD skip at 3s waits the remaining floor, not 800ms', () => {
    // The real sequence: machine detected ~3s in, redial scheduled straight
    // after. This is the case that was billing six-second legs.
    const delay = nextDialDelayMs(T - 3000, FLOOR, 800, T)
    expect(delay).toBe(4200 + LEG_SETTLE_MS)
    expect((3000 + delay - LEG_SETTLE_MS) / 1000).toBeGreaterThan(6)
  })
})
