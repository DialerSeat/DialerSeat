// ─────────────────────────────────────────────────────────────────────────
// DON'T PAY TO CALL THE SAME PERSON TWICE IN ONE DAY
// ─────────────────────────────────────────────────────────────────────────
// 9,318 phone numbers in this database exist in more than one campaign, and
// only 70 are duplicated inside a single one. So the lists themselves are
// fine — the waste is that dialing list A and then list B reaches the same
// person again, and neither campaign knows the other just called them.
//
// Measured over thirty days: 888 real dials went to 473 distinct numbers.
// 46.7% of every dial was a repeat. One number was dialed 112 times.
//
// THIS IS NOT AN ATTEMPT CAP. A lead can still be dialed as many times as
// anybody wants — that was asked for deliberately and it stays. This only
// stops the SAME NUMBER being dialed twice inside a short window because it
// happened to be sitting in two lists at once, which nobody asked for and
// nobody can see happening.
//
// WHY A TIME WINDOW AND NOT A COUNT. A count punishes a number for being
// popular over months; a window only ever suppresses a call somebody made
// hours ago. Follow-up next week is untouched. That is the difference
// between a rule that cuts cost and a rule that cuts conversations.
//
// IT IS ALSO THE COMPLIANCE ANSWER. 112 calls to one number, reachable
// through three campaigns simultaneously, is the shape of a TCPA complaint.
// The cheapest dial and the safest dial are the same dial here.
// ─────────────────────────────────────────────────────────────────────────

/** Hours a number is rested after a real dial. */
export const SUPPRESSION_WINDOW_HOURS = 24

/**
 * Comparable form of a phone number: the last ten digits.
 *
 * Numbers reach us as +1XXXXXXXXXX from the carrier and as anything at all
 * from a customer's CSV — 555.123.4567, (555) 123-4567, 15551234567. Matching
 * on the stored string compares formatting rather than people, which is how
 * the same number in two lists reads as two numbers.
 */
export function dialKey(phone: string | null | undefined): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return null
  return d.slice(-10)
}

export interface DialedRow {
  phone_number: string | null
  answered_at?: string | null
  duration?: number | null
}

/**
 * The set of numbers already dialed inside the window.
 *
 * A call that never rang is not a call. Those rows exist in their thousands
 * from the dead-socket era and one still turns up occasionally; counting them
 * here would rest a number nobody ever actually reached. See lib/dialOutcome.
 */
export function suppressedKeys(rows: DialedRow[]): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (!r.answered_at && (r.duration ?? 0) === 0) continue
    const k = dialKey(r.phone_number)
    if (k) out.add(k)
  }
  return out
}

/** Was this lead's number dialed inside the window? */
export function isSuppressed(
  lead: { phone?: string | null },
  suppressed: Set<string>
): boolean {
  const k = dialKey(lead.phone)
  return k !== null && suppressed.has(k)
}
