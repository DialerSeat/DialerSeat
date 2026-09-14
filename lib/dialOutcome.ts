// =============================================================================
// A DIAL THAT NEVER RANG IS NOT A CALL SOMEBODY DECLINED TO ANSWER
// =============================================================================
// For a long stretch the dialer placed the lead leg without waiting to learn
// whether the agent's browser SIP socket was up. With a dead socket the lead
// leg was created, torn down before it rang, and written down as NO_ANSWER
// against a person who was never called. That bug is fixed. Its rows are not,
// and they are most of the table: 7,117 of 9,007 calls on file never rang.
//
// The damage is to every RATE computed from them, because they land in the
// denominator. Platform answer rate reads 8.8% against a real 41.7% — a factor
// of five — and the same distortion runs through connect rate, contact rate,
// and per-number health, which is how the best number in the pool came to be
// rested for having the worst answer rate.
//
// WHAT THE TEST IS. A lead leg that reached the destination has a duration,
// because the ring is wall clock. Measured across every NO_ANSWER on a pool
// number: 1,128 have a duration of exactly zero and two have a normal twenty
// to thirty second ring-out. Zero duration with nobody answering is not a
// quiet phone.
//
// A call still in flight matches this too, and that is correct rather than a
// side effect: duration is written at hangup, so a call ringing right now looks
// identical, and it is not evidence either way yet. Counting it would count it
// as a miss.
//
// WHAT THIS IS NOT FOR. Dial COUNTS. Those attempts really were made and they
// really were billed — detection runs per leg whether or not anyone answers —
// so they belong in "how many dials" and in any cost figure. What they do not
// belong in is the denominator of "how often did somebody pick up".
// =============================================================================

export interface DialAttempt {
  answered_at?: string | null
  duration?: number | null
}

/**
 * True when this dial never reached the destination.
 *
 * Exclude from the denominator of any answer, connect or contact rate. Keep in
 * dial counts and in cost.
 */
export function neverRang(c: DialAttempt): boolean {
  return !c.answered_at && (c.duration ?? 0) === 0
}

/** The subset that actually rang somebody. */
export function reachedDials<T extends DialAttempt>(calls: T[]): T[] {
  return calls.filter(c => !neverRang(c))
}

/**
 * A rate over the dials that actually rang, as a percentage.
 *
 * Null rather than zero when nothing rang: "nobody answered" and "nothing was
 * ever attempted" are different facts, and a page that renders them the same
 * way is one that reports a floor as failing on a day it did not dial.
 */
export function reachedRatePct<T extends DialAttempt>(
  calls: T[],
  isHit: (c: T) => boolean
): number | null {
  const reached = reachedDials(calls)
  if (reached.length === 0) return null
  return (reached.filter(isHit).length / reached.length) * 100
}
