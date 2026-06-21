// =============================================================================
// DIALER CONSTANTS — single source of truth for pacing / compliance numbers
// =============================================================================
// These values were previously duplicated (and DISAGREED) across:
//   - lib/predictiveController.ts   (HARD_LINE_CAP=5, degrade=2.5, in-flight 90s/disposition-null)
//   - lib/dialerPacing.ts           (lines clamp 1-3, degrade 2.5/recover 2.0, in-flight 60s/duration=0)
//   - app/api/dialer/heartbeat      (STALE_HEARTBEAT_SECONDS=15, YIELD_THRESHOLD_PCT=2.8)
//   - app/api/calls/amd-result      (heartbeat staleness 15_000ms)
//
// Two different definitions of "in-flight" and two different line caps for the
// SAME predictive feature is a compliance hazard: the abandon-rate safety
// mechanism can fire late or the controller can over-dial. Centralize here and
// import everywhere so the numbers can only ever be changed in one place.
//
// LEGAL CONTEXT (FTC TSR, 16 CFR § 310.4(b)): predictive abandonment must stay
// under 3% measured over 30 days. Everything below keeps a margin under that.
// =============================================================================

// ── Line caps ────────────────────────────────────────────────────────────
// The absolute ceiling on simultaneous lines per agent, regardless of config.
export const HARD_LINE_CAP = 5

// ── Abandon-rate thresholds (as PERCENT, e.g. 2.5 = 2.5%) ──────────────────
// Auto-degrade to single-line dialing at/above this rate.
export const ABANDON_DEGRADE_PCT = 2.5
// Stop auto-degrading once the rate falls back below this (hysteresis buffer
// so we don't flap right at the threshold).
export const ABANDON_RECOVER_PCT = 2.0
// Heartbeat tells the agent to yield (pause fanout) at/above this rate. Set
// slightly above the degrade trigger as a last-resort brake before the 3% cap.
export const ABANDON_YIELD_PCT = 2.8

// ── "In-flight" call definition ────────────────────────────────────────────
// A call counts as in-flight if it was created within this window AND has no
// disposition yet. Use ONE definition everywhere. (The old duration=0 proxy
// was unreliable because CallDuration is only written on terminal webhooks.)
export const IN_FLIGHT_WINDOW_MS = 90_000

// ── Agent session / heartbeat freshness ────────────────────────────────────
// An agent is considered offline if their last heartbeat is older than this.
// MUST match the interval used by any SQL stale-claim function.
export const STALE_HEARTBEAT_MS = 15_000
export const STALE_HEARTBEAT_SECONDS = STALE_HEARTBEAT_MS / 1000

// ── Abandon-rate measurement window ────────────────────────────────────────
export const ABANDON_WINDOW_DAYS = 30
export const ABANDON_WINDOW_MS = ABANDON_WINDOW_DAYS * 24 * 60 * 60 * 1000

// Convenience: fraction forms for code that works in 0-1 instead of percent.
export const ABANDON_DEGRADE_FRACTION = ABANDON_DEGRADE_PCT / 100
export const ABANDON_RECOVER_FRACTION = ABANDON_RECOVER_PCT / 100
export const ABANDON_YIELD_FRACTION = ABANDON_YIELD_PCT / 100