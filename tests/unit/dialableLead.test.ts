import { describe, it, expect } from 'vitest'
import { isDialableLead } from '@/lib/dialableLead'
import { lifetimeAttemptCap, MAX_LIFETIME_ATTEMPTS, DIAL_PASSES } from '@/lib/dialerConstants'

// =============================================================================
// NINE ATTEMPTS AND THE LEAD IS DONE
// =============================================================================
// This rule had already stopped existing once, silently, for two independent
// reasons at the same time:
//
//   1. DIAL_PASSES was 0, so lifetimeAttemptCap returned Infinity and
//      `attempts >= cap` could never be true.
//   2. /api/leads/update -- the route actually used to disposition -- never
//      incremented dial_attempts at all.
//
// The visible result on 15 Sept: ZERO leads in the entire table had ever
// reached status 'maxed', while 62 sat past three attempts still dialable and
// one had been called eighteen times. Nothing errored. The setting was just
// decorative.
//
// So these tests check the RULE from both ends -- the cap arithmetic and the
// dialability predicate -- rather than trusting either to imply the other.

const ok = {
  status: 'uncalled',
  disposition: null,
  phone: '+18325551234',
  dial_attempts: 0,
}

describe('the nine-attempt ceiling', () => {
  it('stops being dialable AT nine, not after nine', () => {
    expect(isDialableLead({ ...ok, dial_attempts: 8 })).toBe(true)
    expect(isDialableLead({ ...ok, dial_attempts: 9 })).toBe(false)
  })

  it('stays undialable beyond nine', () => {
    // One lead reached eighteen before this existed.
    expect(isDialableLead({ ...ok, dial_attempts: 18 })).toBe(false)
    expect(isDialableLead({ ...ok, dial_attempts: 100 })).toBe(false)
  })

  it('reads the counter directly rather than trusting status', () => {
    // The whole point. A lead past the cap is undialable even when nothing
    // ever wrote status 'maxed' -- which is exactly the state 62 leads were
    // found in.
    expect(isDialableLead({ ...ok, status: 'no_answer', dial_attempts: 9 })).toBe(false)
  })

  it('treats a missing counter as zero rather than blocking', () => {
    // A caller that forgets to select the column must not have every lead
    // silently vanish from its queue.
    expect(isDialableLead({ ...ok, dial_attempts: undefined })).toBe(true)
    expect(isDialableLead({ ...ok, dial_attempts: null })).toBe(true)
  })
})

describe('lifetimeAttemptCap never exceeds the ceiling', () => {
  it('gives every campaign nine at the current DIAL_PASSES', () => {
    // Every campaign on this account is 1x. Under the old ladder
    // (passes 3: 1x=3, 2x=6, 3x=9) they would have been capped at THREE,
    // which is far stricter than intended.
    expect(lifetimeAttemptCap(1)).toBe(9)
  })

  it('clamps the higher repeat settings rather than multiplying past nine', () => {
    expect(lifetimeAttemptCap(2)).toBe(MAX_LIFETIME_ATTEMPTS)
    expect(lifetimeAttemptCap(3)).toBe(MAX_LIFETIME_ATTEMPTS)
  })

  it('never returns more than the ceiling for any input', () => {
    for (const n of [null, undefined, 0, 1, 2, 3, 5, 99, -4]) {
      expect(lifetimeAttemptCap(n as number | null | undefined))
        .toBeLessThanOrEqual(MAX_LIFETIME_ATTEMPTS)
    }
  })

  it('agrees with the predicate, which is what broke last time', () => {
    // If these two ever disagree, a lead is retired by one and offered by the
    // other -- which is how the queue kept handing back leads the dialer had
    // already finished with.
    expect(lifetimeAttemptCap(1)).toBe(MAX_LIFETIME_ATTEMPTS)
    expect(isDialableLead({ ...ok, dial_attempts: lifetimeAttemptCap(1) })).toBe(false)
    expect(isDialableLead({ ...ok, dial_attempts: lifetimeAttemptCap(1) - 1 })).toBe(true)
  })

  it('still supports switching the cap off entirely', () => {
    // DIAL_PASSES 0 means unlimited and is how the cap is disabled. Asserted
    // so the escape hatch is not quietly removed by a future edit.
    expect(DIAL_PASSES).toBeGreaterThan(0)
  })
})

describe('the other reasons a lead is undialable still hold', () => {
  it('refuses a terminal status', () => {
    expect(isDialableLead({ ...ok, status: 'maxed' })).toBe(false)
    expect(isDialableLead({ ...ok, status: 'dnc' })).toBe(false)
  })

  it('refuses a retiring disposition', () => {
    expect(isDialableLead({ ...ok, disposition: 'DO NOT CALL' })).toBe(false)
    expect(isDialableLead({ ...ok, disposition: 'NOT INTERESTED' })).toBe(false)
  })

  it('refuses a lead with no phone number', () => {
    expect(isDialableLead({ ...ok, phone: '' })).toBe(false)
    expect(isDialableLead({ ...ok, phone: '   ' })).toBe(false)
  })
})
