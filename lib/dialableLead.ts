// =============================================================================
// DIALABILITY — the single definition of "can this lead be dialed right now"
// =============================================================================
// WHY THIS FILE EXISTS
//
// Two routes answered this question, and they answered it differently:
//
//   /api/leads/list?disposition=dialable  (what the queue panel DISPLAYS)
//       filtered on DISPOSITION — excluded 'DO NOT CALL', 'NOT INTERESTED',
//       'CLOSED', kept everything else.
//
//   /api/leads/next                       (what the dialer actually DIALS)
//       filtered on STATUS — required status IN ('uncalled','no_answer') and
//       explicitly excluded 'dnc','closed','appointment','maxed'.
//
// Those are different columns with different values, so the two sets were
// never the same set. In real production data the gap was 528 leads with
// status='maxed' + disposition='SKIPPED': the panel showed every one of them
// (their disposition isn't excluded) and the dialer could never call a single
// one (their status is 'maxed').
//
// The visible symptom is subtle and looks like something else entirely.
// Rows are displayed sorted by created_at, and the dialer walks that same
// displayed order looking for the first lead it can actually dial — so it
// silently skips past every undialable row at the top and lights up one
// somewhere further down. To the agent, the dialer looks like it is picking
// leads at random instead of working top-to-bottom, when in fact it IS going
// in order and the queue is simply showing rows that were never candidates.
//
// The bug isn't in either filter. It's that there were two of them. This
// module is the one definition; both routes now import it, so the displayed
// queue and the dial order cannot drift apart again.
// =============================================================================

/**
 * Statuses a lead must be in to be dialable.
 *
 * 'uncalled'  — never attempted.
 * 'no_answer' — attempted, didn't connect, still has attempts left. Released
 *               back into rotation by the webhook handler
 *               (bumpLeadAttemptAndRelease) precisely so it can be redialed.
 */
export const DIALABLE_STATUSES = ['uncalled', 'no_answer'] as const

/**
 * Terminal statuses — a lead here is finished, permanently or by outcome, and
 * must never be dialed again.
 *
 * 'maxed' is the one that matters most in practice: it's what
 * bumpLeadAttemptAndRelease writes once a lead exhausts its dial_repeat_count,
 * and it is by far the largest undialable population in real data.
 */
export const TERMINAL_STATUSES = ['dnc', 'closed', 'appointment', 'maxed'] as const

/**
 * Dispositions that permanently retire a lead regardless of status.
 *
 * Per explicit product instruction: "I want all leads at all time unless
 * given a do not call or not interested, or closed disposition." That rule
 * governs the LEADS PAGE, which deliberately keeps showing everything else
 * (SKIPPED, NO_ANSWER, TCPA_BLOCKED...) so nothing disappears on an agent.
 * It is not the same question as "what can be dialed next", which is why
 * applying it alone to the dial queue produced the mismatch above.
 */
export const EXCLUDED_DIALABLE_DISPOSITIONS = new Set([
  'DO NOT CALL',
  'NOT INTERESTED',
  'CLOSED',
])

export interface DialabilityInput {
  status?: string | null
  disposition?: string | null
  phone?: string | null
}

/**
 * True when this lead is a legitimate candidate for the next dial.
 *
 * Deliberately does NOT consider the TCPA calling window. That check is
 * time-of-day dependent and lives in lib/callingWindow.ts (isCallableNow) —
 * a lead outside its window right now is still a real queue member that
 * becomes dialable later, so hiding it from the queue would misrepresent the
 * work remaining. Dialability here means "eligible at all", not "eligible
 * this second".
 */
export function isDialableLead(lead: DialabilityInput): boolean {
  const status = (lead.status || '').toLowerCase()
  if (!(DIALABLE_STATUSES as readonly string[]).includes(status)) return false

  const disposition = (lead.disposition || '').toUpperCase()
  if (disposition && EXCLUDED_DIALABLE_DISPOSITIONS.has(disposition)) return false

  // A lead with no phone number cannot be dialed by definition, and one that
  // reaches the dialer produces a confusing "Invalid phone number" failure
  // attributed to the dial rather than to the data.
  const phone = (lead.phone || '').trim()
  if (!phone) return false

  return true
}
