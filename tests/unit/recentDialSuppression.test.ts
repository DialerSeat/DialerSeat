import { describe, it, expect } from 'vitest'
import {
  dialKey, suppressedKeys, isSuppressed, SUPPRESSION_WINDOW_HOURS,
} from '@/lib/recentDialSuppression'

describe('dialKey', () => {
  it('matches the same number written five different ways', () => {
    const forms = [
      '+15551234567', '15551234567', '5551234567',
      '(555) 123-4567', '555.123.4567',
    ]
    const keys = new Set(forms.map(dialKey))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('5551234567')
  })

  it('is null for anything too short to be a number', () => {
    expect(dialKey('123')).toBeNull()
    expect(dialKey('')).toBeNull()
    expect(dialKey(null)).toBeNull()
    expect(dialKey(undefined)).toBeNull()
    expect(dialKey('ext. 4567')).toBeNull()
  })

  it('keeps the last ten digits, so a country code never splits a match', () => {
    expect(dialKey('+1 555 123 4567')).toBe('5551234567')
    expect(dialKey('011 1 555 123 4567')).toBe('5551234567')
  })

  it('does not collide two genuinely different numbers', () => {
    expect(dialKey('+15551234567')).not.toBe(dialKey('+15551234568'))
  })
})

describe('suppressedKeys', () => {
  it('includes a number that was really dialed', () => {
    const s = suppressedKeys([
      { phone_number: '+15551234567', answered_at: null, duration: 22 },
    ])
    expect(s.has('5551234567')).toBe(true)
  })

  it('IGNORES a dial that never rang', () => {
    // The dead-socket signature: no answer and zero duration. Resting a
    // number on one of these would suppress a call nobody ever made.
    const s = suppressedKeys([
      { phone_number: '+15551234567', answered_at: null, duration: 0 },
    ])
    expect(s.size).toBe(0)
  })

  it('keeps an answered call even at zero duration', () => {
    const s = suppressedKeys([
      { phone_number: '+15551234567', answered_at: '2026-09-14T14:00:00Z', duration: 0 },
    ])
    expect(s.has('5551234567')).toBe(true)
  })

  it('treats a missing duration as zero, not as dialed', () => {
    const s = suppressedKeys([{ phone_number: '+15551234567' }])
    expect(s.size).toBe(0)
  })

  it('collapses the same number in different formats to one entry', () => {
    const s = suppressedKeys([
      { phone_number: '+15551234567', duration: 30 },
      { phone_number: '(555) 123-4567', duration: 12 },
    ])
    expect(s.size).toBe(1)
  })

  it('skips rows with no usable number instead of throwing', () => {
    const s = suppressedKeys([
      { phone_number: null, duration: 30 },
      { phone_number: 'n/a', duration: 30 },
    ])
    expect(s.size).toBe(0)
  })
})

describe('isSuppressed', () => {
  const set = new Set(['5551234567'])

  it('suppresses the same number in a different format', () => {
    expect(isSuppressed({ phone: '(555) 123-4567' }, set)).toBe(true)
  })

  it('lets a different number through', () => {
    expect(isSuppressed({ phone: '+15559999999' }, set)).toBe(false)
  })

  it('lets an unusable number through rather than blocking the queue', () => {
    // A lead we cannot key must never be silently undialable — the TCPA and
    // dialable checks own that decision, not this one.
    expect(isSuppressed({ phone: null }, set)).toBe(false)
    expect(isSuppressed({ phone: '123' }, set)).toBe(false)
  })

  it('lets everything through when nothing has been dialed', () => {
    expect(isSuppressed({ phone: '+15551234567' }, new Set())).toBe(false)
  })
})

describe('the window', () => {
  it('rests a number for a day, so next-week follow-up is untouched', () => {
    // Guards the distinction this module exists for: it is not an attempt
    // cap. Raising this to weeks would quietly become one.
    expect(SUPPRESSION_WINDOW_HOURS).toBe(24)
  })
})
