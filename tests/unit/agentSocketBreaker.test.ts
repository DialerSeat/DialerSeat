import { describe, it, expect } from 'vitest'
import {
  consecutiveFailures,
  verdictFor,
  agentSocketMessage,
  MIN_USEFUL_LIMIT,
} from '@/lib/agentSocketHealth'

// =============================================================================
// THE ONLY GUARD ON THE DIAL PATH THAT REFUSES
// =============================================================================
// Every other cost control on this path delays or downgrades. This one stops
// the dial, which means a bug here does not cost money — it stops the phones.
//
// So the cases below are weighted toward the ways it could wrongly fire, not
// toward the ways it could wrongly allow. Allowing a dial that fails costs
// about a second of ringing; refusing a dial that would have worked costs a
// conversation, and an agent who cannot work.

const failed = { disposition: 'AGENT_LEG_FAILED' }
const answered = { disposition: 'VOICEMAIL' }
const inFlight = { disposition: null }

describe('consecutiveFailures', () => {
  it('counts a clean run from the newest backwards', () => {
    expect(consecutiveFailures([failed, failed, failed])).toBe(3)
  })

  it('is zero when the most recent dial worked', () => {
    // The shape of an agent who just reloaded. Five failures are still in the
    // window, but the newest row proves the socket came back.
    expect(consecutiveFailures([answered, failed, failed, failed, failed, failed])).toBe(0)
  })

  it('stops at the first dial that was not a failure', () => {
    // NOT 5. A window total would say 5 here and refuse an agent who is working.
    expect(consecutiveFailures([failed, failed, answered, failed, failed, failed])).toBe(2)
  })

  it('treats an in-flight call as evidence the socket is alive', () => {
    // A NULL disposition means the call got far enough to be waiting on
    // something. Counting unknown as failure is how this turns into an outage.
    expect(consecutiveFailures([inFlight, failed, failed, failed, failed, failed])).toBe(0)
  })

  it('is zero on no rows at all', () => {
    // A brand new agent, or a quiet ten minutes. Never a reason to refuse.
    expect(consecutiveFailures([])).toBe(0)
  })

  it('does not count other failure dispositions', () => {
    // NO_ANSWER is the lead not picking up. It says nothing about our socket,
    // and it is the single most common disposition on the platform — folding
    // it in would refuse every agent working a cold list.
    expect(consecutiveFailures([
      { disposition: 'NO_ANSWER' },
      { disposition: 'NO_ANSWER' },
      { disposition: 'NO_ANSWER' },
    ])).toBe(0)
  })

  it('counts the real broken session and would have stopped it at five', () => {
    // 14 Sept, 12:00 ET: 41 of 58 dials ended AGENT_LEG_FAILED, averaging 1.4
    // seconds each, while a different agent in the same hour failed 2.7% of
    // 112. At a limit of 5 this fires on the fifth dial, not the forty-first.
    const brokenSession = Array.from({ length: 41 }, () => failed)
    expect(consecutiveFailures(brokenSession)).toBe(41)
    expect(consecutiveFailures(brokenSession) >= 5).toBe(true)
  })

  it('sits in the empty gap in the real run-length distribution', () => {
    // Thirty days of traffic, every run of consecutive AGENT_LEG_FAILED:
    //
    //     run length   1    2    3    4   ...   12    28
    //     times seen  15    3    3    1    0     1     1
    //
    // Nothing ever ran 5 through 11. This is the actual argument for the
    // default of 5 -- not the per-dial probability, because failures cluster.
    const observedNoiseRuns = [1, 1, 2, 3, 4]
    const observedDeadSocketRuns = [12, 28]
    const LIMIT = 5

    for (const len of observedNoiseRuns) {
      const rows = Array.from({ length: len }, () => failed)
      expect(verdictFor(rows, LIMIT).broken).toBe(false)
    }
    for (const len of observedDeadSocketRuns) {
      const rows = Array.from({ length: len }, () => failed)
      expect(verdictFor(rows, LIMIT).broken).toBe(true)
    }
  })

  it('does not fire on a healthy session with scattered failures', () => {
    // 2.7% of 112 dials is 3 failures. Scattered, they never form a run, and
    // the guard must never fire on this shape.
    const healthy = Array.from({ length: 112 }, (_, i) =>
      i === 8 || i === 47 || i === 95 ? failed : answered
    )
    expect(consecutiveFailures(healthy)).toBe(0)
  })
})

describe('verdictFor', () => {
  it('refuses at the limit, not before it', () => {
    const four = Array.from({ length: 4 }, () => failed)
    expect(verdictFor(four, 5).broken).toBe(false)
    expect(verdictFor([...four, failed], 5).broken).toBe(true)
  })

  it('is off at 0, and off below the useful minimum', () => {
    // The off switch has to work without a deploy, and it has to work even
    // when the run is long -- an operator turning this off mid-incident must
    // not have to argue with it.
    const many = Array.from({ length: 40 }, () => failed)
    expect(verdictFor(many, 0).broken).toBe(false)
    for (let l = 0; l < MIN_USEFUL_LIMIT; l++) {
      expect(verdictFor(many, l).broken).toBe(false)
    }
    expect(verdictFor(many, MIN_USEFUL_LIMIT).broken).toBe(true)
  })

  it('is off on a nonsense limit rather than guessing', () => {
    const many = Array.from({ length: 40 }, () => failed)
    expect(verdictFor(many, NaN).broken).toBe(false)
    expect(verdictFor(many, Infinity).broken).toBe(false)
    expect(verdictFor(many, -1).broken).toBe(false)
  })

  it('echoes the limit so the refusal can explain itself', () => {
    const v = verdictFor(Array.from({ length: 7 }, () => failed), 5)
    expect(v).toEqual({ broken: true, consecutive: 7, limit: 5 })
  })
})

describe('agentSocketMessage', () => {
  it('names the fix rather than the fault, and says no leads were rung', () => {
    const msg = agentSocketMessage({ broken: true, consecutive: 5, limit: 5 })
    // The agent can do nothing about a SIP socket. They can reload.
    expect(msg).toMatch(/reload/i)
    // And they need to know the leads are intact, or they will assume the
    // list was burned and go looking for it.
    expect(msg).toMatch(/before any leads were rung/i)
    expect(msg).toContain('5')
  })
})
