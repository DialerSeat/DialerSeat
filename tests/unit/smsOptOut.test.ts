import { describe, it, expect } from 'vitest'
import { isOptOut } from '@/lib/smsOptOut'

// =============================================================================
// A FALSE NEGATIVE HERE IS A TCPA CLAIM
// =============================================================================
// Found in the ledger: we called someone at 02:36:24 and they texted STOP at
// 02:37:26. Nothing heard it, they stayed in the list three times, and
// suppression_list held zero rows.
//
// So these cases lean hard toward catching an opt-out. Removing one lead
// wrongly costs a lead. Missing one costs $500-$1,500 per subsequent call.

describe('the carrier keywords', () => {
  it('catches every keyword carriers themselves auto-respond to', () => {
    for (const w of ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']) {
      expect(isOptOut(w).optOut).toBe(true)
    }
  })

  it('is case and punctuation insensitive, because people type normally', () => {
    for (const w of ['stop', 'Stop', 'STOP.', ' stop ', 'Stop!', 'STOP\n']) {
      expect(isOptOut(w).optOut).toBe(true)
    }
  })

  it('catches a keyword leading a longer message', () => {
    expect(isOptOut('STOP please I already told you').optOut).toBe(true)
    expect(isOptOut('Cancel - not interested').optOut).toBe(true)
  })
})

describe('what people actually type', () => {
  it('catches phrases carriers do NOT honour', () => {
    // A carrier auto-response is not the same as the caller knowing to stop.
    // These never trigger a carrier opt-out, which is exactly why we match them.
    const real = [
      'stop calling me',
      'Please remove me from your list',
      'take me off this list',
      'do not call this number again',
      "don't call me anymore",
      'opt out',
      'leave me alone',
      'NO MORE CALLS PLEASE',
    ]
    for (const m of real) {
      expect(isOptOut(m).optOut, m).toBe(true)
    }
  })

  it('handles a smart apostrophe', () => {
    // iPhones substitute U+2019. "Don't call me" must still match.
    expect(isOptOut('Don’t call me again').optOut).toBe(true)
  })
})

describe('what must NOT trigger an opt-out', () => {
  it('does not fire on a keyword used in a sentence', () => {
    // "don't stop sending me deals" contains STOP but is not one.
    expect(isOptOut("don't stop sending me deals").optOut).toBe(false)
    expect(isOptOut('I could not stop laughing').optOut).toBe(false)
  })

  it('does not fire on ordinary replies', () => {
    for (const m of ['yes', 'call me tomorrow', 'whats this about', 'sure, 3pm works']) {
      expect(isOptOut(m).optOut, m).toBe(false)
    }
  })

  it('is false on empty, null and undefined rather than throwing', () => {
    expect(isOptOut('').optOut).toBe(false)
    expect(isOptOut(null).optOut).toBe(false)
    expect(isOptOut(undefined).optOut).toBe(false)
    expect(isOptOut('   ').optOut).toBe(false)
    expect(isOptOut('!!!').optOut).toBe(false)
  })
})

describe('it reports what matched', () => {
  it('names the rule, so the suppression row carries its reason', () => {
    expect(isOptOut('STOP').matched).toBe('STOP')
    expect(isOptOut('please take me off your list').matched).toBe('TAKE ME OFF')
    expect(isOptOut('hello').matched).toBeNull()
  })
})
