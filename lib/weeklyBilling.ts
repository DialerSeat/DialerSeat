// =============================================================================
// WHAT A WEEK COSTS — weekly billing against monthly billing
// =============================================================================
// DialerSeat bills by the week. Every multi-line dialer we compare against
// bills by the month or the year, so the smallest amount of it you can buy is
// a month. That is the point /pricing and the cost calculator make, and they
// both read it from here so the two cannot disagree.
//
// EVERY FIGURE BELOW IS ALREADY PUBLISHED on the matching /vs page or in
// lib/competitors.ts; `basis` says which. Nothing here is new research, and a
// competitor with no published price is shown as quoted, not estimated.
//
// Only tools that sell multi-line or predictive dialing are in the list.
// Phone systems that bolt a single-line power dialer onto a cheaper plan
// (CloudTalk, Aircall, Dialpad) can cost less per month and are a different
// product; the pricing index at /data/dialer-pricing lists them with the rest.
//
// canonicalFacts forbids stating a monthly figure for DialerSeat, and nothing
// here does: DialerSeat is only ever priced in weeks.
// =============================================================================

export const DIALERSEAT_WEEKLY = 35

export type Commitment = 'month' | 'year' | 'quote'

export interface BilledDialer {
  slug: string
  name: string
  /** Lowest per-seat monthly figure that includes multi-line or predictive dialing, or null if quoted only. */
  perSeatMonth: number | null
  /** True when the figure is a floor ("from", "+"). */
  from: boolean
  /** The shortest term you can buy. */
  commitment: Commitment
  /** Smallest number of seats you can buy. */
  minimumSeats: number
  /** Where the figure is stated, as the site already states it. */
  basis: string
}

export const BILLED_DIALERS: BilledDialer[] = [
  {
    slug: 'readymode',
    name: 'ReadyMode',
    perSeatMonth: 199,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$199 or more per seat per month, typically on an annual contract, often with a setup fee',
  },
  {
    slug: 'phoneburner',
    name: 'PhoneBurner',
    perSeatMonth: 140,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$140 per seat per month on the Professional tier',
  },
  {
    slug: 'mojo',
    name: 'Mojo Dialer',
    perSeatMonth: 149,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$139 per month for Triple Line plus the $10 Agent Access licence, before data add-ons',
  },
  {
    slug: 'wavv',
    name: 'WAVV',
    perSeatMonth: 149,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$149 per month for the Multi Line plan predictive needs, plus $1 per number',
  },
  {
    slug: 'batchdialer',
    name: 'BatchDialer',
    perSeatMonth: 119,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$119 to $249 per seat month to month; the ~$95 headline needs annual prepay',
  },
  {
    slug: 'kixie',
    name: 'Kixie',
    perSeatMonth: 95,
    from: true,
    commitment: 'month',
    minimumSeats: 1,
    basis: '$95 or more per seat per month for multi-line dialing',
  },
  {
    slug: 'orum',
    name: 'Orum',
    perSeatMonth: 250,
    from: false,
    commitment: 'year',
    minimumSeats: 3,
    basis: 'Around $250 per user per month billed annually, with a three-seat minimum',
  },
  {
    slug: 'five9',
    name: 'Five9',
    perSeatMonth: 175,
    from: true,
    commitment: 'quote',
    minimumSeats: 1,
    basis: 'Not published; quotes commonly land at $175+ per seat per month on multi-year terms',
  },
  {
    slug: 'convoso',
    name: 'Convoso',
    perSeatMonth: null,
    from: false,
    commitment: 'quote',
    minimumSeats: 1,
    basis: 'Custom quote with a seat minimum',
  },
]

/** Average days in a month, so a 5-week stretch reads as two billed months. */
const DAYS_PER_MONTH = 30.44

/** Billed months needed to cover `weeks` of use on a monthly plan. */
export function monthsToCover(weeks: number): number {
  return Math.max(1, Math.ceil((weeks * 7) / DAYS_PER_MONTH - 1e-9))
}

/** What DialerSeat costs for `weeks` of use across `seats`. */
export function dialerSeatCost(weeks: number, seats: number): number {
  return DIALERSEAT_WEEKLY * Math.max(1, weeks) * Math.max(1, seats)
}

/**
 * What a monthly- or annually-billed dialer costs for `weeks` of use, or null
 * when it is sold by quote. Seat minimums apply: two seats on a three-seat
 * minimum are billed as three.
 */
export function billedCost(d: BilledDialer, weeks: number, seats: number): number | null {
  if (d.perSeatMonth === null || d.commitment === 'quote') return null
  const billedSeats = Math.max(d.minimumSeats, seats)
  const months = d.commitment === 'year' ? Math.max(12, monthsToCover(weeks)) : monthsToCover(weeks)
  return d.perSeatMonth * billedSeats * months
}
