import { describe, it, expect } from 'vitest'
import {
  billableSeconds,
  LEAD_ANSWERED_MINIMUM_SECONDS,
  BILLING_INCREMENT_SECONDS,
  COST_PER_AGENT_LEG_MINUTE_USD,
} from '@/lib/telephonyCosts'

// =============================================================================
// THE CARRIER'S BILLING RULES, LOCKED DOWN
// =============================================================================
// These are not chosen values — they were derived from 1,103 of Telnyx's own
// call.cost records on 15 Sept 2026 and every case below is a fact that
// appeared in that data, not a preference.
//
// This file exists because the previous rule was wrong for months and nothing
// caught it. The model claimed a flat 30-second minimum on every outbound leg;
// it had been fitted against a single August invoice line and landed within 9%
// because it over-counted agent legs and under-counted the lead floor, and the
// two errors very nearly cancelled. One aggregate could never have exposed
// that. A per-leg assertion can.
//
// If one of these fails, either the carrier changed their terms or somebody
// changed the model without the evidence. Both are worth stopping for.
// =============================================================================

describe('billableSeconds', () => {
  const lead = (answered: boolean) => ({ leadLeg: true, answered })
  const agent = { leadLeg: false, answered: true }

  describe('the answered lead leg carries a 60-second floor', () => {
    // 183 of 192 answered lead legs billed EXACTLY 60, and not one billed
    // under it. A three-second voicemail and a fifty-second conversation cost
    // the same, which is why hanging up on a machine quickly saves nothing.
    it.each([1, 3, 9, 12, 30, 48, 59, 60])(
      'bills %is as a full minute',
      secs => expect(billableSeconds(secs, lead(true))).toBe(60)
    )

    it('bills past the floor in 6-second increments', () => {
      expect(billableSeconds(61, lead(true))).toBe(66)
      expect(billableSeconds(66, lead(true))).toBe(66)
      expect(billableSeconds(67, lead(true))).toBe(72)
    })

    it('matches the longest call actually observed', () => {
      // 2,055s of real conversation came back billed 2,058 — three seconds
      // apart, which is this rounding and nothing else. It was the proof the
      // agent-leg teardown had worked.
      expect(billableSeconds(2055, lead(true))).toBe(2058)
    })
  })

  describe('an unanswered lead leg is free', () => {
    // 94 of them, every one billed zero seconds. Ring time is not charged.
    // The old model billed these 30 seconds each, which is where most of its
    // error lived — and why dial VOLUME looked like a cost driver when it is
    // very nearly free.
    it.each([0, 1, 12, 30, 45, 120])(
      'bills nothing for %is of ringing',
      secs => expect(billableSeconds(secs, lead(false))).toBe(0)
    )
  })

  describe('the agent leg has no floor at all', () => {
    // Minimum observed was 6 seconds; 185 of 192 billed under a minute. The
    // floor belongs to the lead's leg alone.
    it('bills a short leg as a single increment', () => {
      expect(billableSeconds(1, agent)).toBe(6)
      expect(billableSeconds(6, agent)).toBe(6)
    })

    it('bills real durations seen in production', () => {
      expect(billableSeconds(13, agent)).toBe(18)   // 18s appeared in the data
      expect(billableSeconds(19, agent)).toBe(24)   // so did 24s
      expect(billableSeconds(40, agent)).toBe(42)
    })

    it('never rounds up to the lead leg floor', () => {
      expect(billableSeconds(30, agent)).toBeLessThan(LEAD_ANSWERED_MINIMUM_SECONDS)
    })
  })

  describe('increments', () => {
    it('is six seconds, universally', () => {
      // 1,103 of 1,103 billed records were multiples of six, with no
      // exceptions in any category.
      expect(BILLING_INCREMENT_SECONDS).toBe(6)
      for (const s of [1, 7, 13, 25, 61, 119, 301]) {
        expect(billableSeconds(s, agent) % 6).toBe(0)
        expect(billableSeconds(s, lead(true)) % 6).toBe(0)
      }
    })
  })

  describe('degenerate input', () => {
    it('treats null, undefined and negatives as nothing', () => {
      expect(billableSeconds(null, agent)).toBe(0)
      expect(billableSeconds(undefined, agent)).toBe(0)
      expect(billableSeconds(-5, agent)).toBe(0)
      // Even on an answered lead leg: no call happened, so no floor applies.
      expect(billableSeconds(0, lead(true))).toBe(0)
    })
  })

  describe('the whole-dial shape this implies', () => {
    it('costs nothing when nobody answers', () => {
      const leadSec = billableSeconds(28, lead(false))
      const agentSec = billableSeconds(28, { leadLeg: false, answered: false })
      expect(leadSec).toBe(0)
      // The agent's leg still rang alongside it, and that is not free — it is
      // 17% of a measured session and the reason dial_agent_on_answer exists.
      expect(agentSec).toBeGreaterThan(0)
    })

    it('costs a minimum of a minute the moment they answer', () => {
      expect(billableSeconds(4, lead(true))).toBe(60)
    })
  })

  // ===========================================================================
  // THE AGENT LEG IS METERED ON TWO CONNECTIONS
  // ===========================================================================
  // It is a SIP URI from our Call Control application to the credential
  // connection the browser registered against. It traverses two connections and
  // Telnyx bills each at $0.002/min. Proven on one call session, where both
  // records carry 2058 billed seconds and $0.0686 under different call_leg_ids.
  //
  // This was 0.002 for months because August's invoice showed only the
  // credential-connection line. Half the leg was free as far as the platform
  // was concerned. The assertion is here so the reversion is loud.
  describe('the agent leg bills on both connections', () => {
    it('is $0.004 a minute, not $0.002', () => {
      expect(COST_PER_AGENT_LEG_MINUTE_USD).toBe(0.004)
    })

    it('reproduces the measured post-teardown session', () => {
      // 148 agent legs produced 148 records on EACH connection: 111.9 and 111.5
      // billed minutes, $0.2238 and $0.2230. One leg, ~111.7 minutes of it.
      const legMinutes = 111.7
      const measuredTotal = 0.2238 + 0.2230
      const modelled = legMinutes * COST_PER_AGENT_LEG_MINUTE_USD
      expect(Math.abs(modelled - measuredTotal)).toBeLessThan(0.005)
    })

    it('still costs most of what reaching a real phone costs', () => {
      // $0.0052/min measured on lead legs ($0.00321 termination + $0.002
      // platform). The agent leg never touches a carrier and is 77% of it.
      const pstnPerMinute = 0.0052
      const ratio = COST_PER_AGENT_LEG_MINUTE_USD / pstnPerMinute
      expect(ratio).toBeGreaterThan(0.7)
      expect(ratio).toBeLessThan(0.85)
    })
  })
})
