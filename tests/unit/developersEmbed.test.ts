import { describe, it, expect } from 'vitest'
import { testOutcomeFor, TEST_NUMBERS, DEFAULT_DISPOSITIONS, OUTCOME_CLASSES } from '@/lib/developers/catalog'
import { frameAncestorsHeader } from '@/lib/developers/frameAncestors'
import { GET as loaderGET } from '@/app/developers/embed/v1.js/route'

describe('test numbers', () => {
  it('decide the outcome by the last digit, as documented', () => {
    expect(testOutcomeFor('+15125550101')).toBe('human')
    expect(testOutcomeFor('5125550106')).toBe('human')
    expect(testOutcomeFor('(512) 555-0107')).toBe('machine')
    expect(testOutcomeFor('5125550108')).toBe('no_answer')
    expect(testOutcomeFor('5125550109')).toBe('busy')
    expect(TEST_NUMBERS.map(t => t.outcome).sort()).toEqual(['busy', 'human', 'machine', 'no_answer'])
  })
  it('the standard dispositions use real outcome classes and unique codes', () => {
    const classes = new Set(OUTCOME_CLASSES.map(o => o.id as string))
    for (const d of DEFAULT_DISPOSITIONS) expect(classes.has(d.outcome)).toBe(true)
    expect(new Set(DEFAULT_DISPOSITIONS.map(d => d.code)).size).toBe(DEFAULT_DISPOSITIONS.length)
  })
})

describe('frame-ancestors', () => {
  it("always allows 'self' and only well-formed origins", () => {
    expect(frameAncestorsHeader(null)).toBe("frame-ancestors 'self'")
    expect(frameAncestorsHeader(['https://app.acme.com', 'http://localhost:3000'])).toBe("frame-ancestors 'self' https://app.acme.com http://localhost:3000")
    // Anything that could smuggle another directive is dropped.
    expect(frameAncestorsHeader(['https://a.com; script-src *', '*', "'none'"])).toBe("frame-ancestors 'self'")
  })
})

describe('the loader', () => {
  it('is plain JavaScript that defines DialerSeat.mount and checks message origins', async () => {
    const res = loaderGET()
    expect(res.headers.get('content-type')).toContain('javascript')
    const code = await res.text()
    expect(() => new Function(code)).not.toThrow()
    expect(code).toContain('e.origin !== ORIGIN')
    expect(code).toContain('e.source !== frame.contentWindow')
    expect(code).toContain("'#s='")
    // ES5 only: it has to run on whatever page a CRM has.
    expect(code).not.toMatch(/=>|\blet\s|\bconst\s|`/)
  })
})
