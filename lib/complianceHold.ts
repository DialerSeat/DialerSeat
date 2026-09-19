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
/**
 * Floor for the AGENT's leg, which is a different problem with the same shape.
 *
 * Telnyx flagged this account on 16 Sept: 18.86% short-duration calls against
 * a 15% limit. Measured against the carrier's own billed seconds, the lead legs
 * this file was written to protect scored ZERO of 1,143 — the hold works. Every
 * single short call was the agent's own WebRTC leg.
 *
 * It happens when a lead leg fails FAST. user_busy and not_found come back in
 * a second or two, the agent's leg is released immediately after, and an
 * on-net leg that lived two seconds bills at the 6-second minimum — which is
 * exactly Telnyx's definition of a short duration call. It then counts TWICE,
 * because the call-control and SIP-trunk sides of the same leg are billed as
 * separate legs.
 *
 * Seven, not eight. This leg bills in SIX-second increments, not sixty, so
 * clearing 6 only needs one second of margin and the next increment is 12. A
 * higher floor would buy nothing and hold a line longer.
 */
export const AGENT_LEG_MIN_SECONDS = 7

export function remainingHoldMs(minSeconds: number, elapsedMs: number): number {
  const target = holdTargetMs(minSeconds)
  if (target <= 0) return 0
  return Math.max(0, target - elapsedMs)
}

/**
 * How long a leg has been BILLING, which is not how long it has existed.
 *
 * Telnyx starts charging at answer. A hold measured from the dial spends the
 * ring time out of its own floor: a call that rang three seconds and was held
 * to nine from creation billed six seconds — exactly on the short-duration
 * line — and one that rang twenty-six seconds was already past the floor the
 * moment it connected, so it was released immediately and billed five.
 *
 * ── THERE IS NO FALLING BACK TO created_at ─────────────────────────────
 * An earlier version of this took created_at when the answer stamp was
 * missing, described as holding the leg longer. It does the opposite. The
 * dial is EARLIER than the answer, so it reports a larger elapsed, and a
 * larger elapsed asks remainingHoldMs for LESS hold — the precise mistake
 * this function exists to correct, reintroduced as its own fallback. Legs
 * kept billing six seconds whenever the answer webhook had not landed yet,
 * which is a documented race: the AMD verdict and call.answered are separate
 * events about three seconds apart.
 *
 * No answer stamp now means elapsed 0, so the FULL floor is held. Holding a
 * leg a couple of seconds too long costs a fraction of a cent. Releasing one
 * early costs the surcharge on every short call that month.
 */
export function billingElapsedMs(
  answeredAt: string | null | undefined,
  now: number = Date.now()
): number {
  const startedMs = answeredAt ? new Date(answeredAt).getTime() : NaN
  if (!Number.isFinite(startedMs)) return 0
  return Math.max(0, now - startedMs)
}

/**
 * A leg still settling must not be cut short to make the next dial look fast.
 *
 * A back-to-back redial deliberately reuses the same pool number — inside
 * three minutes that is the Apple repeated-call rule, and the recipient
 * should see the caller ID they just saw. But the agent's SIP credential
 * carries one call at a time, so a new INVITE arriving while the previous
 * leg is still inside its billing floor tears that leg down early. It then
 * bills a six-second increment, which is the very thing the floor exists to
 * avoid: the dial looks instant and costs the surcharge.
 *
 * So the next dial waits out whatever is left of the floor, plus a moment for
 * the BYE to actually land, rather than racing it. The cost is a second or
 * two of pacing. What it buys is the leg being charged at the next increment
 * up instead of the short one — efficiency rather than speed.
 *
 * @param agentLegAnsweredAt when the agent's leg answered, ms, or null when
 *                           there is no live leg to wait for
 * @param floorMs            the billing floor being protected
 * @param minDelayMs         the pacing the caller wanted anyway
 */
export const LEG_SETTLE_MS = 400

export function nextDialDelayMs(
  agentLegAnsweredAt: number | null | undefined,
  floorMs: number,
  minDelayMs: number,
  now: number = Date.now()
): number {
  if (!agentLegAnsweredAt) return minDelayMs
  const remainingFloor = floorMs - (now - agentLegAnsweredAt)
  if (remainingFloor <= 0) return minDelayMs
  return Math.max(minDelayMs, remainingFloor + LEG_SETTLE_MS)
}
