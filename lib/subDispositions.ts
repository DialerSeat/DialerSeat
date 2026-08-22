// ─────────────────────────────────────────────────────────────────────────
// THE DISPOSITION STRINGS THE SUB-CAMPAIGNS FILTER ON
//
// A campaign can expose two virtual sub-queues — Call Backs and Not
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

export type SubType = 'appointments' | 'not_interested' | 'voicemail'

/** Every disposition value that belongs in each sub-queue. Order irrelevant. */
export const SUB_DISPOSITION_FORMS: Record<SubType, string[]> = {
  appointments: ['APPOINTMENT', 'APPOINTMENT_SET'],
  not_interested: ['NOT INTERESTED', 'NOT_INTERESTED'],
  voicemail: ['VOICEMAIL', 'NO_ANSWER_AMD'],
}

// ── WHICH COLUMN EACH SUB READS ──────────────────────────────────────────
// The first two ask what an AGENT decided about the lead, which lives on
// leads.disposition. Voicemail asks how the lead's LAST CALL ended, which
// does not — a voicemail is deliberately never written to leads.disposition,
// because doing so would imply somebody had judged the lead and would drag it
// out of rotation. It lives on leads.last_call_disposition instead.
//
// So the column travels with the sub type. Assuming they all read the same
// one is exactly the assumption that would make this queue silently empty.
export const SUB_COLUMN: Record<SubType, 'disposition' | 'last_call_disposition'> = {
  appointments: 'disposition',
  not_interested: 'disposition',
  voicemail: 'last_call_disposition',
}

/** The canonical value — what the dialer writes today. Use this for labels and
 *  for anything that needs ONE string; use SUB_DISPOSITION_FORMS to match. */
export const SUB_DISPOSITION_CANONICAL: Record<SubType, string> = {
  appointments: 'APPOINTMENT',
  not_interested: 'NOT INTERESTED',
  voicemail: 'VOICEMAIL',
}

export const SUB_LABELS: Record<SubType, string> = {
  // 'appointments' is the stored sub_type and the column name; 'Call Backs'
  // is what it is called. Same split as the disposition itself.
  appointments: 'Call Backs',
  not_interested: 'Not Interested',
  voicemail: 'Reached Voicemail',
}

export function isSubType(v: string | null | undefined): v is SubType {
  return v === 'appointments' || v === 'not_interested' || v === 'voicemail'
}
