import { describe, it, expect } from 'vitest'
import { isAccountBlockedError } from '@/lib/telnyxErrors'

// =============================================================================
// A FALSE POSITIVE HERE SLOWS THE WHOLE DIALER OVER ONE BAD LEAD
// =============================================================================
// placeOutboundCall turns this verdict into FailureKind 'capacity', which stops
// a predictive tick and starts the outage backoff. So the cases below are
// weighted heavily toward the strings that must NOT match.

describe('it recognises a genuinely blocked account', () => {
  it('matches the real 11 September failure, verbatim', () => {
    const real =
      'Agent connection failed, unknown error, Dialed agent SIP endpoint: ' +
      'sip:gencred1WWPgyAR2TlLA2zdGRj1MJCXnPGNjzekZYDHl350HQ@sip.telnyx.com: ' +
      'Account is disabled D17. The Account used to place the termination call is blocked.'
    expect(isAccountBlockedError('', real)).toBe(true)
  })

  it('matches on the title alone', () => {
    expect(isAccountBlockedError('Account is disabled', '')).toBe(true)
  })

  it('matches the termination-call phrasing without the code', () => {
    expect(
      isAccountBlockedError('', 'The Account used to place the termination call is blocked.')
    ).toBe(true)
  })

  it('matches a bare D17 code as its own word', () => {
    expect(isAccountBlockedError('', 'Rejected with D17 by the platform')).toBe(true)
  })
})

describe('it does NOT widen a per-lead failure into an account outage', () => {
  it('ignores a CALLEE blocking us', () => {
    // The near-miss that was in the first draft: /account.*blocked/i matched
    // this. One prospect refusing our number is per-lead -- treating it as
    // 'capacity' would stop a whole predictive tick over one bad lead.
    expect(
      isAccountBlockedError('', 'The destination account has blocked calls from this number')
    ).toBe(false)
  })

  it('ignores "D17" appearing inside a call_control_id', () => {
    // Telnyx details embed ids like v3:QimHtanc0pXZOvcCurWo0X7oNqFkM5qCI6v.
    // includes('D17') matched those by chance; a word boundary does not.
    expect(
      isAccountBlockedError('', 'Call rejected: v3:QimHtD17ancPXZOvcCurWo0X7oNqFkM5qCI6v')
    ).toBe(false)
  })

  it('ignores the other Telnyx D-codes this path already handles', () => {
    // D13 whitelist and D51 unverified origination have their own branches and
    // their own, different, correct FailureKinds.
    expect(isAccountBlockedError('', 'Destination country not whitelisted (D13)')).toBe(false)
    expect(isAccountBlockedError('', 'Unverified origination number D51')).toBe(false)
    expect(isAccountBlockedError('', 'International daily spent limit reached D39')).toBe(false)
  })

  it('is false on empty, null and undefined rather than throwing', () => {
    expect(isAccountBlockedError('', '')).toBe(false)
    expect(isAccountBlockedError(null, null)).toBe(false)
    expect(isAccountBlockedError(undefined, undefined)).toBe(false)
  })
})
