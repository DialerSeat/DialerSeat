// ─────────────────────────────────────────────────────────────────────────
// VOLUME TIERS FOR TEAM SEATS
//
// One ladder, defined once. Every surface that mentions a discount — the team
// view, the badge, the billing calculation — reads it from here, because a
// discount quoted in the UI and a discount applied to a card are the two lists
// that must never disagree.
//
// WHAT COUNTS: two different numbers, because they answer two different
// questions and conflating them makes the discount incoherent.
//
//   ownerPaidSeats — seats the owner is actually billed for. This is what earns
//   and receives the discount. A rebate is a reduction of what you spend; an
//   agent-pays seat costs the owner nothing, so discounting it is five percent
//   of nothing, and counting it toward the threshold would hand an owner a
//   volume rebate on volume they do not fund.
//
//   totalSeats — the whole roster, however each seat is funded. This earns the
//   badges and triggers the sales handoff, because somebody who has put fifty
//   agents on the platform has built something worth a conversation even when
//   every one of them pays their own way. The reward for that is a partnership,
//   not a discount that mathematically cannot reward them.
//
// Both are counted across every team the OWNER runs. The owner is the billing
// entity, so a vendor with three teams of eight is one twenty-four-seat
// customer, not three small ones — counting per team would punish exactly the
// structure this is meant to reward.
//
// WHEN IT IS COUNTED: at the moment a seat's weekly charge is raised, holding
// for that week. Not continuously — recomputing as agents come and go means an
// owner's bill moves under them mid-cycle, and the support cost of explaining
// that exceeds the discount.
//
// PRICING LANGUAGE: weekly, always. Seats bill weekly and cancel anytime; a
// monthly figure is not a thing this product quotes.
// ─────────────────────────────────────────────────────────────────────────

export interface SeatTier {
  key: 'standard' | 'ten' | 'twentyfive' | 'partner'
  /** Inclusive floor — this tier applies at this many active seats and up. */
  minSeats: number
  /** Percent off the weekly seat cost. 0 for standard; null when the rate is
   *  negotiated rather than automatic. */
  percentOff: number | null
  label: string
  /** Shown on the team view as an earned marker. */
  badge: string | null
  /** Above this point the rate is a conversation, not a formula. */
  salesHandoff: boolean
}

export const SEAT_TIERS: SeatTier[] = [
  {
    key: 'standard',
    minSeats: 0,
    percentOff: 0,
    label: 'Standard',
    badge: null,
    salesHandoff: false,
  },
  {
    key: 'ten',
    minSeats: 10,
    percentOff: 5,
    label: 'Floor',
    badge: 'FLOOR',
    salesHandoff: false,
  },
  {
    key: 'twentyfive',
    minSeats: 25,
    percentOff: 10,
    label: 'Operator',
    badge: 'OPERATOR',
    salesHandoff: false,
  },
  {
    key: 'partner',
    minSeats: 50,
    // Deliberately null rather than a number. Above fifty seats the rate is
    // negotiated, and printing a percentage here would either undercut that
    // conversation or promise something sales has not agreed to.
    percentOff: null,
    label: 'Partner',
    badge: 'PARTNER',
    salesHandoff: true,
  },
]

/** The tier a given seat count has earned. Never returns undefined — the
 *  standard tier has a floor of zero. */
export function tierForSeats(activeSeats: number): SeatTier {
  let current = SEAT_TIERS[0]
  for (const t of SEAT_TIERS) {
    if (activeSeats >= t.minSeats) current = t
  }
  return current
}

/** The next rung up, and how many seats away it is. Null once they are on the
 *  top tier — there is nothing left to dangle. */
export function nextTierForSeats(
  activeSeats: number
): { tier: SeatTier; seatsAway: number } | null {
  for (const t of SEAT_TIERS) {
    if (activeSeats < t.minSeats) {
      return { tier: t, seatsAway: t.minSeats - activeSeats }
    }
  }
  return null
}

/** Every badge earned so far, not just the current one — a team that reached
 *  twenty-five keeps the ten-seat marker. */
export function badgesForSeats(activeSeats: number): string[] {
  return SEAT_TIERS.filter(t => t.badge && activeSeats >= t.minSeats).map(t => t.badge!)
}

/**
 * Discount to apply to a seat charge, in percent.
 *
 * Returns 0 for the standard tier AND for the partner tier: a negotiated rate
 * is applied deliberately by whoever agreed it, never inferred here. Guessing a
 * partner's percentage would be this module inventing a price.
 */
export function automaticPercentOff(activeSeats: number): number {
  const tier = tierForSeats(activeSeats)
  return tier.percentOff ?? 0
}

/** Weekly seat cost after the automatic discount, in cents. */
export function discountedSeatCents(baseCents: number, activeSeats: number): number {
  const pct = automaticPercentOff(activeSeats)
  if (pct <= 0) return baseCents
  return Math.round(baseCents * (100 - pct) / 100)
}

export interface SeatTierSummary {
  /** The whole roster, however funded. Drives badges and the sales handoff. */
  totalSeats: number
  /** Seats the owner is billed for. Drives the discount, and only this. */
  ownerPaidSeats: number
  /** Tier earned by the seats the owner pays for. */
  tier: SeatTier
  next: { tier: SeatTier; seatsAway: number } | null
  badges: string[]
  percentOff: number
  /** True when the roster is big enough to be worth a conversation, even if
   *  the owner funds few of those seats themselves. */
  salesHandoff: boolean
}

export function summariseSeatTier(
  ownerPaidSeats: number,
  totalSeats: number = ownerPaidSeats
): SeatTierSummary {
  const tier = tierForSeats(ownerPaidSeats)
  return {
    totalSeats,
    ownerPaidSeats,
    tier,
    // The rung being chased is the next one up in OWNER-PAID seats, since that
    // is the only number that moves the discount. Telling someone they are
    // three seats from 5% off when those three seats would be self-funded
    // would be the panel promising something the billing cannot deliver.
    next: nextTierForSeats(ownerPaidSeats),
    // Recognition follows the roster, not the invoice.
    badges: badgesForSeats(totalSeats),
    percentOff: automaticPercentOff(ownerPaidSeats),
    salesHandoff: tier.salesHandoff || tierForSeats(totalSeats).salesHandoff,
  }
}
