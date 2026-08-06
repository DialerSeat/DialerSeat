import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isCallableNow } from '@/lib/callingWindow'

// =============================================================================
// The calling window is legally load-bearing and entirely time-dependent, so
// every test here pins the clock. All instants are in August, which is DST for
// every US zone that observes it — Eastern is UTC-4, Central UTC-5, Pacific
// UTC-7, and Arizona is UTC-7 year round because it doesn't observe DST.
//
// Reference points used throughout:
//   13:00 UTC = 09:00 Eastern  (window opens for an Eastern lead)
//   01:00 UTC = 21:00 Eastern  (window closes for an Eastern lead)
// =============================================================================

function at(iso: string) {
  vi.setSystemTime(new Date(iso))
}

beforeEach(() => {
  vi.useFakeTimers()
  // The sandbox bypass keys off this env var; make sure a stray value in the
  // environment can't silently turn every assertion into "allowed".
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isCallableNow — inside and outside the window', () => {
  it('allows a mid-morning call to an Eastern lead', () => {
    at('2026-08-05T14:00:00Z') // 10:00 EDT
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' })
    expect(r.allowed).toBe(true)
  })

  it('blocks a call before 9am local', () => {
    at('2026-08-05T12:00:00Z') // 08:00 EDT
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/too early/i)
  })

  it('blocks a call at or after 9pm local', () => {
    at('2026-08-06T01:00:00Z') // 21:00 EDT on the 5th
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/too late/i)
  })

  it('allows the 9am boundary itself', () => {
    at('2026-08-05T13:00:00Z') // exactly 09:00 EDT
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }).allowed).toBe(true)
  })
})

describe('isCallableNow — the window is the LEAD\'s, not the agent\'s', () => {
  it('can allow one lead and block another at the same instant', () => {
    // 13:30 UTC is 09:30 Eastern but only 08:30 Central. An agent dialing both
    // at this moment may legally call the first and not the second — this is
    // the entire reason enforcement is per-lead.
    at('2026-08-05T13:30:00Z')
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }).allowed).toBe(true)
    expect(isCallableNow({ phone: '+12145550107', state: 'TX' }).allowed).toBe(false)
  })

  it('derives the timezone from the area code when state is missing', () => {
    at('2026-08-05T13:30:00Z')
    // Same two numbers, no state column at all.
    expect(isCallableNow({ phone: '+13365550142' }).allowed).toBe(true)
    expect(isCallableNow({ phone: '+12145550107' }).allowed).toBe(false)
  })

  it('prefers the explicit state column over the area code', () => {
    // A 336 (North Carolina) area code on a lead that actually lives in
    // California — number portability makes this real. 17:00 UTC is 13:00
    // Eastern but 10:00 Pacific; both are inside the window, so use a time
    // that separates them: 13:30 UTC is 09:30 Eastern and 06:30 Pacific.
    at('2026-08-05T13:30:00Z')
    expect(isCallableNow({ phone: '+13365550142', state: 'CA' }).allowed).toBe(false)
  })
})

describe('isCallableNow — retryAfter (the bug that fired 4 hours early)', () => {
  it('returns 9am in the LEAD\'s timezone, not 9am UTC', () => {
    // The original helpers built a Date then called setHours/setDate, which
    // operate in the RUNTIME's zone — UTC on Vercel. "Tomorrow 9am Eastern"
    // came out as 09:00 UTC, i.e. 05:00 Eastern: a retry scheduled four hours
    // INSIDE the prohibited period, by the module meant to prevent exactly
    // that.
    at('2026-08-05T12:00:00Z') // 08:00 EDT, too early
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' })

    expect(r.allowed).toBe(false)
    expect(r.retryAfter).toBeInstanceOf(Date)
    // 09:00 EDT === 13:00 UTC. If this ever reads 09:00 UTC, the bug is back.
    expect(r.retryAfter!.toISOString()).toBe('2026-08-05T13:00:00.000Z')
  })

  it('rolls to the next day when the window has already closed', () => {
    at('2026-08-06T01:00:00Z') // 21:00 EDT on the 5th
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' })
    expect(r.allowed).toBe(false)
    // Next 09:00 EDT is on the 6th = 13:00 UTC on the 6th.
    expect(r.retryAfter!.toISOString()).toBe('2026-08-06T13:00:00.000Z')
  })

  it('is never in the past', () => {
    at('2026-08-05T12:00:00Z')
    const r = isCallableNow({ phone: '+12145550107', state: 'TX' })
    expect(r.allowed).toBe(false)
    expect(r.retryAfter!.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('isCallableNow — fails closed', () => {
  it('refuses when the lead location cannot be established', () => {
    at('2026-08-05T14:00:00Z') // a time that is fine everywhere in the US
    // 999 is not an assigned US area code, so neither the state column nor
    // the area code can place this lead.
    const r = isCallableNow({ phone: '+19995550142', state: null })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/unknown state/i)
  })

  it('refuses an unusable phone value rather than defaulting to allowed', () => {
    at('2026-08-05T14:00:00Z')
    expect(isCallableNow({ phone: '', state: null }).allowed).toBe(false)
  })
})

describe('isCallableNow — holidays and Sundays are dialable', () => {
  it('allows a Sunday call inside the hours', () => {
    // 2026-08-09 is a Sunday. Policy is explicitly hours-only: whether to dial
    // Sundays or holidays is the operator's call, not this module's.
    at('2026-08-09T15:00:00Z') // 11:00 EDT, Sunday
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }).allowed).toBe(true)
  })
})

describe('isCallableNow — override', () => {
  it('allows an otherwise-blocked call when overrideWindow is set', () => {
    at('2026-08-05T12:00:00Z') // too early
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' }, { overrideWindow: true })
    expect(r.allowed).toBe(true)
    // The reason it WOULD have been blocked has to survive, because that string
    // is what makes an after-hours dial auditable rather than invisible.
    expect(r.reason).toMatch(/override/i)
    expect(r.reason).toMatch(/too early/i)
  })

  it('changes nothing for a call that was already allowed', () => {
    at('2026-08-05T14:00:00Z')
    const r = isCallableNow({ phone: '+13365550142', state: 'NC' }, { overrideWindow: true })
    expect(r.allowed).toBe(true)
    expect(r.reason ?? '').not.toMatch(/override/i)
  })

  it('does not allow anything when the flag is absent or false', () => {
    at('2026-08-05T12:00:00Z')
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }).allowed).toBe(false)
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }, {}).allowed).toBe(false)
    expect(isCallableNow({ phone: '+13365550142', state: 'NC' }, { overrideWindow: false }).allowed).toBe(false)
  })
})
