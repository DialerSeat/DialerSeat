import { describe, it, expect } from 'vitest'
import {
  surplusAbandonRatio,
  estimateHumanRate,
  legalLineCount,
  planRound,
  breakerTripped,
  classifyLeg,
  HUMAN_RATE_PRIOR,
  PROJECTION_HORIZON_HUMANS,
} from '@/lib/predictive/pacing'

describe('surplusAbandonRatio', () => {
  it('is zero for one line, which cannot abandon anyone', () => {
    expect(surplusAbandonRatio(1, 0.2)).toBe(0)
  })

  it('matches the closed form for two lines: h / 2', () => {
    // L=2: (2h - (1 - (1-h)^2)) / 2h = h^2 / 2h = h/2
    expect(surplusAbandonRatio(2, 0.1)).toBeCloseTo(0.05, 10)
    expect(surplusAbandonRatio(2, 0.04)).toBeCloseTo(0.02, 10)
  })

  it('grows with lines and with the human rate', () => {
    expect(surplusAbandonRatio(3, 0.1)).toBeGreaterThan(surplusAbandonRatio(2, 0.1))
    expect(surplusAbandonRatio(2, 0.2)).toBeGreaterThan(surplusAbandonRatio(2, 0.1))
  })

  it('is zero when nobody ever answers', () => {
    expect(surplusAbandonRatio(4, 0)).toBe(0)
  })
})

describe('estimateHumanRate', () => {
  it('is the prior with no evidence', () => {
    expect(estimateHumanRate(0, 0)).toBeCloseTo(HUMAN_RATE_PRIOR, 10)
  })

  it('moves toward the measured rate as dials accumulate', () => {
    const early = estimateHumanRate(1, 20)     // 5% measured, 20 dials
    const later = estimateHumanRate(50, 1000)  // 5% measured, 1000 dials
    expect(early).toBeGreaterThan(later)
    expect(later).toBeCloseTo(0.0529, 3)
  })
})

describe('legalLineCount', () => {
  const base = {
    cap: 3,
    humanRate: 0.05,
    answered30d: 0,
    abandoned30d: 0,
    sellerMessageReady: true,
  }

  it('always allows one line', () => {
    const r = legalLineCount({ ...base, humanRate: 0.9, cap: 5 })
    expect(r.lines).toBe(1)
    expect(r.limitedBy).toBe('law')
  })

  it('keeps a new campaign at one line until it has a record to absorb abandons', () => {
    // No history: the projection is the per-round ratio itself, h/2 = 2.5% at h=5%.
    expect(legalLineCount(base).lines).toBe(1)
  })

  it('allows a second line once the 30-day record has room under the target', () => {
    // 200 people answered, none abandoned. Two lines at 5% project
    // (0 + 0.025 * 50) / 250 = 0.5%.
    const r = legalLineCount({ ...base, answered30d: 200 })
    expect(r.lines).toBeGreaterThanOrEqual(2)
    expect(r.projectedPct).toBeLessThanOrEqual(2)
  })

  it('never projects past the target at the count it picks', () => {
    for (const h of [0.03, 0.06, 0.1, 0.15]) {
      for (const answered of [0, 50, 200, 1000]) {
        for (const abandoned of [0, 1, 3]) {
          const r = legalLineCount({ ...base, cap: 5, humanRate: h, answered30d: answered, abandoned30d: abandoned })
          if (r.lines > 1) expect(r.projectedPct).toBeLessThanOrEqual(2 + 1e-9)
        }
      }
    }
  })

  it('drops to one line when the measured rate reaches 2.5%', () => {
    const r = legalLineCount({ ...base, answered30d: 400, abandoned30d: 10 })
    expect(r.lines).toBe(1)
    expect(r.limitedBy).toBe('degraded')
  })

  it('refuses a second line without the seller message', () => {
    const r = legalLineCount({ ...base, answered30d: 1000, sellerMessageReady: false })
    expect(r.lines).toBe(1)
    expect(r.limitedBy).toBe('no_seller_message')
  })

  it('never exceeds the cap, and never exceeds five', () => {
    expect(legalLineCount({ ...base, answered30d: 100000, humanRate: 0.01, cap: 2 }).lines).toBe(2)
    expect(legalLineCount({ ...base, answered30d: 100000, humanRate: 0.01, cap: 50 }).lines).toBe(5)
  })

  it('uses the horizon it says it uses', () => {
    const r = legalLineCount({ ...base, answered30d: 100, cap: 2 })
    const expected = ((0 + surplusAbandonRatio(2, 0.05) * PROJECTION_HORIZON_HUMANS) /
      (100 + PROJECTION_HORIZON_HUMANS)) * 100
    expect(r.lines).toBe(2)
    expect(r.projectedPct).toBeCloseTo(expected, 10)
  })
})

describe('planRound', () => {
  it('dials leads owed a repeat first, in queue order, then fills with fresh ones', () => {
    const plan = planRound(3, [
      { leadId: 'b', position: 5 },
      { leadId: 'a', position: 2 },
    ])
    expect(plan.repeatIds).toEqual(['a', 'b'])
    expect(plan.freshNeeded).toBe(1)
  })

  it('never dials more repeats than lines', () => {
    const plan = planRound(1, [
      { leadId: 'b', position: 5 },
      { leadId: 'a', position: 2 },
    ])
    expect(plan.repeatIds).toEqual(['a'])
    expect(plan.freshNeeded).toBe(0)
  })

  it('is all fresh when nothing is owed', () => {
    expect(planRound(2, [])).toEqual({ repeatIds: [], freshNeeded: 2 })
  })
})

describe('breakerTripped', () => {
  it('trips only past six rounds of dials a minute', () => {
    expect(breakerTripped(12, 2)).toBe(false)
    expect(breakerTripped(13, 2)).toBe(true)
  })
})

describe('classifyLeg', () => {
  it('reads an answered machine as voicemail and anything else answered as a person', () => {
    expect(classifyLeg({ answered_at: 'x', amd_result: 'machine' })).toBe('voicemail')
    expect(classifyLeg({ answered_at: 'x', amd_result: 'fax_detected' })).toBe('voicemail')
    expect(classifyLeg({ answered_at: 'x', amd_result: 'human' })).toBe('person')
    expect(classifyLeg({ answered_at: 'x', amd_result: 'not_sure' })).toBe('person')
    expect(classifyLeg({ answered_at: 'x', amd_result: null })).toBe('person')
  })

  it('separates a number that cannot be reached from one nobody picked up', () => {
    expect(classifyLeg({ answered_at: null, amd_result: null, hangup_cause: 'timeout' })).toBe('no_answer')
    expect(classifyLeg({ answered_at: null, amd_result: null, hangup_cause: 'user_busy' })).toBe('no_answer')
    expect(classifyLeg({ answered_at: null, amd_result: null, hangup_cause: 'not_found' })).toBe('unreachable')
  })
})
