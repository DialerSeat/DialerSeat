/**
 * When is the agent's SIP registration bad enough to force a re-register?
 *
 * ── WHY A STREAK ALONE WAS NOT ENOUGH ──────────────────────────────────
 * The dialer forced a re-register after AGENT_LEG_FAIL_LIMIT consecutive
 * failures, and cleared the streak on every INVITE that did arrive. That
 * catches a registration which has died outright, and nothing else.
 *
 * One agent ran 47 failures in 226 dials — 20.8%, one call in five never
 * reaching their headset — while another on the same build ran 0.7%. At a
 * scattered 20% the chance of two failures landing back to back is about
 * 4%, so the recovery almost never fired for the agent who needed it most.
 * It rescued the case that fixes itself and slept through the case that
 * does not.
 *
 * So health is judged two ways. A streak still catches sudden death fast.
 * A rate over a short window catches the registration that is half alive —
 * which is the shape that actually costs leads, because every one of those
 * failures is a lead dialled, billed a six-second leg on both connections,
 * and never spoken to.
 */

/** Consecutive failures that mean the registration is simply gone. */
export const AGENT_LEG_STREAK_LIMIT = 2

/** How many recent agent legs the rate is judged over. */
export const AGENT_LEG_WINDOW = 10

/**
 * Failures within that window that mean the registration is unhealthy.
 *
 * Three in ten is 30%, comfortably above the 3-4% the healthy agents run at
 * and below the 20% seen on a bad one, so it fires on a genuinely broken
 * connection without chasing ordinary noise.
 */
export const AGENT_LEG_WINDOW_FAILURES = 3

/** Most recent last. `true` is a leg that never arrived. */
export type AgentLegHistory = boolean[]

export function recordAgentLegOutcome(
  history: AgentLegHistory,
  failed: boolean,
  window: number = AGENT_LEG_WINDOW
): AgentLegHistory {
  const next = [...history, failed]
  return next.length > window ? next.slice(next.length - window) : next
}

/**
 * Should the client force a re-register?
 *
 * Deliberately takes both signals rather than deriving the streak from the
 * history: the streak is also cleared by things the history does not see, and
 * the caller owns that.
 */
export function needsReregister(params: {
  consecutiveFailures: number
  history: AgentLegHistory
  streakLimit?: number
  windowFailures?: number
}): boolean {
  const streakLimit = params.streakLimit ?? AGENT_LEG_STREAK_LIMIT
  const windowFailures = params.windowFailures ?? AGENT_LEG_WINDOW_FAILURES

  if (params.consecutiveFailures >= streakLimit) return true

  // Only judge a rate once there is a window's worth to judge. Two failures
  // out of the first three dials of a shift is not evidence of anything, and
  // re-registering on it would interrupt an agent who is fine.
  if (params.history.length < (params.windowFailures ?? AGENT_LEG_WINDOW_FAILURES) * 2) return false

  return params.history.filter(Boolean).length >= windowFailures
}
