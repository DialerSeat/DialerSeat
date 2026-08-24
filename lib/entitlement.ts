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
 * `trialing` was added when the 7-day free trial shipped. Before that this was
 * `['active']` with a comment reading "no trials" — accurate at the time, and
 * exactly the line that would have made a trial silently grant nothing.
 */
export const ENTITLED_STATUSES = ['active', 'trialing'] as const

export function isEntitledStatus(status: string | null | undefined): boolean {
  return !!status && (ENTITLED_STATUSES as readonly string[]).includes(status)
}

/**
 * Is this subscription a trial that has not been paid for yet?
 *
 * Used where the distinction matters — banners, seat billing, anything that
 * should not treat a trial as revenue. Access-wise a trial is equal to a paid
 * subscription, which is the whole point of it.
 */
export function isTrialing(status: string | null | undefined): boolean {
  return status === 'trialing'
}

/** How long a new customer's free trial runs. */
export const TRIAL_DAYS = 7
