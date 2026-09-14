import { describe, it, expect } from 'vitest'
import { neverRang, reachedDials, reachedRatePct } from '@/lib/dialOutcome'

// =============================================================================
// This predicate decides which dials are allowed to count against an answer
// rate. Get it wrong in one direction and a real no-answer disappears, making
// every number look better than it is. Get it wrong in the other and the
// dead-socket rows come back, which is what rested the best number in the pool
// for having the worst answer rate.
//
// The shape it keys on was measured, not guessed: across every NO_ANSWER on a
// pool number, 1,128 had a duration of exactly zero and two had a normal
// twenty-to-thirty-second ring-out.
// =============================================================================

describe('neverRang: the dead-socket signature', () => {
  it('flags a dial with no answer and no duration', () => {
    expect(neverRang({ answered_at: null, duration: 0 })).toBe(true)
  })

  it('flags one whose duration is missing entirely', () => {
    // A row that predates the column, or a select that forgot it. Treated the
    // same way rather than silently counted as a genuine miss.
    expect(neverRang({ answered_at: null })).toBe(true)
  })

  it('does NOT flag a real ring-out', () => {
    // Nobody picked up, but the phone rang for 28 seconds. This is exactly the
    // case that must keep counting against the answer rate.
    expect(neverRang({ answered_at: null, duration: 28 })).toBe(false)
  })

  it('does NOT flag an answered call, whatever its duration', () => {
    expect(neverRang({ answered_at: '2026-09-13T10:00:00Z', duration: 0 })).toBe(false)
    expect(neverRang({ answered_at: '2026-09-13T10:00:00Z', duration: 42 })).toBe(false)
  })

  it('flags a call still in flight, which is the intended behaviour', () => {
    // duration is written at hangup, so a call ringing right now is
    // indistinguishable from one that never rang. Both are excluded because
    // neither is settled evidence, and counting a ringing call would count it
    // as a miss before it has had the chance to be answered.
    expect(neverRang({ answered_at: null, duration: 0 })).toBe(true)
  })
})

describe('reachedDials', () => {
  it('keeps ring-outs and answers, drops the phantoms', () => {
    const calls = [
      { answered_at: null, duration: 0 },                       // phantom
      { answered_at: null, duration: 25 },                      // real no-answer
      { answered_at: '2026-09-13T10:00:00Z', duration: 60 },    // answered
      { answered_at: null, duration: 0 },                       // phantom
    ]
    expect(reachedDials(calls)).toHaveLength(2)
  })
})

describe('reachedRatePct', () => {
  const answered = (c: { answered_at?: string | null }) => !!c.answered_at

  it('divides by dials that rang, not dials attempted', () => {
    // One answered, one rang out, eight phantoms. The honest rate is 50%, not
    // the 10% an attempted-dials denominator would report. This is the whole
    // distortion in miniature: platform-wide it reads 8.8% against a real 41.7%.
    const calls = [
      { answered_at: '2026-09-13T10:00:00Z', duration: 60 },
      { answered_at: null, duration: 25 },
      ...Array.from({ length: 8 }, () => ({ answered_at: null, duration: 0 })),
    ]
    expect(reachedRatePct(calls, answered)).toBe(50)
  })

  it('returns null when nothing rang, rather than zero', () => {
    // "Nobody answered" and "nothing was ever attempted" are different facts.
    // Rendering them the same way reports a floor as failing on a day it did
    // not dial.
    const calls = Array.from({ length: 5 }, () => ({ answered_at: null, duration: 0 }))
    expect(reachedRatePct(calls, answered)).toBeNull()
  })

  it('returns null for no calls at all', () => {
    expect(reachedRatePct([], answered)).toBeNull()
  })

  it('reports 100 when every dial that rang was answered', () => {
    const calls = [
      { answered_at: '2026-09-13T10:00:00Z', duration: 30 },
      { answered_at: '2026-09-13T10:01:00Z', duration: 30 },
      { answered_at: null, duration: 0 },
    ]
    expect(reachedRatePct(calls, answered)).toBe(100)
  })
})
