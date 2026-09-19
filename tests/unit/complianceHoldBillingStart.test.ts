import { describe, it, expect } from 'vitest'
import {
  billingElapsedMs,
  remainingHoldMs,
  AGENT_LEG_MIN_SECONDS,
  HOLD_SPREAD_SECONDS,
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
