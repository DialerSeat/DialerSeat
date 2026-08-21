// ─────────────────────────────────────────────────────────────────────────
// THE DISPOSITION STRINGS THE SUB-CAMPAIGNS FILTER ON
//
// A campaign can expose two virtual sub-queues — Appointments and Not
// Interested — which are just the parent's leads filtered by disposition.
//
// Both were declared as 'APPOINTMENT' and 'NOT_INTERESTED', in two separate
// files, each carrying a comment warning that the two must be kept in step.
// They were: identical to each other, and both wrong. The dialer writes
// 'NOT INTERESTED' with a SPACE, so the Not Interested sub-queue matched
// nothing and had shown an empty list and a count of zero for its entire
// existence — with no error, because an empty result is not a failure.
//
// A shared constant, rather than a third comment asking people to remember.
// The previous arrangement proves the comment does not work: it was followed
// exactly and the bug survived, because keeping two wrong values in sync is
// still wrong.
//
// Several spellings are accepted per queue. The stored values use spaces, but
// underscored forms appear in older rows and in code elsewhere, and a lead the
// agent filed under Not Interested belongs in that queue regardless of which
// path wrote it.
// ─────────────────────────────────────────────────────────────────────────

export type SubType = 'appointments' | 'not_interested'

/** Every disposition value that belongs in each sub-queue. Order irrelevant. */
export const SUB_DISPOSITION_FORMS: Record<SubType, string[]> = {
  appointments: ['APPOINTMENT', 'APPOINTMENT_SET'],
  not_interested: ['NOT INTERESTED', 'NOT_INTERESTED'],
}

/** The canonical value — what the dialer writes today. Use this for labels and
 *  for anything that needs ONE string; use SUB_DISPOSITION_FORMS to match. */
export const SUB_DISPOSITION_CANONICAL: Record<SubType, string> = {
  appointments: 'APPOINTMENT',
  not_interested: 'NOT INTERESTED',
}

export const SUB_LABELS: Record<SubType, string> = {
  appointments: 'Appointments',
  not_interested: 'Not Interested',
}

export function isSubType(v: string | null | undefined): v is SubType {
  return v === 'appointments' || v === 'not_interested'
}
