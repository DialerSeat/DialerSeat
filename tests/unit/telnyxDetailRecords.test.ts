import { describe, it, expect, vi, afterEach } from 'vitest'
import { coveringRange, rowTimeMs, withinWindow } from '@/lib/telnyxDetailRecords'

/**
 * /detail_records has no created_at filter.
 *
 * The compliance sync sent filter[created_at][gte] / [lt] for four days and
 * stored nothing, silently — Telnyx did not error, it just ignored the window
 * or returned nothing. Meanwhile the sibling route that passed a date_range
 * preset kept working, so the table held thirty-seven minutes of one day and
 * the month-to-date ratio computed off it looked plausible enough to quote.
 *
 * Explicit windows are now served by the smallest covering preset and trimmed
 * here.
 */
afterEach(() => { vi.useRealTimers() })

const pinNow = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)) }

describe('coveringRange', () => {
  it('honours an explicit preset over any window', () => {
    expect(coveringRange({ dateRange: 'this_month', from: '2026-09-01T00:00:00Z' }))
      .toBe('this_month')
  })

  it('uses today for a window inside today', () => {
    pinNow('2026-09-19T16:00:00Z')
    expect(coveringRange({ from: '2026-09-19T03:00:00Z', to: '2026-09-19T16:00:00Z' }))
      .toBe('today')
  })

  it('reaches back far enough to contain the window', () => {
    // 36h lookback from mid-afternoon crosses into the previous day.
    pinNow('2026-09-19T16:00:00Z')
    expect(coveringRange({ from: '2026-09-18T04:00:00Z', to: '2026-09-19T16:00:00Z' }))
      .toBe('last_2_days')
  })

  it('scales with how far back the window starts', () => {
    pinNow('2026-09-19T16:00:00Z')
    expect(coveringRange({ from: '2026-09-15T00:00:00Z' })).toBe('last_5_days')
    expect(coveringRange({ from: '2026-09-01T00:00:00Z' })).toBe('last_19_days')
  })

  it('caps the span rather than asking for an unbounded history', () => {
    pinNow('2026-09-19T16:00:00Z')
    expect(coveringRange({ from: '2020-01-01T00:00:00Z' })).toBe('last_90_days')
  })

  it('falls back to today for a missing or unreadable start', () => {
    pinNow('2026-09-19T16:00:00Z')
    expect(coveringRange({})).toBe('today')
    expect(coveringRange({ from: 'not a date' })).toBe('today')
  })
})

describe('rowTimeMs', () => {
  it('reads whichever timestamp field the record type uses', () => {
    const t = Date.parse('2026-09-19T12:00:00Z')
    expect(rowTimeMs({ created_at: '2026-09-19T12:00:00Z' })).toBe(t)
    expect(rowTimeMs({ started_at: '2026-09-19T12:00:00Z' })).toBe(t)
    expect(rowTimeMs({ finished_at: '2026-09-19T12:00:00Z' })).toBe(t)
  })

  it('returns null when there is nothing readable', () => {
    expect(rowTimeMs({})).toBeNull()
    expect(rowTimeMs({ created_at: 'nonsense' })).toBeNull()
  })
})

describe('withinWindow', () => {
  const from = '2026-09-19T00:00:00Z'
  const to = '2026-09-19T12:00:00Z'

  it('is half-open, matching the filter it replaced', () => {
    expect(withinWindow({ created_at: from }, from, to)).toBe(true)
    expect(withinWindow({ created_at: to }, from, to)).toBe(false)
  })

  it('excludes rows outside the window', () => {
    expect(withinWindow({ created_at: '2026-09-18T23:59:59Z' }, from, to)).toBe(false)
    expect(withinWindow({ created_at: '2026-09-19T06:00:00Z' }, from, to)).toBe(true)
  })

  it('KEEPS a row with no readable timestamp', () => {
    // Dropping it would lose records over a formatting difference. The caller
    // dedupes, so a stray row costs nothing and a missing one costs the metric.
    expect(withinWindow({}, from, to)).toBe(true)
    expect(withinWindow({ created_at: 'nonsense' }, from, to)).toBe(true)
  })

  it('keeps everything when the window itself is unreadable', () => {
    expect(withinWindow({ created_at: '2026-09-19T06:00:00Z' }, 'bad', to)).toBe(true)
  })
})
