import { describe, it, expect } from 'vitest'
import { normalizeToE164 } from '@/lib/phoneNormalize'

// =============================================================================
// Every case in the "real bugs this catches" block below is a failure that
// actually reached Telnyx from real uploaded lead data. They are first because
// they are the reason this file exists.
// =============================================================================

describe('normalizeToE164 — real bugs this catches', () => {
  it('does not double the country code on an 11-digit US number', () => {
    // The original bug: prepending +1 to a string that already led with 1,
    // producing +11XXXXXXXXXX. Telnyx rejected it with a generic format error
    // several layers away from the lead that caused it.
    expect(normalizeToE164('13365550142')).toBe('+13365550142')
    expect(normalizeToE164('1-336-555-0142')).toBe('+13365550142')
  })

  it('rejects letter-contaminated values instead of stripping them', () => {
    // Confirmed pattern in real CSV imports: a phone field that swallowed a
    // name or state during a bad merge. Stripping non-digits can leave a
    // plausible digit count purely by chance, so the letters themselves are
    // the signal.
    expect(normalizeToE164('336-555-0142 JC')).toBeNull()
    expect(normalizeToE164('NC3365550142')).toBeNull()
    expect(normalizeToE164('336555014x2')).toBeNull()
  })

  it('rejects digit strings longer than E.164 allows', () => {
    // An earlier version had no upper bound: anything over 11 digits got a
    // bare "+" and was treated as valid. E.164 caps at 15 INCLUDING country
    // code, so a 12-digit value ending in zeros — real data — went to Telnyx.
    expect(normalizeToE164('336555014200')).toBe('+336555014200') // 12 digits, still legal E.164
    expect(normalizeToE164('1234567890123456')).toBeNull()        // 16 digits, not
  })
})

describe('normalizeToE164 — US formatting', () => {
  it('accepts common human formats for a 10-digit number', () => {
    const expected = '+13365550142'
    for (const input of [
      '3365550142',
      '336-555-0142',
      '(336) 555-0142',
      '336.555.0142',
      '336 555 0142',
      '  3365550142  ',
    ]) {
      expect(normalizeToE164(input), `input: ${input}`).toBe(expected)
    }
  })
})

describe('normalizeToE164 — international', () => {
  it('preserves an explicit + and its country code', () => {
    expect(normalizeToE164('+442071838750')).toBe('+442071838750')
    expect(normalizeToE164('+61 2 8015 5555')).toBe('+61280155555')
  })

  it('rejects a + number too short to be real', () => {
    expect(normalizeToE164('+1234')).toBeNull()
  })
})

describe('normalizeToE164 — empty and malformed', () => {
  it('returns null rather than throwing on absent input', () => {
    expect(normalizeToE164(null)).toBeNull()
    expect(normalizeToE164(undefined)).toBeNull()
    expect(normalizeToE164('')).toBeNull()
    expect(normalizeToE164('   ')).toBeNull()
  })

  it('returns null when there are no digits at all', () => {
    expect(normalizeToE164('---')).toBeNull()
    expect(normalizeToE164('()')).toBeNull()
  })

  it('rejects a digit count between "too short" and a valid US number', () => {
    expect(normalizeToE164('5550142')).toBeNull()   // 7 digits
    expect(normalizeToE164('336555014')).toBeNull() // 9 digits
  })

  it('never returns a value missing its leading +', () => {
    // Anything that reaches Telnyx without a + is rejected downstream, so this
    // is the invariant that matters most about the return value.
    const inputs = ['3365550142', '13365550142', '+442071838750', '336555014200']
    for (const input of inputs) {
      const out = normalizeToE164(input)
      expect(out, `input: ${input}`).not.toBeNull()
      expect(out!.startsWith('+'), `input: ${input}`).toBe(true)
      expect(out!.slice(1)).toMatch(/^\d+$/)
    }
  })
})
