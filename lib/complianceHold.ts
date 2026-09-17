// =============================================================================
// HOW LONG TO HOLD A LINE THAT WOULD OTHERWISE BE SHORT
// =============================================================================
// Telnyx count a connected call of six seconds or less as short duration, and
// surcharge the account when too many of them are. So when this platform is
// the one hanging up — a machine verdict, an agent skipping — it holds the
// line past that threshold rather than dropping it at two seconds.
//
// WHY THE NUMBER IS NOT FIXED. A hold of exactly eight seconds produces calls
// that end at 8.0s, every time, forever. That is a signature: a carrier
// looking at duration distributions sees a spike on one value that no human
// conversation would ever produce, and a spike sitting two seconds above
// their own short-call threshold is not a subtle one. The point of the hold is
// to stop being flagged, and a mechanical tell is its own kind of flag.
//
// Real call lengths are continuous, so this is too. Each hold picks a fresh
// target between the configured minimum and two and a half seconds above it,
// uniformly and at sub-second resolution. Durations land across 8, 9 and 10
// with no mode, which is what an ordinary spread of short calls looks like.
//
// THE MINIMUM IS A FLOOR, NOT A TARGET. Nothing here ever returns less than
// the configured seconds — the whole reason the hold exists is that below it
// the call is billable as short. Randomness only ever adds.
//
// ── WHY THE RANGE CAME DOWN FROM 9-12 ON 17 SEPT ─────────────────────
// Owner's call, and it is free in both directions: under Telnyx's 60/60 PSTN
// billing a held leg bills a full minute whether it runs eight seconds or
// twelve. So this range governs how the traffic LOOKS and how long a line is
// occupied, not what it costs. Eight still clears the six-second threshold,
// with two seconds of margin rather than three.
//
// What it does buy is occupancy: every held second is a concurrency slot and a
// pool number that cannot be dialling. Mean hold drops 10.75s -> 9.25s.
//
// EXPECT THE OPS TABLE TO READ ONE SECOND HIGHER THAN THIS RANGE. Measured
// across 595 machine legs on the old floor of 9, talk_seconds landed on
// 10/11/12/13 in almost exactly the proportions a [9, 12.5) target predicts
// for 9/10/11/12. That extra second is teardown plus webhook latency, timed
// against our clock rather than the carrier's — not drift in the hold.
//
// The floor is NOT dropped further to cancel that second out. Seven would sit
// one second off a threshold whose whole purpose is margin.
// =============================================================================

/**
 * How far above the configured minimum a hold may run.
 *
 * 2.5 rather than 2 so that ten-second calls actually occur. A uniform spread
 * of 2 over a floor of 8 produces durations in [8, 10), which after truncation
 * to whole billed seconds is only ever 8 or 9 — the top of the intended range
 * never appears, and "sometimes 10" quietly means never.
 */
export const HOLD_SPREAD_SECONDS = 2.5

/**
 * Milliseconds a call should live, measured from ANSWER.
 *
 * Answer, not dial: ring time is not billed and not counted toward the short
 * call ratio, so holding from dial would both overshoot and vary with how long
 * the phone rang.
 *
 * @param minSeconds the platform's configured floor
 *                   (platform_config.amd_hold_seconds_after_machine)
 */
export function holdTargetMs(minSeconds: number): number {
  if (!Number.isFinite(minSeconds) || minSeconds <= 0) return 0
  return (minSeconds + Math.random() * HOLD_SPREAD_SECONDS) * 1000
}

/**
 * How much longer to wait, given how long the call has already been up.
 *
 * Returns 0 when the call is already past its target — a call that has run
 * long enough has nothing to correct, and this must never SHORTEN one.
 */
export function remainingHoldMs(minSeconds: number, elapsedMs: number): number {
  const target = holdTargetMs(minSeconds)
  if (target <= 0) return 0
  return Math.max(0, target - elapsedMs)
}
