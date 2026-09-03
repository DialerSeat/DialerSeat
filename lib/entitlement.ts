// =============================================================================
// WHICH SUBSCRIPTION STATUSES GRANT ACCESS
// =============================================================================
// One definition, imported by everything that gates on it. This existed twice
// — `ACTIVE_STATUSES` in lib/subscription.ts and again in proxy.ts — as two
// hand-maintained lists meaning one thing. That is the shape of every drift
// this codebase has paid for: the disposition strings, the sub-queue filters,
// the access modes, the settings menus. Each pair was kept in step by a
// comment, and each pair eventually disagreed.
//
// It matters more here than anywhere else. These two lists are the difference
// between somebody having access and not, so a disagreement is either a
// customer locked out of a product they paid for, or a stranger dialling on
// somebody else's money.
//
// DELIBERATELY NARROW. 'past_due' is not here: a card that failed is a card
// that failed, and the retry machinery exists to chase it while access is
// suspended. 'incomplete' is not here either — that is a checkout somebody
// started and did not finish.
//
// No heavy imports, because proxy.ts runs as middleware and pulls this in.
// =============================================================================

/**
 * Subscription statuses that entitle somebody to use DialerSeat.
 *
 * `active` and nothing else. This briefly read `['active', 'trialing']` while
 * the product offered a free week; the trial was removed on the reasoning that
 * a card up front is the cheapest filter for an unserious signup there is.
 *
 * Legacy `trialing` rows still exist in the database from that period. They are
 * deliberately NOT entitled: every one of them has an expiry date in the past,
 * so honouring the status would grant access on the strength of a trial that
 * already ended.
 */
export const ENTITLED_STATUSES = ['active'] as const

export function isEntitledStatus(status: string | null | undefined): boolean {
  return !!status && (ENTITLED_STATUSES as readonly string[]).includes(status)
}
