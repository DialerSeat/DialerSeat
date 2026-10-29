import { describe, it, expect } from 'vitest'
import { classifyLeg, summariseSweep, type WatchdogThresholds } from '@/lib/legWatchdog'

// =============================================================================
// THE COST OF A WRONG ANSWER HERE IS A CALL CUT OFF MID-SENTENCE
// =============================================================================
// Every one of these exists because the alternative is finding out on the floor.
// The bias under test throughout is the same: when this function is unsure, it
// must leave the leg alone.

const NOW = Date.parse('2026-09-17T12:00:00Z')
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString()

const T: WatchdogThresholds = {
  enabled: true,
  runawaySeconds: 5400,   // 90 min
  untrackedSeconds: 600,  // 10 min
  finishedSeconds: 120,   // 2 min
}

const openRow = (startedSecondsAgo: number) => ({
  createdAt: ago(startedSecondsAgo), duration: null, disposition: null,
})

describe('a live conversation is never touched', () => {
  it('leaves an open row that is minutes old', () => {
    const v = classifyLeg(
      { callControlId: 'a', row: openRow(300), sighting: { firstSeenAt: ago(300), timesSeen: 5 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
    expect(v.reason).toContain('a live call')
  })

  it('leaves a genuinely long conversation below the ceiling', () => {
    // 63 minutes is the longest REAL call on this account, carrier-confirmed.
    // If this test ever fails, the ceiling has been set below reality.
    const v = classifyLeg(
      { callControlId: 'a', row: openRow(3780), sighting: { firstSeenAt: ago(3780), timesSeen: 40 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
  })
})

describe('row_finished — our own records say nobody is on it', () => {
  it('ends a leg whose row already has a duration', () => {
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: { createdAt: ago(400), duration: 42, disposition: null },
        sighting: { firstSeenAt: ago(400), timesSeen: 3 },
      }, T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('row_finished')
  })

  it('ends a leg whose row was dispositioned', () => {
    // This is the stranded-prospect case: agent leg dropped after the bridge,
    // agent dispositioned and moved on, lead leg still up and billing.
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: { createdAt: ago(400), duration: null, disposition: 'NOT INTERESTED' },
        sighting: { firstSeenAt: ago(400), timesSeen: 3 },
      }, T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('row_finished')
  })

  it('waits out the grace period, because webhooks arrive out of order', () => {
    // A hangup webhook can write duration a moment before the leg actually
    // tears down. Ending here would race the carrier for no gain.
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: { createdAt: ago(30), duration: 28, disposition: null },
        sighting: { firstSeenAt: ago(30), timesSeen: 2 },
      }, T, NOW,
    )
    expect(v.action).toBe('leave')
    expect(v.reason).toContain('grace')
  })

  it('treats duration 0 as in-flight, not as finished', () => {
    // 0 is this codebase's in-flight sentinel, not "no time elapsed".
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: { createdAt: ago(400), duration: 0, disposition: null },
        sighting: { firstSeenAt: ago(400), timesSeen: 3 },
      }, T, NOW,
    )
    expect(v.action).toBe('leave')
  })
})

describe('untracked — live on the carrier, unknown to us', () => {
  it('never ends a leg on its first sighting', () => {
    // The leg may simply be racing its own INSERT.
    const v = classifyLeg(
      { callControlId: 'a', row: null, sighting: { firstSeenAt: ago(9999), timesSeen: 1 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
    expect(v.reason).toContain('second sighting')
  })

  it('never ends a leg it cannot date at all', () => {
    const v = classifyLeg({ callControlId: 'a', row: null, sighting: null }, T, NOW)
    expect(v.action).toBe('leave')
    expect(v.ageSeconds).toBeNull()
  })

  it('ends one observed past the threshold across several passes', () => {
    const v = classifyLeg(
      { callControlId: 'a', row: null, sighting: { firstSeenAt: ago(900), timesSeen: 8 } },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('untracked')
  })

  it('holds off while still inside the threshold', () => {
    const v = classifyLeg(
      { callControlId: 'a', row: null, sighting: { firstSeenAt: ago(120), timesSeen: 3 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
  })

  it('marks an untracked age as a lower bound, not the real age', () => {
    // First seen 5 minutes ago says "at least 5 minutes", never "exactly".
    const v = classifyLeg(
      { callControlId: 'a', row: null, sighting: { firstSeenAt: ago(300), timesSeen: 4 } },
      T, NOW,
    )
    expect(v.ageIsLowerBound).toBe(true)
  })
})

describe('runaway — the backstop that outranks everything', () => {
  it('ends a leg past the ceiling even though its row looks healthy', () => {
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: openRow(6000),
        sighting: { firstSeenAt: ago(6000), timesSeen: 50 },
      }, T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('runaway')
  })

  it('ends an untracked leg past the ceiling without waiting on rule 3', () => {
    const v = classifyLeg(
      { callControlId: 'a', row: null, sighting: { firstSeenAt: ago(7200), timesSeen: 2 } },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('runaway')
  })
})

describe('age is the better of the two sources', () => {
  it('prefers the calls row over a later first sighting', () => {
    // The watchdog only started watching 60s ago; the row says the call began
    // 40 minutes ago. The row wins.
    const v = classifyLeg(
      { callControlId: 'a', row: openRow(2400), sighting: { firstSeenAt: ago(60), timesSeen: 2 } },
      T, NOW,
    )
    expect(v.ageSeconds).toBe(2400)
    expect(v.ageIsLowerBound).toBe(false)
  })

  it('survives a malformed timestamp instead of throwing', () => {
    const v = classifyLeg(
      {
        callControlId: 'a',
        row: { createdAt: 'not a date', duration: null, disposition: null },
        sighting: null,
      }, T, NOW,
    )
    expect(v.action).toBe('leave')
    expect(v.ageSeconds).toBeNull()
  })
})

describe('summariseSweep counts by rule, not just a total', () => {
  it('separates what was ended and why', () => {
    const verdicts = [
      classifyLeg({ callControlId: 'a', row: { createdAt: ago(400), duration: 5, disposition: null }, sighting: { firstSeenAt: ago(400), timesSeen: 3 } }, T, NOW),
      classifyLeg({ callControlId: 'b', row: null, sighting: { firstSeenAt: ago(900), timesSeen: 5 } }, T, NOW),
      classifyLeg({ callControlId: 'c', row: openRow(300), sighting: { firstSeenAt: ago(300), timesSeen: 3 } }, T, NOW),
    ]
    const s = summariseSweep(verdicts)
    expect(s.live).toBe(3)
    expect(s.ended).toBe(2)
    expect(s.byRule.row_finished).toBe(1)
    expect(s.byRule.untracked).toBe(1)
    expect(s.byRule.runaway).toBe(0)
    expect(s.untrackedLive).toBe(1)
  })
})

// ── PREDICTIVE SEATS ─────────────────────────────────────────────────────────
// A seat has no calls row by design. Read as untracked, it was ended at 120s,
// every four minutes, on 28 Oct 2026, and the browser halves of those killed
// seats were the legs that stayed up for hours.
describe('a predictive seat is judged by its agent, not its row', () => {
  const seen = (s: number, times = 10) => ({ firstSeenAt: ago(s), timesSeen: times })

  it('leaves a seat whose agent is present, however long it has been untracked', () => {
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(900), seat: { heartbeatAgeSeconds: 4 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
  })

  it('leaves a present seat past the ordinary runaway ceiling, below the seat ceiling', () => {
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(2 * 3600), seat: { heartbeatAgeSeconds: 5 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
  })

  it('leaves a seat whose agent is in a throttled background tab', () => {
    // A hidden tab beats about once a minute; that agent is still there.
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(900), seat: { heartbeatAgeSeconds: 90 } },
      T, NOW,
    )
    expect(v.action).toBe('leave')
  })

  it('ends a seat once its agent has been silent for minutes', () => {
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(300), seat: { heartbeatAgeSeconds: 200 } },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('seat_abandoned')
  })

  it('ends a seat on its first sighting when nobody is behind it', () => {
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(0, 1), seat: { heartbeatAgeSeconds: null } },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('seat_abandoned')
  })

  it('ends a seat past the seat ceiling even with its agent present', () => {
    const v = classifyLeg(
      { callControlId: 's', row: null, sighting: seen(4.5 * 3600), seat: { heartbeatAgeSeconds: 3 } },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('runaway')
  })

  it('still ends an untracked leg that is not a seat', () => {
    const v = classifyLeg(
      { callControlId: 'x', row: null, sighting: seen(900, 5) },
      T, NOW,
    )
    expect(v.action).toBe('end')
    expect(v.rule).toBe('untracked')
  })
})
