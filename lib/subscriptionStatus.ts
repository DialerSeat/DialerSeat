// A subscription counts as truly, currently active only when:
//  - Stripe's status is the literal 'active' (not trialing, past_due, incomplete, etc.)
//  - it is not already scheduled to cancel (cancel_at_period_end)
//
// Stripe leaves status='active' until the current billing period actually
// ends, even after someone cancels — so checking status alone is not enough
// to answer "is this a real, ongoing customer right now". This is the one
// shared definition every admin surface (Overview, Analytics, Logs) should
// use for that present-moment question, so the answer can't drift apart
// between files again.
//
// This is deliberately NOT used for historical/point-in-time questions
// (e.g. "was this subscriber active 4 weeks ago" for a trend chart) — those
// should keep evaluating status as of that past moment, since a
// cancellation decided today doesn't rewrite whether someone was a real
// paying customer back then.
export function isSubscriptionTrulyActive(sub: {
  status: string
  cancel_at_period_end?: boolean | null
}): boolean {
  return sub.status === 'active' && !sub.cancel_at_period_end
}
