import { describe, it, expect } from 'vitest'
import {
  dialKey, attemptsByNumber, isExhausted, markDead, deadKeysFrom,
  voicemailStreakKeys,
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

describe('dials our own plumbing killed', () => {
  // 14 Sept: an agent's SIP registration went stale and the dialer placed 86
  // calls in eight minutes, 40 dying at ~1.1s before the prospect's phone
  // rang. The exclusion tested for duration exactly 0 and missed all of them,
  // so 39 leads each spent an attempt on a call nobody received.
  it('does not spend an attempt on an AGENT_LEG_FAILED dial', () => {
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 1,
        disposition: 'AGENT_LEG_FAILED', hangup_cause: 'normal_clearing' },
    ])
    expect(a.size).toBe(0)
  })

  it('catches the same fault when the webhook mislabels it NO_ANSWER', () => {
    // Half of them land this way: AGENT_LEG_FAILED is only written when the
    // agent leg's hangup event arrived first, and under rapid dialing it does
    // not. No hangup cause at all is the tell — a lead leg that never
    // established has nothing to report.
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 1,
        disposition: 'NO_ANSWER', hangup_cause: null },
    ])
    expect(a.size).toBe(0)
  })

  it('STILL COUNTS a real rejection, which carries a cause', () => {
    // user_busy at one second is the person declining. Their phone rang.
    // That is an attempt and must be charged as one.
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 1,
        disposition: 'NO_ANSWER', hangup_cause: 'user_busy' },
    ])
    expect(a.get('5551234567')).toBe(1)
  })

  it('STILL COUNTS a genuine ring-out', () => {
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 35,
        disposition: 'NO_ANSWER', hangup_cause: 'timeout' },
    ])
    expect(a.get('5551234567')).toBe(1)
  })

  it('does not excuse a long call just because the cause is missing', () => {
    // The exclusion is bounded at 2s on purpose. A 30-second dial with no
    // recorded cause is an old row, not a plumbing failure.
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: null, duration: 30,
        disposition: 'NO_ANSWER', hangup_cause: null },
    ])
    expect(a.get('5551234567')).toBe(1)
  })

  it('still counts answered calls whatever the cause says', () => {
    const a = attemptsByNumber([
      { phone_number: '+15551234567', answered_at: '2026-09-14T16:00:00Z',
        duration: 1, disposition: 'VOICEMAIL', hangup_cause: null },
    ])
    expect(a.get('5551234567')).toBe(1)
  })

  it('reproduces the real outage: 40 failures spend nothing', () => {
    const outage = Array.from({ length: 40 }, (_, i) => ({
      phone_number: '+1555000' + String(1000 + i),
      answered_at: null, duration: 1,
      disposition: i % 2 === 0 ? 'AGENT_LEG_FAILED' : 'NO_ANSWER',
      hangup_cause: i % 2 === 0 ? 'normal_clearing' : null,
    }))
    expect(attemptsByNumber(outage).size).toBe(0)
  })
})

// =============================================================================
// VOICEMAIL STREAKS
// =============================================================================
// Every answered call bills a 60-second minimum on both halves plus AMD,
// whoever picks up, and 54% of everything that answers is a machine. A number
// that only ever reaches an answerphone is pure cost, and the floor cannot be
// avoided once the line is answered -- only by not dialing again.
//
// The THRESHOLD is deliberately not asserted here, because it is configuration
// and the data behind it is thin (205/82/54 observations, plateauing near 70%
// with a band of roughly +/-12%). What is asserted is the mechanism: that a
// streak is read newest-first, that a human breaks it, and that unanswered
// dials are invisible to it. Those properties must hold at any threshold.
// =============================================================================

const at = (iso: string) => ({ created_at: iso, answered_at: iso })

describe('voicemailStreakKeys', () => {
  const machine = (phone: string, iso: string) => ({
    phone_number: phone, ...at(iso), amd_result: 'machine', disposition: 'VOICEMAIL',
  })
  const human = (phone: string, iso: string) => ({
    phone_number: phone, ...at(iso), amd_result: 'human', disposition: 'SKIPPED',
  })
  const rang_out = (phone: string, iso: string) => ({
    phone_number: phone, created_at: iso, answered_at: null,
    amd_result: null, disposition: 'NO_ANSWER',
  })

  it('retires a number whose last three answered dials were all machines', () => {
    const rows = [
      machine('+15551230001', '2026-09-10T15:00:00Z'),
      machine('+15551230001', '2026-09-11T15:00:00Z'),
      machine('+15551230001', '2026-09-12T15:00:00Z'),
    ]
    expect(voicemailStreakKeys(rows, 3)).toEqual(['5551230001'])
  })

  it('does not retire below the limit', () => {
    const rows = [
      machine('+15551230002', '2026-09-11T15:00:00Z'),
      machine('+15551230002', '2026-09-12T15:00:00Z'),
    ]
    expect(voicemailStreakKeys(rows, 3)).toEqual([])
  })

  it('A HUMAN BREAKS THE STREAK, even with machines on either side', () => {
    // The whole point: this number has proved it can reach a person. Retiring
    // it would be discarding a live lead to save a fraction of a cent.
    const rows = [
      machine('+15551230003', '2026-09-09T15:00:00Z'),
      machine('+15551230003', '2026-09-10T15:00:00Z'),
      human(  '+15551230003', '2026-09-11T15:00:00Z'),
      machine('+15551230003', '2026-09-12T15:00:00Z'),
    ]
    expect(voicemailStreakKeys(rows, 3)).toEqual([])
  })

  it('reads newest-first regardless of the order rows arrive in', () => {
    // A streak read backwards is not a streak. Shuffled input, human most
    // recent: must NOT retire.
    const rows = [
      machine('+15551230004', '2026-09-10T15:00:00Z'),
      human(  '+15551230004', '2026-09-13T15:00:00Z'),
      machine('+15551230004', '2026-09-11T15:00:00Z'),
      machine('+15551230004', '2026-09-12T15:00:00Z'),
    ]
    expect(voicemailStreakKeys(rows, 3)).toEqual([])
  })

  it('ignores unanswered dials entirely', () => {
    // A ring-out is not evidence either way. If it broke a streak, a number
    // alternating ring-out and voicemail would never accumulate one.
    const rows = [
      machine( '+15551230005', '2026-09-09T15:00:00Z'),
      rang_out('+15551230005', '2026-09-10T15:00:00Z'),
      machine( '+15551230005', '2026-09-11T15:00:00Z'),
      rang_out('+15551230005', '2026-09-12T15:00:00Z'),
      machine( '+15551230005', '2026-09-13T15:00:00Z'),
    ]
    expect(voicemailStreakKeys(rows, 3)).toEqual(['5551230005'])
  })

  it('accepts a VOICEMAIL disposition without an AMD verdict', () => {
    // 31.5% of answered calls carry no verdict -- the agent skipped before
    // detection reported. The disposition still says what happened.
    const rows = Array.from({ length: 3 }, (_, i) => ({
      phone_number: '+15551230006',
      ...at(`2026-09-1${i + 1}T15:00:00Z`),
      amd_result: null, disposition: 'VOICEMAIL',
    }))
    expect(voicemailStreakKeys(rows, 3)).toEqual(['5551230006'])
  })

  it('IS DISABLED BY A LIMIT OF ZERO OR LESS', () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      machine('+15551230007', `2026-09-0${i + 1}T15:00:00Z`))
    expect(voicemailStreakKeys(rows, 0)).toEqual([])
    expect(voicemailStreakKeys(rows, -1)).toEqual([])
    expect(voicemailStreakKeys(rows, NaN)).toEqual([])
  })

  it('never retires a number it cannot key', () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      machine('abc', `2026-09-1${i}T15:00:00Z`))
    expect(voicemailStreakKeys(rows, 3)).toEqual([])
  })

  it('folds into the attempt budget through markDead', () => {
    const attempts = attemptsByNumber([])
    markDead(attempts, ['5551230008'])
    expect(isExhausted({ phone: '+15551230008' }, attempts)).toBe(true)
  })
})
