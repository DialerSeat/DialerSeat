import { describe, it, expect } from 'vitest'
import { reachedAHuman, shouldRedial } from '@/lib/redialDecision'

describe('reachedAHuman', () => {
  it('is false for a voicemail even though the call connected', () => {
    // The regression this exists for. A voicemail answers: the carrier
    // connects and call-start is stamped before AMD returns 'machine'.
    expect(reachedAHuman('machine', true, true)).toBe(false)
  })

  it('is true when Telnyx says human', () => {
    expect(reachedAHuman('human', true, false)).toBe(true)
  })

  it('is true when the agent connected without any AMD verdict', () => {
    expect(reachedAHuman(null, true, false)).toBe(true)
  })

  it('is false for a call that never connected and got no verdict', () => {
    // Plain no-answer — the case the repeat setting is for.
    expect(reachedAHuman(null, false, false)).toBe(false)
  })

  it('lets the machine verdict beat an explicit human result', () => {
    // Contradictory inputs should not resolve to "person on the line".
    expect(reachedAHuman('human', true, true)).toBe(false)
  })
})

describe('shouldRedial', () => {
  const base = { reachedAHuman: false, alreadyQueued: false, attemptsSoFar: 1, maxAttempts: 2 }

  it('redials a voicemail on 2x before moving on', () => {
    expect(shouldRedial(base)).toBe(true)
  })

  it('stops once the attempts are spent', () => {
    expect(shouldRedial({ ...base, attemptsSoFar: 2 })).toBe(false)
  })

  it('never redials on 1x, whatever the outcome', () => {
    for (const attemptsSoFar of [1, 2, 3]) {
      expect(shouldRedial({ ...base, attemptsSoFar, maxAttempts: 1 })).toBe(false)
    }
  })

  it('gives 3x three attempts and then stops', () => {
    const at = (n: number) => shouldRedial({ ...base, attemptsSoFar: n, maxAttempts: 3 })
    expect([at(1), at(2), at(3)]).toEqual([true, true, false])
  })

  it('does not redial a lead the agent actually spoke to', () => {
    expect(shouldRedial({ ...base, reachedAHuman: true })).toBe(false)
  })

  it('does not queue a second redial while one is already queued', () => {
    expect(shouldRedial({ ...base, alreadyQueued: true })).toBe(false)
  })
})
