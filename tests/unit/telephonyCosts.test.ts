import { describe, it, expect } from 'vitest'
import {
  billableSeconds,
  LEAD_ANSWERED_MINIMUM_SECONDS,
  BILLING_INCREMENT_SECONDS,
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
})
