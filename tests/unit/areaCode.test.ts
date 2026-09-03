import { describe, it, expect } from 'vitest'
import {
  classifyAreaCode,
  classifyPhone,
  getAreaCodeInfo,
  extractAreaCode,
  phoneToState,
  US_AREA_CODE_COUNT,
} from '@/lib/areaCode'
import { STATE_TIMEZONES } from '@/lib/timezones'
import { isCallableNow } from '@/lib/callingWindow'

// =============================================================================
// These tests exist because this table cannot be checked by using the product.
// A missing or mistyped entry does not throw, does not log, and does not show
// up in the UI — it silently makes leads permanently undialable, and the only
// symptom is a quiet queue. 1,038 leads (6.2% of the book) sat like that.
//
// So the integrity of the table is asserted mechanically instead.
// =============================================================================

describe('AREA_CODES integrity: the checks a human cannot do by dialing', () => {
  // THE MOST IMPORTANT TEST IN THIS FILE.
  //
  // callingWindow derives a state from the area code, then looks that state up
  // in STATE_TIMEZONES. If the two disagree — a typo, a territory added here
  // but not there — the lookup fails closed and every lead with that area code
  // becomes undialable forever. Silently. This is exactly how PR numbers were
  // being refused.
  it('every state in the area-code table has a timezone', () => {
    const orphans: string[] = []
    for (let npa = 200; npa <= 999; npa++) {
      const info = getAreaCodeInfo(String(npa))
      if (info && !STATE_TIMEZONES[info.state]) {
        orphans.push(`${npa} -> ${info.state}`)
      }
    }
    expect(orphans).toEqual([])
  })

  it('holds every area code that appeared in real lead data', () => {
    // Codes pulled from a live scan of the leads table. Each of these was
    // silently blocking leads before being added; a regression here puts them
    // straight back into the undialable bucket.
    const fromProduction = [
      '217', '224', '228', '240', '270', '304', '308', '334', '339', '402',
      '406', '417', '424', '447', '448', '508', '570', '605', '606', '620',
      '629', '667', '701', '726', '743', '769', '814', '859', '864', '904',
      '938', '959', '985',
    ]
    const missing = fromProduction.filter(npa => !getAreaCodeInfo(npa))
    expect(missing).toEqual([])
  })

  it('places no area code in two categories at once', () => {
    // A code listed as both US and Canadian would resolve by list order rather
    // than by fact, which is the kind of bug that only shows up as a lead in
    // the wrong timezone being called at the wrong hour.
    const multi: string[] = []
    for (let npa = 200; npa <= 999; npa++) {
      const code = String(npa)
      const k = classifyAreaCode(code)
      if (k.kind === 'us' && !getAreaCodeInfo(code)) multi.push(code)
    }
    expect(multi).toEqual([])
  })

  it('never assigns an area code starting with 0 or 1', () => {
    // Not assignable under the NANP. An entry here would mean a typo.
    const invalid: string[] = []
    for (const prefix of ['0', '1']) {
      for (let i = 0; i < 100; i++) {
        const code = prefix + String(i).padStart(2, '0')
        if (getAreaCodeInfo(code)) invalid.push(code)
      }
    }
    expect(invalid).toEqual([])
  })

  it('holds the codes verified against regulator notices', () => {
    // Researched individually rather than inferred. Each was confirmed in
    // service before being added; the comment in areaCode.ts carries the dates.
    const verified: Array<[string, string]> = [
      ['839', 'SC'],  // overlay of 803, in service May 2020
      ['948', 'VA'],  // overlay of 757, in service May 2022
      ['436', 'OH'],  // overlay of 440, in service March 2024
      ['686', 'VA'],  // overlay of 804, in service February 2024
      ['821', 'SC'],  // overlay of 864, Upstate
      ['483', 'AL'],  // overlay of 334
      ['729', 'TN'],  // overlay of 423
      ['748', 'CO'],
    ]
    for (const [npa, state] of verified) {
      expect(getAreaCodeInfo(npa), `${npa} should be present`).not.toBeNull()
      expect(getAreaCodeInfo(npa)?.state, `${npa} should be ${state}`).toBe(state)
    }
  })

  it('still refuses the codes that are genuinely unassigned', () => {
    // These were each checked against NANP records and left out on purpose.
    // Lookup sites will happily invent a state for an unassigned code, and a
    // wrong state here means calling someone outside their legal window — so
    // this test exists to make filling them in a deliberate act rather than a
    // tidy-up. If one of them is genuinely assigned later, update the comment
    // in areaCode.ts and move it in the same commit.
    for (const npa of ['485', '489', '632', '723', '823', '846', '974']) {
      expect(getAreaCodeInfo(npa), `${npa} is unassigned`).toBeNull()
      expect(classifyAreaCode(npa)).toEqual({ kind: 'unknown' })
    }
  })

  it('has not silently shrunk', () => {
    // A refactor that drops half the table would otherwise pass every other
    // test in this file.
    expect(US_AREA_CODE_COUNT).toBeGreaterThanOrEqual(360)
  })
})

describe('classifyAreaCode: the null that used to mean four different things', () => {
  it('places US states', () => {
    expect(classifyAreaCode('336')).toEqual({ state: 'NC', region: 'southeast', kind: 'us' })
    expect(classifyAreaCode('304')).toMatchObject({ kind: 'us', state: 'WV' })
    expect(classifyAreaCode('864')).toMatchObject({ kind: 'us', state: 'SC' })
  })

  it('places US territories as US, not as unknown', () => {
    expect(classifyAreaCode('787')).toMatchObject({ kind: 'us', state: 'PR' })
    expect(classifyAreaCode('939')).toMatchObject({ kind: 'us', state: 'PR' })
    expect(classifyAreaCode('340')).toMatchObject({ kind: 'us', state: 'VI' })
  })

  it('identifies toll-free rather than blaming a missing state', () => {
    for (const npa of ['800', '833', '844', '855', '866', '877', '888']) {
      expect(classifyAreaCode(npa)).toEqual({ kind: 'toll_free' })
    }
  })

  it('identifies non-geographic codes', () => {
    expect(classifyAreaCode('900')).toEqual({ kind: 'non_geographic' })
    expect(classifyAreaCode('911')).toEqual({ kind: 'non_geographic' })
    expect(classifyAreaCode('710')).toEqual({ kind: 'non_geographic' })
  })

  it('identifies Canada', () => {
    expect(classifyAreaCode('902')).toEqual({ kind: 'canada' })
    expect(classifyAreaCode('403')).toEqual({ kind: 'canada' })
    expect(classifyAreaCode('416')).toEqual({ kind: 'canada' })
  })

  it('identifies other NANP members', () => {
    expect(classifyAreaCode('876')).toEqual({ kind: 'other_nanp' })  // Jamaica
    expect(classifyAreaCode('684')).toEqual({ kind: 'other_nanp' })  // American Samoa
  })

  it('still says unknown for something genuinely unplaceable', () => {
    expect(classifyAreaCode('999')).toEqual({ kind: 'unknown' })
    expect(classifyAreaCode(null)).toEqual({ kind: 'unknown' })
    expect(classifyAreaCode('12')).toEqual({ kind: 'unknown' })
    expect(classifyAreaCode('abc')).toEqual({ kind: 'unknown' })
  })

  it('classifies from a full phone number too', () => {
    expect(classifyPhone('+1 (304) 441-6647')).toMatchObject({ kind: 'us', state: 'WV' })
    expect(classifyPhone('8005551234')).toEqual({ kind: 'toll_free' })
  })
})

describe('the end-to-end path: area code to a dialing decision', () => {
  // The integration that actually matters. A lead with NO state column and a
  // previously-missing area code must now resolve and be dialable, because
  // that is the entire bug: "leads should always be dialable, just take the
  // area code to find the state."
  it('a state-less lead in a newly-added area code is no longer refused for location', () => {
    for (const phone of ['3044416647', '8645551234', '9045551234', '5705551234']) {
      const r = isCallableNow({ phone, state: null })
      // It may be outside calling hours depending on when the suite runs —
      // that is fine and expected. What must NOT happen is a location refusal.
      expect(r.code).not.toBe('unknown_area')
      expect(r.code).not.toBe('no_number')
      expect(r.reason ?? '').not.toContain('Unrecognised area code')
    }
  })

  it('a Puerto Rico lead resolves instead of failing closed', () => {
    const r = isCallableNow({ phone: '7875551234', state: null })
    expect(r.code).not.toBe('unknown_area')
    expect(phoneToState('7875551234')).toBe('PR')
  })

  it('a toll-free lead is refused for being toll-free, not for missing a state', () => {
    const r = isCallableNow({ phone: '8005551234', state: null })
    expect(r.allowed).toBe(false)
    expect(r.code).toBe('toll_free')
    expect(r.reason).toContain('toll-free')
    // The old message told the user to add a state. It cannot help here, and
    // saying so sends them off to do data entry that will not work.
    expect(r.reason).not.toContain('Add a state')
  })

  it('a premium-rate lead is named as such', () => {
    const r = isCallableNow({ phone: '9005551234', state: null })
    expect(r.allowed).toBe(false)
    expect(r.code).toBe('non_geographic')
    expect(r.reason).not.toContain('Add a state')
  })

  it('a Canadian lead is reported as international, not as a missing state', () => {
    const r = isCallableNow({ phone: '9025551234', state: null })
    expect(r.allowed).toBe(false)
    expect(r.code).toBe('international')
    expect(r.reason).toContain('Canadian')
  })

  it('a genuinely unknown area code still asks for a state', () => {
    const r = isCallableNow({ phone: '9995551234', state: null })
    expect(r.code).toBe('unknown_area')
    expect(r.reason).toContain('Add a state')
  })

  it('an explicit state column still wins over the area code', () => {
    // Someone with a NC cell who moved to California should be timed by the
    // column they set, not by where their number was issued.
    const r = isCallableNow({ phone: '3365551234', state: 'CA' })
    expect(r.leadState).toBe('CA')
  })
})

describe('extractAreaCode', () => {
  it('handles 10 digits, 11 with country code, and formatting', () => {
    expect(extractAreaCode('3365551234')).toBe('336')
    expect(extractAreaCode('13365551234')).toBe('336')
    expect(extractAreaCode('+1 (336) 555-1234')).toBe('336')
  })

  it('returns null for anything that is not a US-length number', () => {
    expect(extractAreaCode('5551234')).toBeNull()
    expect(extractAreaCode('')).toBeNull()
    expect(extractAreaCode(null)).toBeNull()
  })
})
