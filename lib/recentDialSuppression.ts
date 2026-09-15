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
  disposition?: string | null
  hangup_cause?: string | null
}

/**
 * Did OUR plumbing kill this dial, rather than the person we called?
 *
 * Such a dial never reached the prospect's phone, so spending one of their six
 * attempts on it is charging them for a call they never received. On 14 Sept
 * one agent's SIP registration went stale and the dialer placed 86 calls in
 * eight minutes, 40 of which died at ~1.1 seconds. Every one of those spent an
 * attempt.
 *
 * TWO SIGNATURES, BECAUSE THE WEBHOOK EMITS TWO LABELS FOR ONE FAULT.
 * AGENT_LEG_FAILED is only written when the agent leg's own hangup event has
 * already been recorded and reports 'callee'. That event usually arrives
 * first, and under rapid dialing it does not — so half of that agent's
 * failures landed as NO_ANSWER with no hangup cause at all. The absent cause
 * is the giveaway: a lead leg that never established has nothing to report,
 * while a real rejection carries user_busy and a real ring-out carries
 * timeout.
 *
 * DELIBERATELY GENEROUS. Getting this wrong in one direction dials somebody a
 * seventh time; getting it wrong in the other silently retires a lead who was
 * never actually called. Those are not equivalent mistakes.
 */
function killedByOurPlumbing(r: DialedRow): boolean {
  if (r.disposition === 'AGENT_LEG_FAILED') return true
  return !r.answered_at
    && (r.duration ?? 0) > 0
    && (r.duration ?? 0) <= 2
    && !r.hangup_cause
}

/**
 * Attempts already spent, per number.
 *
 * A call that never rang is not an attempt. Two kinds do not count:
 *
 *   duration 0 — the dead-socket era, thousands of rows, and one still turns
 *   up occasionally. See lib/dialOutcome.
 *
 *   killed by our own plumbing — a stale SIP registration tearing the lead leg
 *   down at ~1 second, before the prospect's phone rang. This clause was
 *   missing and cost 39 leads an attempt each in three minutes on 14 Sept:
 *   the exclusion tested for duration exactly 0, and that signature is 1.1
 *   seconds.
 */
export function attemptsByNumber(rows: DialedRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.answered_at && (r.duration ?? 0) === 0) continue
    if (killedByOurPlumbing(r)) continue
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

// ── A NUMBER THAT ONLY EVER ANSWERS AS A MACHINE ─────────────────────────
// Every answered call bills a 60-second minimum on BOTH halves plus AMD,
// whether a person picks up or an answerphone does. 54% of everything that
// answers here is a machine, so roughly a quarter of all carrier spend buys
// voicemail greetings. The floor fires at the instant of answer and nothing
// afterwards reduces it — not the AMD verdict at 3.3 seconds, not the
// compliance hold dropping the call at 9. The only prevention is not dialing
// the number again.
//
// WHAT THE EARLY DATA SAYS, AND WHY THE THRESHOLD IS NOT HARDCODED. Measured
// to 15 Sept, the chance the next answered dial is also a machine ran 65.9%
// after one, 70.7% after two, 70.4% after three — it plateaus rather than
// climbing toward certainty. Those samples are 205, 82 and 54, which puts a
// band of roughly ±12% on the last one, from well under a day of real dialing.
// That is enough to justify the mechanism and nowhere near enough to fix its
// threshold, so the limit lives in platform_config and is tuned from volume.
//
// COUNTED FROM THE MOST RECENT ANSWERED DIAL BACKWARDS, and broken by any
// answered dial that reached a person. A number that reached a human three
// months ago and machines since is still a number that reaches machines; one
// that reached machines and then a human has proved it can.
//
// Unanswered dials are invisible here. They are not evidence either way — the
// phone simply rang out — and letting them break a streak would mean a number
// that alternates ring-out and voicemail never accumulates one.

/** A dial the streak logic can read. Ordered newest-first by the caller. */
export interface AnsweredOutcomeRow {
  phone_number: string | null
  created_at?: string | null
  answered_at?: string | null
  amd_result?: string | null
  disposition?: string | null
}

/** Did this dial reach an answerphone rather than a person? */
function reachedMachine(r: AnsweredOutcomeRow): boolean {
  return r.amd_result === 'machine' || r.disposition === 'VOICEMAIL'
}

/**
 * Numbers whose most recent `limit` answered dials were ALL machines.
 *
 * Rows may arrive in any order; they are sorted here rather than trusting the
 * caller, because a streak read backwards is not a streak.
 *
 * A limit of 0 or less disables the rule and returns nothing — the switch has
 * to be expressible, and it is the first thing to reach for if this ever
 * starts retiring numbers that were converting.
 */
export function voicemailStreakKeys(
  rows: AnsweredOutcomeRow[],
  limit: number
): string[] {
  if (!Number.isFinite(limit) || limit <= 0) return []

  // Answered dials only, newest first, grouped by number.
  const byKey = new Map<string, AnsweredOutcomeRow[]>()
  for (const r of rows) {
    if (!r.answered_at) continue
    const k = dialKey(r.phone_number)
    if (!k) continue
    const list = byKey.get(k)
    if (list) list.push(r)
    else byKey.set(k, [r])
  }

  const out: string[] = []
  for (const [k, list] of byKey) {
    if (list.length < limit) continue
    list.sort((a, b) =>
      Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))

    let streak = 0
    for (const r of list) {
      if (!reachedMachine(r)) break
      streak++
      if (streak >= limit) break
    }
    if (streak >= limit) out.push(k)
  }
  return out
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
