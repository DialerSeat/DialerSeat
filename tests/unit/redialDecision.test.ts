import { describe, it, expect } from 'vitest'
import { reachedAHuman, shouldRedial, shouldResetAttemptCount } from '@/lib/redialDecision'

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

describe('total dials per mode, on a voicemail every time', () => {
  /**
   * Walks the sequence the poll actually walks: dial, get a machine verdict,
   * ask whether to go again. The count is what the agent sees.
   *
   * 1x is the only try. 2x is one more try after the first. 3x is two more
   * after the first.
   */
  function dialsUntilItStops(maxAttempts: number): number {
    let attempts = 1
    while (
      shouldRedial({
        // A voicemail: connected, but AMD called it a machine.
        reachedAHuman: reachedAHuman('machine', true, true),
        alreadyQueued: false,
        attemptsSoFar: attempts,
        maxAttempts,
      })
    ) {
      attempts++
      if (attempts > 10) throw new Error('redial loop did not terminate')
    }
    return attempts
  }

  it('1x dials once', () => {
    expect(dialsUntilItStops(1)).toBe(1)
  })

  it('2x dials the same lead twice', () => {
    expect(dialsUntilItStops(2)).toBe(2)
  })

  it('3x dials the same lead three times', () => {
    expect(dialsUntilItStops(3)).toBe(3)
  })

  it('a person answering ends it after one dial on every mode', () => {
    for (const maxAttempts of [1, 2, 3]) {
      expect(
        shouldRedial({
          reachedAHuman: reachedAHuman('human', true, false),
          alreadyQueued: false,
          attemptsSoFar: 1,
          maxAttempts,
        })
      ).toBe(false)
    }
  })
})

describe('shouldResetAttemptCount', () => {
  const T = Date.parse('2026-09-19T02:16:00Z')

  it('resets for a different lead', () => {
    expect(shouldResetAttemptCount({
      leadId: 'b', lastServedLeadId: 'a', lastDialedAt: T - 1000, now: T,
    })).toBe(true)
  })

  it('does NOT reset when the queue hands back the lead just worked', () => {
    // The 4-dials-on-2x case: rotation failed, same lead returned seconds
    // later, and the unconditional reset gave it a whole new budget.
    expect(shouldResetAttemptCount({
      leadId: 'a', lastServedLeadId: 'a', lastDialedAt: T - 11_000, now: T,
    })).toBe(false)
  })

  it('resets on a genuine later pass over a small queue', () => {
    // A queue with one dialable lead must not be refused for the rest of the
    // shift just because it keeps coming back round.
    expect(shouldResetAttemptCount({
      leadId: 'a', lastServedLeadId: 'a', lastDialedAt: T - 5 * 60_000, now: T,
    })).toBe(true)
  })

  it('resets when this session has never dialled the lead', () => {
    expect(shouldResetAttemptCount({
      leadId: 'a', lastServedLeadId: 'a', lastDialedAt: 0, now: T,
    })).toBe(true)
  })

  it('resets when there is no previous lead at all', () => {
    expect(shouldResetAttemptCount({
      leadId: 'a', lastServedLeadId: null, lastDialedAt: 0, now: T,
    })).toBe(true)
  })

  it('stops the budget resetting when the queue hands the lead straight back', () => {
    // The 4-dials-on-2x case. Rotation failed, so the server returned the
    // lead just worked; the unconditional reset then gave it a fresh pair of
    // attempts. Two passes, four dials, on a campaign set to two.
    //
    // This asserts what the guard fixes and no more: the SECOND pass gets no
    // redials. It does not stop the re-serve itself — a pass still places its
    // opening dial — so a lead the queue keeps handing back still gets one
    // dial per pass until rotation is repaired. That is the remaining gap,
    // and it belongs to rotation, not to the counter.
    const T = Date.parse('2026-09-19T02:16:00Z')
    let now = T
    let counter = 1
    let lastServed: string | null = null
    let lastDialedAt = 0
    const perPass: number[] = []

    for (let pass = 0; pass < 2; pass++) {
      if (shouldResetAttemptCount({ leadId: 'a', lastServedLeadId: lastServed, lastDialedAt, now })) {
        counter = 1
      }
      lastServed = 'a'

      let dials = 1                       // the opening dial of the pass
      now += 10_000; lastDialedAt = now

      while (shouldRedial({
        reachedAHuman: false, alreadyQueued: false,
        attemptsSoFar: counter, maxAttempts: 2,
      })) {
        counter++; dials++
        now += 10_000; lastDialedAt = now
      }
      perPass.push(dials)
    }

    // Was [2, 2] — four dials. The second pass no longer earns a redial.
    expect(perPass).toEqual([2, 1])
  })
})
