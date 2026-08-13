



















export const HARD_LINE_CAP = 5

// =============================================================================
// ATTEMPT CAPS — two different limits that were previously one number
// =============================================================================
// campaigns.dial_repeat_count (1/2/3, the "1x/2x/3x" control in the dialer) is
// how many times a lead is dialed BACK TO BACK before moving on to the next
// lead. It is a per-pass setting about pacing.
//
// It was also being used as the lifetime cap, in two different and mutually
// inconsistent ways:
//
//   app/api/leads/dispose        hardcoded a lifetime cap of 3, ignoring the
//                                setting entirely — so on 3x a lead burned
//                                through all three of its lifetime attempts
//                                in a single pass and was retired forever
//                                after one visit.
//   bumpLeadAttemptAndRelease    used dial_repeat_count ITSELF as the lifetime
//                                cap — so on 1x a predictive lead was retired
//                                permanently after a single attempt.
//
// Neither matches the intent: "dial it up to 3 times in a row, and let it come
// back around on later passes." Separating the two makes that expressible —
// the repeat count controls a pass, DIAL_PASSES controls how many passes a
// lead gets before it is genuinely set aside.
// =============================================================================

/** How many times the dialer may work through a lead before retiring it. */
export const DIAL_PASSES = 3

/**
 * Total attempts a lead gets across its whole life, derived from the
 * campaign's per-pass repeat setting.
 *
 *   1x -> 3 total   (unchanged from the old hardcoded behavior)
 *   2x -> 6 total
 *   3x -> 9 total
 *
 * Defaults to 1x when the campaign has no setting, which keeps every existing
 * campaign exactly where it is today.
 */
export function lifetimeAttemptCap(dialRepeatCount?: number | null): number {
  const perPass = Math.max(1, Math.min(3, dialRepeatCount ?? 1))
  return perPass * DIAL_PASSES
}



export const ABANDON_DEGRADE_PCT = 2.5


export const ABANDON_RECOVER_PCT = 2.0


export const ABANDON_YIELD_PCT = 2.8





export const IN_FLIGHT_WINDOW_MS = 90_000




export const STALE_HEARTBEAT_MS = 15_000
export const STALE_HEARTBEAT_SECONDS = STALE_HEARTBEAT_MS / 1000


/**
 * Rolling window cron/number-health judges a number's answer rate over.
 *
 * Shared because cron/pool-reset derives its cooling-off period from it: a
 * resting number places no calls, so its bad sample only ages out once the
 * rest has outlasted this window. Reviving sooner re-rests the number on the
 * same evidence. Two files holding this number separately is how they end up
 * contradicting each other, which has already happened once in AMD.
 */
export const HEALTH_WINDOW_DAYS = 3

export const ABANDON_WINDOW_DAYS = 30
export const ABANDON_WINDOW_MS = ABANDON_WINDOW_DAYS * 24 * 60 * 60 * 1000


export const ABANDON_DEGRADE_FRACTION = ABANDON_DEGRADE_PCT / 100
export const ABANDON_RECOVER_FRACTION = ABANDON_RECOVER_PCT / 100
export const ABANDON_YIELD_FRACTION = ABANDON_YIELD_PCT / 100