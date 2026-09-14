import { describe, it, expect } from 'vitest'
import {
  dialKey, attemptsByNumber, isExhausted, markDead, deadKeysFrom,
  MAX_DIALS_PER_NUMBER, ATTEMPT_WINDOW_DAYS,
} from '@/lib/recentDialSuppression'

const dialed = (phone: string, n: number) =>
  Array.from({ length: n }, () => ({ phone_number: phone, duration: 22, answered_at: null }))

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

describe('attemptsByNumber', () => {
  it('counts real dials', () => {
    const a = attemptsByNumber(dialed('+15551234567', 3))
    expect(a.get('5551234567')).toBe(3)
  })

  it('IGNORES dials that never rang', () => {
    // The dead-socket signature: no answer, zero duration. Counting these
    // would spend a person's budget on calls their phone never received.
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 0 },
      { phone_number: '+15551234567', answered_at: null, duration: 0 },
    ])
    expect(a.size).toBe(0)
  })

  it('counts an answered call even at zero duration', () => {
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: '2026-09-14T14:00:00Z', duration: 0 },
    ])
    expect(a.get('5551234567')).toBe(1)
  })

  it('treats a missing duration as never rang', () => {
    expect(attemptsByNumber([{ phone_number: '+15551234567' }]).size).toBe(0)
  })

  it('POOLS the same number across formats into one budget', () => {
    // The whole point: one person, one budget, however many lists they are in.
    const a = attemptsByNumber([
      ...dialed('+15551234567', 2),
      ...dialed('(555) 123-4567', 2),
      ...dialed('555.123.4567', 2),
    ])
    expect(a.size).toBe(1)
    expect(a.get('5551234567')).toBe(6)
  })

  it('skips rows with no usable number instead of throwing', () => {
    const a = attemptsByNumber([
      { phone_number: null, duration: 30 },
      { phone_number: 'n/a', duration: 30 },
    ])
    expect(a.size).toBe(0)
  })
})

describe('isExhausted', () => {
  it('allows a number below the cap', () => {
    const a = attemptsByNumber(dialed('+15551234567', MAX_DIALS_PER_NUMBER - 1))
    expect(isExhausted({ phone: '+15551234567' }, a)).toBe(false)
  })

  it('blocks a number at the cap', () => {
    const a = attemptsByNumber(dialed('+15551234567', MAX_DIALS_PER_NUMBER))
    expect(isExhausted({ phone: '+15551234567' }, a)).toBe(true)
  })

  it('blocks a number over the cap', () => {
    const a = attemptsByNumber(dialed('+15551234567', 112))
    expect(isExhausted({ phone: '+15551234567' }, a)).toBe(true)
  })

  it('blocks across campaigns, which is the entire point', () => {
    // Three lists, two attempts each. Per-list counting would see 2, 2, 2 and
    // dial on. Per-number counting sees 6 and stops.
    const a = attemptsByNumber([
      ...dialed('+15551234567', 2),
      ...dialed('+15551234567', 2),
      ...dialed('+15551234567', 2),
    ])
    expect(isExhausted({ phone: '555-123-4567' }, a)).toBe(true)
  })

  it('never blocks a number it cannot key', () => {
    const a = attemptsByNumber(dialed('+15551234567', 99))
    expect(isExhausted({ phone: null }, a)).toBe(false)
    expect(isExhausted({ phone: '123' }, a)).toBe(false)
  })

  it('lets everything through when nothing has been dialed', () => {
    expect(isExhausted({ phone: '+15551234567' }, new Map())).toBe(false)
  })

  it('honours an explicit cap', () => {
    const a = attemptsByNumber(dialed('+15551234567', 4))
    expect(isExhausted({ phone: '+15551234567' }, a, 3)).toBe(true)
    expect(isExhausted({ phone: '+15551234567' }, a, 8)).toBe(false)
  })
})

describe('the cap itself', () => {
  it('is six — the smallest cap that cost nobody on real traffic', () => {
    // Measured over 30 days: cap 6 removed 16.5% of dials and lost 0 of the
    // 44 people reached. Cap 5 lost one. Lowering this is a real trade and
    // should be made deliberately, not drifted into.
    expect(MAX_DIALS_PER_NUMBER).toBe(6)
  })

  it('counts over 30 days, so a re-uploaded list is not dead forever', () => {
    expect(ATTEMPT_WINDOW_DAYS).toBe(30)
  })
})

describe('dead numbers', () => {
  it('blocks a number the carrier says does not exist, on the first hit', () => {
    // Not after six attempts. A disconnected number will not start existing
    // because we tried again.
    const a = markDead(new Map(), deadKeysFrom([{ phone_number: '+15551234567' }]))
    expect(isExhausted({ phone: '+15551234567' }, a)).toBe(true)
  })

  it('matches a dead number across formats', () => {
    const a = markDead(new Map(), deadKeysFrom([{ phone_number: '+15551234567' }]))
    expect(isExhausted({ phone: '(555) 123-4567' }, a)).toBe(true)
  })

  it('leaves live numbers alone', () => {
    const a = markDead(new Map(), deadKeysFrom([{ phone_number: '+15551234567' }]))
    expect(isExhausted({ phone: '+15559999999' }, a)).toBe(false)
  })

  it('does not disturb an existing budget for other numbers', () => {
    const a = attemptsByNumber([
      { phone_number: '+15559999999', duration: 20 },
      { phone_number: '+15559999999', duration: 20 },
    ])
    markDead(a, deadKeysFrom([{ phone_number: '+15551234567' }]))
    expect(a.get('5559999999')).toBe(2)
    expect(isExhausted({ phone: '+15559999999' }, a)).toBe(false)
  })

  it('ignores rows with no usable number', () => {
    expect(deadKeysFrom([{ phone_number: null }, { phone_number: 'x' }])).toEqual([])
  })
})
