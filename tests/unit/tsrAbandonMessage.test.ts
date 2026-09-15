import { describe, it, expect } from 'vitest'
import { buildTsrAbandonMessage, canRunMultiLine } from '@/lib/tsrAbandonMessage'

// =============================================================================
// THIS IS A COMPLIANCE MECHANISM, NOT A NICETY
// =============================================================================
// 16 CFR 310.4(b)(4)(iii) requires that when no rep is available within two
// seconds of the greeting, a recorded message states "the name and telephone
// number of the seller on whose behalf the call was placed."
//
// Satisfying it is what lets predictive run above one line at all. So the tests
// weight heavily toward REFUSING to produce a message that would not satisfy
// it -- a half-compliant message is worse than none, because it is evidence of
// an attempt that fell short rather than an oversight.

const seller = { name: 'Acme Insurance', callbackNumber: '+18005551234' }

describe('it produces a message that satisfies the rule', () => {
  it('states the seller name and the number', () => {
    const r = buildTsrAbandonMessage(seller)
    expect(r.ok).toBe(true)
    expect(r.text).toContain('Acme Insurance')
    expect(r.text).toContain('800')
  })

  it('speaks the number in groups a person can write down', () => {
    // A ten-digit run read at TTS speed is untranscribable, and a number the
    // person cannot capture does not satisfy the rule in substance.
    const r = buildTsrAbandonMessage(seller)
    expect(r.text).toContain('800, 555, 1234')
  })

  it('handles a number with or without the country code', () => {
    for (const n of ['+18005551234', '8005551234', '1-800-555-1234', '(800) 555-1234']) {
      const r = buildTsrAbandonMessage({ name: 'Acme', callbackNumber: n })
      expect(r.ok, n).toBe(true)
      expect(r.text, n).toContain('800, 555, 1234')
    }
  })

  it('keeps it short, because the rule says "promptly"', () => {
    // Somebody who just said hello to silence is about to hang up. The name has
    // to arrive before they do.
    const r = buildTsrAbandonMessage(seller)
    expect(r.text!.length).toBeLessThan(180)
    expect(r.text!.indexOf('Acme Insurance')).toBeLessThan(40)
  })
})

describe('it REFUSES rather than producing something half-compliant', () => {
  it('refuses with no seller name', () => {
    const r = buildTsrAbandonMessage({ name: '', callbackNumber: '+18005551234' })
    expect(r.ok).toBe(false)
    expect(r.text).toBeNull()
    expect(r.reason).toMatch(/name/i)
  })

  it('refuses with no callback number', () => {
    const r = buildTsrAbandonMessage({ name: 'Acme', callbackNumber: null })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/callback number/i)
  })

  it('refuses a number that is not a real number', () => {
    // "call us back" with five digits satisfies nothing.
    const r = buildTsrAbandonMessage({ name: 'Acme', callbackNumber: '55512' })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/full number/i)
  })

  it('treats whitespace as absent', () => {
    expect(buildTsrAbandonMessage({ name: '   ', callbackNumber: '+18005551234' }).ok).toBe(false)
    expect(buildTsrAbandonMessage({ name: 'Acme', callbackNumber: '   ' }).ok).toBe(false)
  })

  it('refuses on null and undefined rather than throwing', () => {
    expect(buildTsrAbandonMessage({ name: null, callbackNumber: null }).ok).toBe(false)
    expect(buildTsrAbandonMessage({ name: undefined, callbackNumber: undefined }).ok).toBe(false)
  })
})

describe('canRunMultiLine gates the feature, it does not warn about it', () => {
  it('permits multi-line only when the message can actually be built', () => {
    expect(canRunMultiLine(seller)).toBe(true)
  })

  it('refuses multi-line for every incomplete configuration', () => {
    // A campaign that cannot announce its seller runs at ONE line, where there
    // is no surplus and so no abandoned call to excuse. Not "runs with a
    // warning" -- compliance that depends on somebody reading a warning is not
    // compliance.
    expect(canRunMultiLine({ name: 'Acme', callbackNumber: null })).toBe(false)
    expect(canRunMultiLine({ name: null, callbackNumber: '+18005551234' })).toBe(false)
    expect(canRunMultiLine({ name: null, callbackNumber: null })).toBe(false)
    expect(canRunMultiLine({ name: 'Acme', callbackNumber: '123' })).toBe(false)
  })
})
