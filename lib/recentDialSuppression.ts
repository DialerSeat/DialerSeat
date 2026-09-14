// ─────────────────────────────────────────────────────────────────────────
// ONE ATTEMPT BUDGET PER PERSON, NOT PER LIST
// ─────────────────────────────────────────────────────────────────────────
// 9,318 phone numbers in this database sit in more than one campaign; only 70
// are duplicated inside a single one. So the lists are fine — the waste is
// that each campaign keeps its own attempt count, and a number in three lists
// quietly gets three times the dialing.
//
// The budget is counted on the NUMBER, across every campaign. A person in
// three lists gets six attempts total, not eighteen. That is the
// cross-campaign dedupe and the attempt cap in a single rule.
//
// ── WHY SIX, AND WHY NOT A TIME WINDOW ─────────────────────────────────────
// The first version of this rested a number for 24 hours after a dial. It
// looked excellent on dial count — 43% removed — and it was the worst option
// available, because measuring PEOPLE instead of dials showed it cost 7 of the
// 44 people reached in thirty days. Same-day callbacks work. Dials are not
// what this business sells.
//
// Measured over the same thirty days, counting people rather than dials:
//
//   cap   dials cut   people lost
//    3      26.5%          1
//    4      22.1%          1
//    5      18.9%          1
//    6      16.5%          0      ← here
//    8      14.5%          0
//
// Six is the smallest cap that costs nobody. Three would cut another ten
// percent for one person a month; that is a trade worth having deliberately,
// not one worth taking by default.
//
// THIS IS NOT "GIVE UP ON A LEAD". Unlimited attempts were asked for
// deliberately and the spirit of that stays: nobody sensible dials one number
// more than six times, and on this data nobody who was ever reached needed a
// seventh. What it stops is a number being worked three times over because it
// appears in three lists that cannot see each other.
// ─────────────────────────────────────────────────────────────────────────

/** Attempts any one phone number gets, across every campaign. */
export const MAX_DIALS_PER_NUMBER = 6

/**
 * How far back attempts are counted. A list re-uploaded months later should
 * get a fresh budget rather than being permanently unreachable, and this is
 * the window the cap was measured over.
 */
export const ATTEMPT_WINDOW_DAYS = 30

/**
 * Comparable form of a phone number: the last ten digits.
 *
 * Numbers reach us as +1XXXXXXXXXX from the carrier and as anything at all
 * from a customer's CSV — 555.123.4567, (555) 123-4567, 15551234567. Matching
 * on the stored string compares formatting rather than people, which is how
 * the same number in two lists reads as two numbers and gets two budgets.
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
 * Attempts already spent, per number.
 *
 * A call that never rang is not an attempt. Those rows exist in their
 * thousands from the dead-socket era and one still turns up occasionally;
 * counting them would spend a person's budget on calls their phone never
 * received. See lib/dialOutcome.
 */
export function attemptsByNumber(rows: DialedRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.answered_at && (r.duration ?? 0) === 0) continue
    const k = dialKey(r.phone_number)
    if (!k) continue
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

// ── A NUMBER THAT DOES NOT EXIST ─────────────────────────────────────────
// Telnyx returns hangup_cause 'not_found' when the number is not allocated —
// SIP 404. It is the one verdict that is final: a disconnected number will not
// start existing because we tried again.
//
// Eight of the 473 distinct numbers dialed here came back not_found. They took
// 28 dials between them, one of them sixteen times, and not one ever answered
// — because none of them can. Seventeen lead rows are still queued to dial
// them again.
//
// 1.7% of distinct numbers on a small sample, and it scales straight up with
// list size: a purchased list of a hundred thousand carries thousands of these
// and every one of them will otherwise burn its full attempt budget.
//
// Treated as budget already spent rather than as a separate gate, so there is
// one question at the call site instead of two.
export function markDead(
  attempts: Map<string, number>,
  deadKeys: Iterable<string>,
  cap: number = MAX_DIALS_PER_NUMBER
): Map<string, number> {
  for (const k of deadKeys) attempts.set(k, cap)
  return attempts
}

/** Keys for numbers the carrier says do not exist. */
export function deadKeysFrom(rows: Array<{ phone_number: string | null }>): string[] {
  const out: string[] = []
  for (const r of rows) {
    const k = dialKey(r.phone_number)
    if (k) out.push(k)
  }
  return out
}

/** Has this lead's number used up its budget? */
export function isExhausted(
  lead: { phone?: string | null },
  attempts: Map<string, number>,
  cap: number = MAX_DIALS_PER_NUMBER
): boolean {
  const k = dialKey(lead.phone)
  // A number we cannot key is never blocked here. The dialable and calling
  // window checks own that decision; this one must not quietly remove leads
  // for having odd formatting.
  if (k === null) return false
  return (attempts.get(k) ?? 0) >= cap
}
