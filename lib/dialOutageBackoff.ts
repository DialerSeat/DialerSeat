// =============================================================================
// WHEN EVERY DIAL IS FAILING, SLOW DOWN. NEVER STOP.
// =============================================================================
// On 11 September the Telnyx account was blocked and the pool was empty. Both
// conditions fail EVERY dial for EVERY agent. The dialer retried anyway: 4,341
// attempts across ten hours, not one reaching Telnyx, one lead attempted 41
// times in a single hour.
//
// lib/dialOutageAlert.ts now says something the moment it happens. This is the
// other half: stop hammering while it is happening.
//
// ── DELAY, NEVER REFUSE ─────────────────────────────────────────────────────
// docs/CARRIER-ENGINEERING.md §10: a guard that can refuse is one bad
// measurement from an outage. lib/concurrency.ts is the scar. So this returns a
// number of milliseconds to wait and nothing else — there is no code path here
// that can prevent a call being placed. If the detection is completely wrong,
// the worst case is that a dial is slow, and the FIRST success clears it.
//
// That is the same shape as lib/cpsGovernor.ts, deliberately.
//
// ── WHY IT KEYS ON 'capacity' AND NOTHING ELSE ──────────────────────────────
// placeOutboundCall already classifies failures, and the taxonomy says exactly
// what is needed: `capacity` is *"Nothing to do with this lead: the account has
// no number to dial from... The next lead in the same tick will fail
// identically."* That is precisely the condition worth backing off on.
//
// `permanent` (this lead is undialable) and `transient` (might work next time)
// must NOT count. A calling-window refusal, a destination-rate block, a
// suppression hit — those are correct outcomes for that lead and the next lead
// is fine. Backing off on them would slow a perfectly healthy dialer.
//
// ── THE SERVERLESS CAVEAT, STATED PLAINLY ───────────────────────────────────
// The counter is per-process. A warm Vercel instance handles many consecutive
// requests, so a burst from one agent is usually caught; a spread of cold
// starts is not. That makes this a DAMPER, not a gate — it cannot be relied on
// to stop a runaway, which is exactly why the alert half exists and why nothing
// here refuses. A DB-backed counter would be exact and would also add a write
// to the failure path and a read to the happy path, to slow down a condition
// that should last minutes.

/** Consecutive capacity failures before any delay at all. */
const FREE_FAILURES = 2

/** Base delay, doubling per failure past the free ones. */
const BASE_DELAY_MS = 500

/**
 * Ceiling. **This must stay well under the serverless function timeout.**
 *
 * It was 10,000ms, which is EXACTLY Vercel Hobby's default function duration
 * (10s), and neither `/api/calls/outbound` nor `/api/dialer/heartbeat` declares
 * a `maxDuration`, so both inherit it. At full backoff the function would be
 * killed with no budget left — and if the kill landed AFTER Telnyx accepted the
 * agent leg but before we recorded it, that is a leg placed and billed with no
 * `calls` row pointing at it. An orphan charge, created by the thing meant to
 * reduce charges.
 *
 * 2.5s leaves 7.5s of headroom for the dial itself and still does the job: the
 * burst this exists to damp ran 1,827 attempts in one hour on 11 September —
 * one every two seconds — so a 2.5s floor between attempts more than halves it.
 * The ten-hour average of 7.2/minute was never the shape worth fixing; the
 * bursts were.
 */
const MAX_DELAY_MS = 2_500

/**
 * A failure older than this is not evidence about now. An agent who comes back
 * after lunch to a fixed account should not inherit the morning's backoff.
 */
const MEMORY_MS = 5 * 60_000

let consecutive = 0
let lastFailureAt = 0

/** Test seam. Never called from the dial path. */
export function __resetBackoff(): void {
  consecutive = 0
  lastFailureAt = 0
}

/**
 * Record that a dial failed for an account-level reason.
 *
 * Call ONLY for `failureKind === 'capacity'`.
 */
export function noteCapacityFailure(): void {
  const now = Date.now()
  if (now - lastFailureAt > MEMORY_MS) consecutive = 0
  consecutive += 1
  lastFailureAt = now
}

/**
 * Record that a dial reached Telnyx. Clears the backoff completely.
 *
 * One success is enough. The condition this guards against is total — when it
 * lifts, it lifts for everyone at once, so there is nothing to ease back into.
 */
export function noteDialSuccess(): void {
  consecutive = 0
  lastFailureAt = 0
}

/**
 * Milliseconds the next dial should wait. Never throws, never refuses.
 *
 * 0 for the first two failures, then 500ms doubling to the 2.5s ceiling:
 *
 *     failure   3      4      5      6+
 *     delay   500ms  1.0s   2.0s   2.5s
 *
 * The ceiling is set by the function timeout, not by what would damp best —
 * see MAX_DELAY_MS.
 */
export function backoffDelayMs(): number {
  if (consecutive <= FREE_FAILURES) return 0
  if (Date.now() - lastFailureAt > MEMORY_MS) return 0
  const steps = consecutive - FREE_FAILURES - 1
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, steps))
}

/**
 * Wait out the current backoff, if any. Returns the ms actually waited.
 *
 * Awaited on the dial path, which is why every branch here is bounded: the
 * delay is capped, the memory expires, and a thrown clock or a corrupted
 * counter can only produce 0.
 */
export async function awaitDialBackoff(): Promise<number> {
  let delay = 0
  try {
    delay = backoffDelayMs()
  } catch {
    return 0
  }
  if (!Number.isFinite(delay) || delay <= 0) return 0
  const capped = Math.min(delay, MAX_DELAY_MS)
  await new Promise(r => setTimeout(r, capped))
  return capped
}
