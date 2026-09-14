// =============================================================================
// HOURS DIALED IS NOT THE SUM OF CALL DURATIONS, AND IT IS NOT THE SHIFT EITHER
// =============================================================================
// Three different numbers get confused here, and the product was reporting the
// least useful one.
//
//   TALK TIME       seconds actually connected to a human.
//   CALL DURATION   every line open, ringing included. Summing these answers
//                   "how long were the lines up", which on a 20% connect rate
//                   is a small fraction of the shift: an agent dialing all day
//                   accumulated about an hour and read as barely working.
//   HOURS DIALED    how long the dial sequence was actually RUNNING.
//
// The last one is what an operator means, and the subtlety is that it must not
// become "clocked in". An agent who dials, then leaves the sequence for nine
// minutes, then dials again has not been dialing for nine minutes. So the time
// BETWEEN calls is credited only up to a bounded wrap-up allowance; beyond
// that they are paused and it does not count.
//
// WHY IT IS DERIVED RATHER THAN RECORDED. agent_sessions holds one row per
// user and is upserted, so it carries current state and no history at all.
// Reconstructing from call timestamps has the considerable advantage of
// working backwards over every call already on file.
// =============================================================================

/**
 * The most inter-call time that counts as working.
 *
 * Two minutes. Between one call ending and the next going out an agent is
 * dispositioning, reading the next lead, taking a breath, and that is dialing.
 * Ten minutes is not, and without a ceiling every pause short of the session
 * break below would have been billed to the shift.
 */
export const MAX_GAP_CREDIT_SECONDS = 120

/**
 * A gap beyond which this is a separate stretch of work rather than a pause.
 *
 * Only affects the `sessions` count. Time past MAX_GAP_CREDIT_SECONDS is
 * already uncredited, so this changes no duration, it just distinguishes "took
 * a break" from "came back after lunch".
 */
export const IDLE_GAP_SECONDS = 10 * 60

export interface DialedCall {
  created_at: string
  /** Wall clock, dial to hangup. 0 or null means the call never closed. */
  duration?: number | null
  /** Answer to hangup. Null for a call nobody picked up. */
  talk_seconds?: number | null
}

export interface DialingTime {
  /** Seconds the dial sequence was running: calls plus bounded wrap-up. */
  dialedSeconds: number
  /** Seconds actually connected to a human. A subset of dialedSeconds. */
  talkSeconds: number
  /** Seconds between calls that were NOT credited, i.e. paused. */
  pausedSeconds: number
  /** How many separate stretches of work this was. */
  sessions: number
}

/**
 * Reconstruct dialing time from a user's calls.
 *
 * Implemented by merging each call's [start, end] interval, bridging any gap
 * up to the wrap-up allowance, then summing the merged spans. Doing it with
 * intervals rather than by adding durations is what makes predictive correct:
 * it puts several lines out at once, and summing their durations would count
 * the same wall-clock second three times over.
 *
 * The gap is measured END to START, never start to start. A twenty-minute
 * conversation puts twenty minutes between two dial timestamps, and a
 * start-to-start rule would read an agent's best call of the day as a pause.
 *
 * @param calls any order; sorted internally
 */
export function computeDialingTime(calls: DialedCall[]): DialingTime {
  const rows = calls
    .map(c => {
      const start = new Date(c.created_at).getTime()
      // A call with no duration never closed. Treated as instantaneous: the
      // conservative choice, since it cannot inflate the shift.
      const dur = typeof c.duration === 'number' && c.duration > 0 ? c.duration : 0
      return { start, end: start + dur * 1000, talk: c.talk_seconds ?? 0 }
    })
    .filter(r => Number.isFinite(r.start))
    .sort((a, b) => a.start - b.start)

  if (rows.length === 0) {
    return { dialedSeconds: 0, talkSeconds: 0, pausedSeconds: 0, sessions: 0 }
  }

  const creditMs = MAX_GAP_CREDIT_SECONDS * 1000
  const idleMs = IDLE_GAP_SECONDS * 1000

  let dialedMs = 0
  let pausedMs = 0
  let talkSeconds = rows[0].talk
  let sessions = 1

  let spanStart = rows[0].start
  let spanEnd = rows[0].end

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    talkSeconds += r.talk

    const gapMs = r.start - spanEnd
    if (gapMs <= 0) {
      // Overlapping lines. max() so a short line that ended early cannot pull
      // the end of the span backwards.
      spanEnd = Math.max(spanEnd, r.end)
      continue
    }
    if (gapMs <= creditMs) {
      // Wrap-up. Still dialing, so the gap is absorbed into the span.
      spanEnd = Math.max(spanEnd, r.end)
      continue
    }
    // Paused. Bank what was worked, credit nothing for the gap, and start a
    // fresh span at this call.
    dialedMs += spanEnd - spanStart + creditMs
    pausedMs += gapMs - creditMs
    if (gapMs > idleMs) sessions += 1
    spanStart = r.start
    spanEnd = r.end
  }
  // The final span gets the same wrap-up allowance as every other: the agent
  // was still working after the last call landed.
  dialedMs += spanEnd - spanStart + creditMs

  return {
    dialedSeconds: Math.max(0, Math.round(dialedMs / 1000)),
    talkSeconds: Math.max(0, Math.round(talkSeconds)),
    pausedSeconds: Math.max(0, Math.round(pausedMs / 1000)),
    sessions,
  }
}
