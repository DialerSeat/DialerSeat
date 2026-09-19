import { describe, it, expect } from 'vitest'
import {
  lifetimeAttemptCap,
  backToBackAttempts,
  MAX_LIFETIME_ATTEMPTS,
} from '@/lib/dialerConstants'

/**
 * Nine dials is a lead's lifespan, on every mode.
 *
 * The repeat count decides how many times in a row a lead is dialled on one
 * visit. It does not decide how many dials the lead gets in total. Comments in
 * this codebase described a 3/6/9 ladder that was never the rule, and reading
 * them nearly produced a "fix" that would have cut a 1x lead to three dials
 * for its entire life.
 *
 * Pinned here so the next person to notice that 1x and 3x resolve to the same
 * number finds a test saying it is deliberate, rather than a comment implying
 * it is broken.
 */
describe('lead lifespan', () => {
  it('gives every mode the same nine dials', () => {
    expect(lifetimeAttemptCap(1)).toBe(9)
    expect(lifetimeAttemptCap(2)).toBe(9)
    expect(lifetimeAttemptCap(3)).toBe(9)
  })

  it('never exceeds the ceiling, whatever is passed in', () => {
    for (const n of [0, 1, 2, 3, 4, 99, -5]) {
      expect(lifetimeAttemptCap(n)).toBeLessThanOrEqual(MAX_LIFETIME_ATTEMPTS)
    }
  })

  it('treats a missing repeat count as a real campaign, not unlimited', () => {
    expect(lifetimeAttemptCap(null)).toBe(9)
    expect(lifetimeAttemptCap(undefined)).toBe(9)
  })

  it('keeps the per-visit count separate, and clamped to three', () => {
    // This is the number the 1x/2x/3x control actually sets.
    expect(backToBackAttempts(1)).toBe(1)
    expect(backToBackAttempts(2)).toBe(2)
    expect(backToBackAttempts(3)).toBe(3)
    expect(backToBackAttempts(9)).toBe(3)
    expect(backToBackAttempts(0)).toBe(1)
    expect(backToBackAttempts(null)).toBe(1)
  })

  it('lifespan is a total, not a multiple of the per-visit count', () => {
    // The distinction the comments lost: 3x does not earn more life than 1x.
    expect(lifetimeAttemptCap(3)).toBe(lifetimeAttemptCap(1))
    expect(backToBackAttempts(3)).not.toBe(backToBackAttempts(1))
  })
})
