// =============================================================================
// CLASSIFYING TELNYX ERRORS, WHERE GETTING IT WRONG IS EXPENSIVE
// =============================================================================
// Pure string matching, no imports, so it can be tested — see vitest.config.ts
// on why that separation exists.
//
// The stake: placeOutboundCall turns these verdicts into a FailureKind, and
// `capacity` is not a mild label. It stops a whole predictive tick and, since
// 15 Sept, starts a backoff that delays subsequent dials. Widening a per-lead
// failure into an account-level one therefore slows the entire dialer over one
// prospect who cannot be reached.
//
// So these match Telnyx's actual observed wording, not a paraphrase of it.

/**
 * Telnyx D17 — our whole account is blocked, usually a spent balance.
 *
 * Observed verbatim on 11 September 2026, when this fired 227 times in a day
 * and nothing in the codebase recognised it:
 *
 *   "Account is disabled D17. The Account used to place the termination call
 *    is blocked."
 *
 * ── TWO NEAR-MISSES THAT WERE IN THE FIRST DRAFT ────────────────────────────
 * Both widened a per-lead failure into an account-level one:
 *
 *   /account.*blocked/i   also matches "the destination account has blocked
 *                         calls from this number" — ONE CALLEE refusing us,
 *                         which is per-lead and must not stop the dialer.
 *   includes('D17')       matches anywhere in the string, and Telnyx details
 *                         embed call_control_ids like `v3:QimHtanc0pXZ…` that
 *                         can contain those three characters by chance.
 *
 * Hence the anchored phrase and the word-boundary code match.
 */
export function isAccountBlockedError(title?: string | null, detail?: string | null): boolean {
  const t = title || ''
  const d = detail || ''
  return (
    /account is disabled/i.test(t) ||
    /account is disabled/i.test(d) ||
    /account used to place the termination call is blocked/i.test(d) ||
    /\bD17\b/.test(d)
  )
}
