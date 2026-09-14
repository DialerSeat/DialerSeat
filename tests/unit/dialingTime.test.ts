import { describe, it, expect } from 'vitest'
import {
  computeDialingTime,
  MAX_GAP_CREDIT_SECONDS,
  IDLE_GAP_SECONDS,
} from '@/lib/dialingTime'

// =============================================================================
// Hours dialed is what an owner reads to decide whether somebody worked, so
// the two ways it can be wrong are the two that matter: crediting a break as
// work, and reading a long conversation as a break.
//
// It also has to survive predictive, which puts several lines out at once. The
// naive version of this figure sums call durations, and three overlapping
// lines then report three hours for one hour of wall clock.
//
// All timestamps are built off one base instant so the arithmetic in each test
// is readable as seconds rather than as clock times.
// =============================================================================

const BASE = Date.parse('2026-09-13T15:00:00.000Z')

/** A call starting `offset` seconds in, lasting `duration`, `talk` connected. */
function call(offset: number, duration: number, talk: number | null = null) {
  return {
    created_at: new Date(BASE + offset * 1000).toISOString(),
    duration,
    talk_seconds: talk,
  }
}

describe('computeDialingTime: the empty and trivial cases', () => {
  it('reports nothing for no calls, rather than a wrap-up allowance', () => {
    expect(computeDialingTime([])).toEqual({
      dialedSeconds: 0, talkSeconds: 0, pausedSeconds: 0, sessions: 0,
    })
  })

  it('gives a single call its own length plus one wrap-up allowance', () => {
    // The allowance applies to the last span too: the agent was still working
    // after the call landed, dispositioning it.
    const r = computeDialingTime([call(0, 30, 25)])
    expect(r.dialedSeconds).toBe(30 + MAX_GAP_CREDIT_SECONDS)
    expect(r.talkSeconds).toBe(25)
    expect(r.sessions).toBe(1)
  })

  it('treats a call that never closed as instantaneous rather than open-ended', () => {
    // duration 0 is the in-flight sentinel. Counting it as still running would
    // let one stuck call inflate a shift without limit.
    const r = computeDialingTime([call(0, 0)])
    expect(r.dialedSeconds).toBe(MAX_GAP_CREDIT_SECONDS)
  })
})

describe('computeDialingTime: what counts as still dialing', () => {
  it('absorbs a short gap between calls as wrap-up', () => {
    // 30s call, 60s gap, 30s call. The gap is under the allowance, so the
    // whole stretch is one continuous span: 0 -> 120, plus the trailing credit.
    const r = computeDialingTime([call(0, 30, 10), call(90, 30, 10)])
    expect(r.dialedSeconds).toBe(120 + MAX_GAP_CREDIT_SECONDS)
    expect(r.pausedSeconds).toBe(0)
    expect(r.sessions).toBe(1)
  })

  it('credits only the allowance of a long gap, and banks the rest as paused', () => {
    // 30s call, then nothing for 10 minutes, then another call. The agent was
    // not dialing for those ten minutes, and this is the assertion that stops
    // "clocked in" being reported as "dialing".
    const gap = 600
    const r = computeDialingTime([call(0, 30, 10), call(30 + gap, 30, 10)])
    // First span 0->30 plus its allowance, second span plus its own.
    expect(r.dialedSeconds).toBe(30 + MAX_GAP_CREDIT_SECONDS + 30 + MAX_GAP_CREDIT_SECONDS)
    expect(r.pausedSeconds).toBe(gap - MAX_GAP_CREDIT_SECONDS)
  })

  it('measures the gap from the END of a call, not its start', () => {
    // A twenty minute conversation puts twenty minutes between two DIAL
    // timestamps. Measured start to start, an agent's best call of the day
    // would read as a pause and cost them the whole of it.
    const talk = 20 * 60
    const r = computeDialingTime([call(0, talk, talk), call(talk + 10, 30, 5)])
    expect(r.pausedSeconds).toBe(0)
    expect(r.sessions).toBe(1)
    expect(r.dialedSeconds).toBe(talk + 10 + 30 + MAX_GAP_CREDIT_SECONDS)
  })
})

describe('computeDialingTime: predictive puts several lines out at once', () => {
  it('counts one wall-clock hour once, however many lines were open', () => {
    // Three lines dialed together, all 60s. Summing durations would say 180.
    const r = computeDialingTime([
      call(0, 60, 0), call(0, 60, 0), call(0, 60, 0),
    ])
    expect(r.dialedSeconds).toBe(60 + MAX_GAP_CREDIT_SECONDS)
  })

  it('does not let a short line pull the end of the span backwards', () => {
    // A 10s line starting after a 90s one must not truncate the span to 10s.
    const r = computeDialingTime([call(0, 90, 0), call(5, 10, 0)])
    expect(r.dialedSeconds).toBe(90 + MAX_GAP_CREDIT_SECONDS)
  })
})

describe('computeDialingTime: sessions', () => {
  it('counts a second session only past the idle threshold', () => {
    const justUnder = IDLE_GAP_SECONDS - 10
    const under = computeDialingTime([call(0, 30, 0), call(30 + justUnder, 30, 0)])
    expect(under.sessions).toBe(1)

    const over = computeDialingTime([call(0, 30, 0), call(30 + IDLE_GAP_SECONDS + 10, 30, 0)])
    expect(over.sessions).toBe(2)
  })

  it('changes no duration when a gap crosses the idle threshold', () => {
    // Everything past the wrap-up allowance is already uncredited, so the idle
    // threshold distinguishes "took a break" from "came back after lunch" and
    // must not also change the time.
    const a = computeDialingTime([call(0, 30, 0), call(30 + IDLE_GAP_SECONDS - 10, 30, 0)])
    const b = computeDialingTime([call(0, 30, 0), call(30 + IDLE_GAP_SECONDS + 10, 30, 0)])
    expect(b.dialedSeconds).toBe(a.dialedSeconds)
  })
})

describe('computeDialingTime: talk time', () => {
  it('sums talk seconds independently of the dialing span', () => {
    const r = computeDialingTime([call(0, 60, 45), call(70, 60, 30)])
    expect(r.talkSeconds).toBe(75)
  })

  it('treats a null talk_seconds as no talking, never as the call duration', () => {
    // An unanswered call has null here. Falling back to duration would report
    // ring time as conversation.
    const r = computeDialingTime([call(0, 45, null)])
    expect(r.talkSeconds).toBe(0)
  })

  it('never reports more talk time than dialing time', () => {
    // The invariant the whole figure rests on: talk is a subset of dialed.
    const r = computeDialingTime([call(0, 300, 300), call(400, 200, 200)])
    expect(r.talkSeconds).toBeLessThanOrEqual(r.dialedSeconds)
  })
})

describe('computeDialingTime: input robustness', () => {
  it('does not care what order the calls arrive in', () => {
    const rows = [call(300, 30, 5), call(0, 30, 5), call(150, 30, 5)]
    const forwards = computeDialingTime(rows)
    const backwards = computeDialingTime([...rows].reverse())
    expect(forwards).toEqual(backwards)
  })

  it('ignores a row whose timestamp cannot be parsed', () => {
    const r = computeDialingTime([
      { created_at: 'not a date', duration: 30, talk_seconds: 10 },
      call(0, 30, 10),
    ])
    expect(r.dialedSeconds).toBe(30 + MAX_GAP_CREDIT_SECONDS)
    // The unparseable row contributes no talk time either, since it is dropped
    // before any of the arithmetic.
    expect(r.talkSeconds).toBe(10)
  })
})
