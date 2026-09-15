



















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
 * 0 means unlimited. It is no longer the setting — see below.
 *
 * ── THE CAP IS BACK, AT NINE ──────────────────────────────────────
 * This was 0, meaning unlimited, and that was a deliberate product decision:
 * "Retiring a lead is a judgement about a person, and the person holding that
 * judgement is the agent, not a counter."
 *
 * Reversed by the owner on 15 Sept, with the evidence behind it. Over 30 days,
 * split by how many times a lead had already been tried:
 *
 *     attempt      dials   conversations   per 100 dials   cost each
 *     1st          1,340        40             2.99          $0.093
 *     2nd            562         8             1.42          $0.067
 *     3rd            102         3             2.94          $0.042
 *     4th or later   153         1             0.65          $0.196
 *
 * A hundred and fifty-three dials — 9% of everything dialled — for one
 * conversation, at twice the cost of a first attempt. The counter is not
 * replacing the agent's judgement; it is stopping the queue handing the same
 * unreachable person back for a tenth time.
 *
 * NINE, flat. Every campaign on this account is set to 1x, so the old ladder
 * (1x=3, 2x=6, 3x=9) would have capped them at three, which is far stricter
 * than asked for. MAX_LIFETIME_ATTEMPTS is therefore a ceiling applied on top
 * of the ladder rather than a replacement for it: the per-pass arithmetic still
 * scales, and nothing ever exceeds nine.
 */
export const DIAL_PASSES = 9

/**
 * Hard ceiling on lifetime attempts, whatever the per-pass arithmetic says.
 *
 * Enforced in THREE places, deliberately, because relying on one has already
 * failed: lifetimeAttemptCap (what dispose/update write), isDialableLead (what
 * the queue panel shows and the dialer picks), and the status 'maxed' those
 * two produce. On 15 Sept ZERO leads in the table had ever reached 'maxed'
 * while 62 sat past three attempts still dialable — because the cap was
 * infinite AND /api/leads/update never bumped the counter. A rule with one
 * enforcement point is a rule that silently stops existing.
 */
export const MAX_LIFETIME_ATTEMPTS = 9

/** Returned when there is no lifetime cap, so `attempts >= cap` is never true. */
export const UNLIMITED_ATTEMPTS = Number.POSITIVE_INFINITY

/**
 * Total attempts a lead gets across its whole life.
 *
 *   passes 0 -> unlimited (kept so the cap can be switched off again)
 *   passes 9 -> 1x = 9, and 2x/3x clamp to MAX_LIFETIME_ATTEMPTS
 */
export function lifetimeAttemptCap(dialRepeatCount?: number | null): number {
  if (DIAL_PASSES <= 0) return UNLIMITED_ATTEMPTS
  const perPass = Math.max(1, Math.min(3, dialRepeatCount ?? 1))
  return Math.min(perPass * DIAL_PASSES, MAX_LIFETIME_ATTEMPTS)
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