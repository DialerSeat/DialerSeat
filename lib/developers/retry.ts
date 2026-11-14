// =============================================================================
// WEBHOOK RETRIES
// =============================================================================
// A delivery that fails (no answer, a timeout, anything but a 2xx) is retried on
// this schedule, counted from its first attempt: 1 minute, 5, 30, then 2, 6, 12
// and 24 hours, and every 24 hours after that until 72 hours have passed. Then
// it is marked failed and stays in the console's delivery log. The same event
// id is sent every time, so a platform that already processed it can ignore it.
// =============================================================================

export const RETRY_WINDOW_MS = 72 * 60 * 60 * 1000
const STEPS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000, 12 * 3600_000, 24 * 3600_000]

/** Wait before the next attempt, after `attempts` attempts so far (1 = the first send). */
export function retryDelayMs(attempts: number): number {
  return STEPS_MS[Math.min(Math.max(attempts, 1), STEPS_MS.length) - 1]
}

/** When to try next, or null when the 72-hour window is over and it is failed. */
export function nextAttemptAt(createdAt: Date, attempts: number, now = new Date()): Date | null {
  const next = new Date(now.getTime() + retryDelayMs(attempts))
  return next.getTime() - createdAt.getTime() > RETRY_WINDOW_MS ? null : next
}
