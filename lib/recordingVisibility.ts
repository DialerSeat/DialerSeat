// ─────────────────────────────────────────────────────────────────────────
// HIDDEN IS NOT DELETED, AND THE DIFFERENCE COSTS MONEY
// ─────────────────────────────────────────────────────────────────────────
// Clearing a recording out of the app and deleting it at the carrier are two
// different acts, and conflating them is how audio ends up billed forever.
//
//   'deleted' — gone at Telnyx. Nothing left to pay for, nothing to play.
//   HIDDEN    — still at Telnyx, still stored, still billed. Taken off the
//               screens because nobody wants to scroll past 84 voicemail
//               fragments, not because anybody decided to destroy it.
//
// WHY NOT JUST NULL THE COLUMNS. Because recording_id is the ONLY pointer back
// to the audio. Null it and the recording keeps costing money on an account
// where nothing can ever find it again — the worst of both outcomes. Hiding
// keeps the id, so a real delete is still one click away in LiveOps whenever
// somebody decides to make it permanent.
// ─────────────────────────────────────────────────────────────────────────

/** Taken off the screens; audio still exists at the carrier. */
export const RECORDING_HIDDEN = 'hidden'

/**
 * PostgREST filter for "this call has audio a person should see".
 *
 * Written as an `.or()` rather than `.neq()` on purpose: SQL comparisons
 * against NULL are neither true nor false, so `status <> 'hidden'` drops every
 * row whose status was never set — which is most of them, and would empty the
 * feed rather than filter it.
 */
export const VISIBLE_RECORDING_FILTER =
  `recording_status.is.null,recording_status.neq.${RECORDING_HIDDEN}`

/** The same rule for rows already in memory. */
export function isVisibleRecording(c: {
  recording_id?: string | null
  recording_url?: string | null
  recording_status?: string | null
}): boolean {
  if (!c.recording_id && !c.recording_url) return false
  return c.recording_status !== RECORDING_HIDDEN
}
