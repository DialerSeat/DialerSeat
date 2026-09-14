



















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

/**
 * How many times the dialer may work through a lead before retiring it.
 *
 * 0 MEANS UNLIMITED, and 0 is the setting. A lead is never retired for having
 * been dialed too often; it keeps cycling back into rotation and the agent
 * decides when it is done by dispositioning it.
 *
 * This was 3. The effect of a lifetime cap is that a list quietly shrinks
 * while an agent is working it, and leads vanish for a reason nothing on
 * screen explains. Retiring a lead is a judgement about a person, and the
 * person holding that judgement is the agent, not a counter.
 *
 * The ways a lead genuinely leaves rotation are unchanged and all of them are
 * decisions: DNC, closed, appointment, or an agent marking it done. See
 * TERMINAL_STATUSES in lib/dialableLead.ts.
 */
export const DIAL_PASSES = 0

/** Returned when there is no lifetime cap, so `attempts >= cap` is never true. */
export const UNLIMITED_ATTEMPTS = Number.POSITIVE_INFINITY

/**
 * Total attempts a lead gets across its whole life, derived from the
 * campaign's per-pass repeat setting.
 *
 * With DIAL_PASSES at 0 this is UNLIMITED_ATTEMPTS for every campaign. The
 * per-pass arithmetic is kept rather than deleted because dial_repeat_count
 * still governs back-to-back dialing within one pass, which is a separate and
 * still-live setting, and because restoring a cap should be changing one
 * number here rather than rewriting this.
 *
 *   passes 0 -> unlimited
 *   passes 3 -> 1x = 3 total, 2x = 6, 3x = 9
 */
export function lifetimeAttemptCap(dialRepeatCount?: number | null): number {
  if (DIAL_PASSES <= 0) return UNLIMITED_ATTEMPTS
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