import { describe, it, expect } from 'vitest'
import {
  computeExposure,
  callsToClear,
  isAbandoned,
  isShortDuration,
  SHORT_DURATION_LIMIT,
  ABANDONED_LIMIT,
  type ExposureRow,
} from '@/lib/surchargeExposure'

// =============================================================================
// TWO RATIOS, TWO DIFFERENT DENOMINATORS
// =============================================================================
// docs/COST-FINDINGS.md §1i was written wrong twice. First it measured short
// duration against connected calls (right) and abandonment against
// answered-but-unbridged (wrong thing entirely). Then it "corrected" short
// duration onto total outbound (wrong) while fixing abandonment.
//
// Telnyx's actual wording: short duration is "Count of short duration calls
// connected / Total count of CONNECTED calls"; abandoned is over TOTAL OUTBOUND.
// These tests exist to stop that flip-flopping a third time.

function row(p: Partial<ExposureRow>): ExposureRow {
  return {
    placed: true,
    answered: false,
    talkSeconds: 0,
    dialSource: 'user_dial',
    disposition: null,
    hangupCause: null,
    ...p,
  }
}

const connectedShort = row({ answered: true, talkSeconds: 3 })
const connectedLong = row({ answered: true, talkSeconds: 90 })
const rangOut = row({ answered: false, disposition: 'NO_ANSWER' })
const agentLegFailed = row({ answered: false, disposition: 'AGENT_LEG_FAILED' })
const fanoutCancelled = row({ answered: false, dialSource: 'controller_fanout' })

describe('the denominators are different, and that is the whole point', () => {
  it('measures short duration against CONNECTED calls, not total outbound', () => {
    // 2 connected, 1 of them short, plus 96 unanswered dials.
    // Against connected: 50%. Against outbound: 1%. Telnyx uses the former.
    const rows = [
      connectedShort, connectedLong,
      ...Array.from({ length: 96 }, () => rangOut),
    ]
    const e = computeExposure(rows)
    expect(e.totalConnected).toBe(2)
    expect(e.totalOutbound).toBe(98)
    expect(e.shortDurationPct).toBe(0.5)
    expect(e.shortDurationOver).toBe(true)
  })

  it('measures abandonment against TOTAL OUTBOUND, not connected', () => {
    // 1 connected, 3 abandoned, 96 rang out. Against outbound: 3%.
    const rows = [
      connectedLong,
      agentLegFailed, agentLegFailed, fanoutCancelled,
      ...Array.from({ length: 96 }, () => rangOut),
    ]
    const e = computeExposure(rows)
    expect(e.abandonedCalls).toBe(3)
    expect(e.abandonedPct).toBe(0.03)
    expect(e.abandonedOver).toBe(false)
  })
})

describe('what counts as abandoned', () => {
  it('does NOT count a lead that simply rang out', () => {
    // Nobody hung up on it -- the timeout expired. Counting these would put
    // every dialer permanently over the line and make the number useless.
    expect(isAbandoned(rangOut)).toBe(false)
  })

  it('counts a surplus fan-out line cancelled when a sibling answered', () => {
    expect(isAbandoned(fanoutCancelled)).toBe(true)
  })

  it('counts a ringing lead hung up because the agent leg failed', () => {
    expect(isAbandoned(agentLegFailed)).toBe(true)
  })

  it('counts Telnyx disconnected-number causes', () => {
    // Telnyx's definition says so explicitly: abandoned "includes calls to
    // disconnected numbers".
    expect(isAbandoned(row({ hangupCause: 'unallocated_number' }))).toBe(true)
  })

  it('never counts an answered call as abandoned', () => {
    // Abandoned is "before being answered". An answered call that goes badly
    // is a short-duration call, which is the OTHER surcharge.
    expect(isAbandoned(row({ answered: true, dialSource: 'controller_fanout' }))).toBe(false)
  })

  it('ignores rows that never reached Telnyx', () => {
    // 4,341 rows on 11 Sept had no call_control_id -- they never placed a call.
    // Including them would have reported a 99% abandonment rate that day.
    expect(isAbandoned(row({ placed: false, disposition: 'AGENT_LEG_FAILED' }))).toBe(false)
    expect(isShortDuration(row({ placed: false, answered: true, talkSeconds: 1 }))).toBe(false)
  })
})

describe('the fee is retroactive to every qualifying call', () => {
  it('charges nothing at all while under the limit', () => {
    // 14% short: under 15, so zero -- not "14% of the fee".
    const rows = [
      ...Array.from({ length: 14 }, () => connectedShort),
      ...Array.from({ length: 86 }, () => connectedLong),
    ]
    const e = computeExposure(rows)
    expect(e.shortDurationOver).toBe(false)
    expect(e.shortDurationFeeUsd).toBe(0)
  })

  it('charges EVERY short call once over, not just the excess', () => {
    // 16 of 100. One point over the line costs 16 x $0.01, not 1 x $0.01.
    const rows = [
      ...Array.from({ length: 16 }, () => connectedShort),
      ...Array.from({ length: 84 }, () => connectedLong),
    ]
    const e = computeExposure(rows)
    expect(e.shortDurationOver).toBe(true)
    expect(e.shortDurationFeeUsd).toBe(0.16)
  })

  it('reproduces September 2026', () => {
    // 122 of 586 connected short (20.8%), 462 of 2,139 outbound abandoned
    // (21.6%). Both over. $1.22 + $2.31 = $3.53.
    const rows: ExposureRow[] = [
      ...Array.from({ length: 122 }, () => connectedShort),
      ...Array.from({ length: 464 }, () => connectedLong),
      ...Array.from({ length: 462 }, () => agentLegFailed),
      ...Array.from({ length: 1091 }, () => rangOut),
    ]
    const e = computeExposure(rows)
    expect(e.totalConnected).toBe(586)
    expect(e.totalOutbound).toBe(2139)
    expect(e.shortDurationPct).toBeCloseTo(0.208, 3)
    expect(e.abandonedPct).toBeCloseTo(0.216, 3)
    expect(e.totalFeeUsd).toBeCloseTo(3.53, 2)
  })
})

describe('callsToClear', () => {
  it('is zero when already under the limit', () => {
    expect(callsToClear(10, 100, ABANDONED_LIMIT, 0.05)).toBe(0)
  })

  it('returns null when the recent rate is ALSO over the limit', () => {
    // The honest answer, and the one an earlier draft of §1i got wrong: if the
    // clean day is worse than the threshold, dialing more makes it WORSE. There
    // is no amount of volume that fixes it -- you fix the rate first.
    expect(callsToClear(462, 2139, ABANDONED_LIMIT, 0.338)).toBeNull()
  })

  it('computes the dilution once the rate is under the limit', () => {
    // With the socket breaker, 14 Sept abandonment drops to 15.4%. September
    // then needs ~741 more dials to come under 20%.
    const n = callsToClear(462, 2139, ABANDONED_LIMIT, 0.154)
    expect(n).not.toBeNull()
    expect(n).toBeGreaterThan(700)
    expect(n).toBeLessThan(800)
  })

  it('computes the short-duration dilution', () => {
    // 421 more connected calls at the clean day's 6.9%.
    const n = callsToClear(122, 586, SHORT_DURATION_LIMIT, 0.069)
    expect(n).not.toBeNull()
    expect(n).toBeGreaterThan(400)
    expect(n).toBeLessThan(440)
  })
})
