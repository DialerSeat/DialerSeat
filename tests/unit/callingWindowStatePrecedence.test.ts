import { describe, it, expect, vi, afterEach } from 'vitest'
import { isCallableNow } from '@/lib/callingWindow'

/**
 * The lead's state decides the calling window. The area code is the fallback,
 * consulted only when the lead has no usable state of its own.
 *
 * This used to take the stricter of the two, so whichever clock happened to be
 * closed decided. That let a guess overrule a fact: an area code says where a
 * number was ISSUED, and after two decades of mobile portability that is
 * routinely a different state — someone who moved from Greensboro to Phoenix
 * keeps 336 for life. Their calls were being blocked on North Carolina hours.
 */

// 03:30 UTC on a Friday = 23:30 in New York, 20:30 in Phoenix.
// Eastern is closed, Arizona is open — the two sources disagree about whether
// this call is legal, which is exactly the case being pinned.
const LATE_EASTERN = '2026-09-18T03:30:00Z'
const NC_NUMBER = '3365925053'   // area code 336 — North Carolina, Eastern

afterEach(() => { vi.useRealTimers() })

describe('calling window precedence', () => {
  it('uses the state column when it disagrees with the area code', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    const result = isCallableNow({ phone: NC_NUMBER, state: 'AZ' })
    expect(result.allowed).toBe(true)
    expect(result.leadState).toBe('AZ')
  })

  it('still blocks when the state column itself is closed', () => {
    // Precedence is not permission: the declared state has to be open.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    const result = isCallableNow({ phone: NC_NUMBER, state: 'NY' })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('too_late')
  })

  it('falls back to the area code when the lead has no state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    const result = isCallableNow({ phone: NC_NUMBER, state: null })
    expect(result.allowed).toBe(false)
    expect(result.leadState).toBe('NC')
  })

  it('falls back to the area code when the state is not one we know', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    const result = isCallableNow({ phone: NC_NUMBER, state: 'Neverland' })
    expect(result.leadState).toBe('NC')
  })

  it('names both sources in the message when they disagree', () => {
    // The disagreement no longer changes the answer, but it is still worth
    // saying out loud — a lead whose two sources differ is worth a look.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    const result = isCallableNow({ phone: NC_NUMBER, state: 'NY' })
    expect(result.reason).toContain('NY')
    expect(result.reason).toContain('NC')
    expect(result.reason).not.toContain('stricter')
  })

  it('is unaffected when both sources agree', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LATE_EASTERN))
    expect(isCallableNow({ phone: NC_NUMBER, state: 'NC' }).allowed).toBe(false)
  })
})
