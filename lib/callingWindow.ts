import { getAreaCodeInfo, extractAreaCode, classifyAreaCode } from './areaCode'
import { STATE_TIMEZONES, getCallingRule } from './timezones'
import { normalizeState } from './normalizeState'
import { detectInternationalRegion, isCallableNowInternational } from './internationalCallingWindow'

// =============================================================================
// PER-LEAD CALLING WINDOW (TCPA / TSR)
// =============================================================================
// This file had been reduced to a stub that returned { allowed: true } for
// every lead, which disabled calling-window enforcement completely. Restored.
//
// Enforcement is per-LEAD, not per-agent: the legal window is measured in the
// timezone of the person being called, derived from their state (explicit
// column first, area code as fallback). An agent in California dialing a
// Maine lead at 6pm Pacific is calling them at 9pm Eastern — outside the
// window, regardless of what time it is for the agent.
// =============================================================================

/**
 * Why a lead cannot be dialed, as a stable value rather than prose.
 *
 * The reason string is written for a human and gets reworded; anything that
 * needs to GROUP or COUNT refusals has to key off something that does not
 * change when the copy does. Without this the dialer could only ever report
 * the first refusal it met, which is how "outside calling hours" ended up
 * being shown for a queue whose real problem was malformed phone numbers.
 */
export type CallabilityCode =
  | 'no_number'        // nothing to dial
  | 'invalid_number'   // wrong number of digits to be a US number
  | 'impossible_number' // right length, but not a number the NANP can route
  | 'unknown_area'     // well-formed, but the area code is not one we know
  | 'toll_free'        // 800/833/844/855/866/877/888 — not a person's line
  | 'non_geographic'   // 900 premium, N11 service, government, personal-comms
  | 'too_early'        // before the lead's local window opens
  | 'too_late'         // after it closes
  | 'sunday'           // state prohibits Sunday telemarketing
  | 'international'    // outside US rules — see internationalCallingWindow
  | 'other'

/**
 * Is this a number the North American Numbering Plan could never route?
 *
 * Distinct from "we don't recognise the area code", and the distinction
 * matters because the two need opposite advice. An unrecognised area code may
 * be a real number our lookup table has not caught up with — adding a state
 * fixes it. A number whose area code starts with 1, or whose exchange is 011,
 * is not a US phone number at all, and no amount of state data will make it
 * dialable; it will burn a call attempt and come back as an invalid-number
 * error from the carrier every single time.
 *
 * Deliberately lenient. It only rejects what the NANP itself forbids, so a
 * real number never trips it:
 *   - area code and exchange must start 2-9   (NANP assignment rule)
 *   - N11 area codes are service codes         (411, 611, 911, …)
 *
 * Everything else — including unusual, new, or non-geographic area codes —
 * passes. Being wrong in the strict direction would block real leads, which is
 * far worse than letting a bad number through to fail at the carrier.
 *
 * The reserved 555-0100..555-0199 fiction range is deliberately NOT rejected.
 * It is genuinely undialable, but the only lists that actually contain it are
 * sample files and test fixtures, while the cost of getting it wrong is a
 * blocked real lead. Not worth the rule.
 */
export function isImpossibleUsNumber(phone: string): boolean {
  const all = (phone || '').replace(/\D/g, '')
  const digits = all.length === 11 && all.startsWith('1') ? all.slice(1) : all
  if (digits.length !== 10) return false  // length is a different problem

  const npa = digits.slice(0, 3)   // area code
  const nxx = digits.slice(3, 6)   // exchange

  if (npa[0] === '0' || npa[0] === '1') return true
  if (npa[1] === '1' && npa[2] === '1') return true   // N11 service codes
  if (nxx[0] === '0' || nxx[0] === '1') return true

  return false
}

export interface CallabilityResult {
  allowed: boolean
  reason?: string
  /** Stable classification of `reason`, safe to group and count on. */
  code?: CallabilityCode
  retryAfter?: Date  // earliest time when this lead becomes callable again
  leadState?: string
  leadTimezone?: string
  leadLocalTime?: string
}

interface LeadInput {
  phone: string
  state?: string | null  // explicit state column from leads table (optional)
}

export interface CallabilityOptions {
  /**
   * Allow this call even when the lead is outside their local window.
   *
   * Resolved per request from an email allowlist — see
   * lib/callingWindowOverride.ts for why it works that way and what it is for.
   * It is a PARAMETER rather than something this module looks up on its own so
   * that enforcement remains the default: a bypass has to be passed in, by
   * name, at the call site.
   */
  overrideWindow?: boolean
}

// ── SANDBOX 24/7 TESTING BYPASS ────────────────────────────────────────────
// Sandbox needs to place test calls at any hour; admin testing doesn't happen
// on a lead's schedule.
//
// WHY THIS IS A HOSTNAME CHECK AND NOT AN ENV FLAG: an earlier version gated
// this behind SANDBOX_DISABLE_CALLING_WINDOW=true — a variable set by hand.
// Sandbox and production run the SAME codebase deployed to two Vercel
// projects, and env vars get copied between them. One copy-paste carries that
// flag into production and silently disables TCPA compliance for real
// subscribers. That is not hypothetical; it is the exact failure this guards.
//
// VERCEL_PROJECT_PRODUCTION_URL is injected by Vercel per project and is
// stable across deployments (unlike VERCEL_URL, a fresh per-deploy hash that
// could never match a fixed list). It cannot be copy-pasted between projects
// the way a manual flag can.
//
// Exact-match, not a pattern: anything not named here — including the real
// production domain — gets full enforcement by default, with no flag needed
// to stay safe.
const SANDBOX_HOSTNAMES = [
  'sandbox21.vercel.app',
  'sandbox-dialerseats-projects.vercel.app',
  'sandbox-dialerseat-dialerseats-projects.vercel.app',
]

function isSandboxDeployment(): boolean {
  const currentHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').toLowerCase()
  return SANDBOX_HOSTNAMES.some(h => currentHost === h.toLowerCase())
}

export function isCallableNow(lead: LeadInput, opts?: CallabilityOptions): CallabilityResult {
  const result = evaluateCallability(lead)
  if (result.allowed || !opts?.overrideWindow) return result

  // The override is applied AFTER the real evaluation rather than short-
  // circuiting it, for two reasons: the result still carries the lead's state,
  // timezone and local time (which the dialer displays and the logs need), and
  // the reason the lead would have been blocked survives into the log line
  // below. A short-circuit would throw both away.
  console.warn(
    `[callingWindow] OVERRIDE, dialing outside the window for a named account. ` +
    `Would have been blocked: ${result.reason ?? 'unknown reason'}`
  )
  return {
    ...result,
    allowed: true,
    reason: `Calling-window override active for this account (would otherwise be blocked: ${result.reason ?? 'unknown reason'})`,
  }
}

function evaluateCallability(lead: LeadInput): CallabilityResult {
  if (isSandboxDeployment()) {
    return {
      allowed: true,
      reason: 'Sandbox deployment: calling-window enforcement disabled for 24/7 testing',
    }
  }

  // ── INTERNATIONAL LEADS (UK / AU / FR / other) ──────────────────────────
  // Checked BEFORE US state detection: a UK/AU/FR number would otherwise fall
  // into extractAreaCode()/getAreaCodeInfo() (which only know US area codes)
  // and either misdetect a "state" from digits that were never a US area
  // code, or hit the unknown-state fallback — neither applies the right
  // country's rules. Detection is phone-prefix based, so ordinary US numbers
  // fall straight through unchanged.
  const intlRegion = detectInternationalRegion(lead.phone)
  if (intlRegion) {
    const intlResult = isCallableNowInternational(lead.phone, intlRegion)
    return {
      allowed: intlResult.allowed,
      code: 'international',
      reason: intlResult.reason,
      leadState: intlRegion === 'OTHER_INTL' ? undefined : intlRegion,
      leadLocalTime: intlResult.localTime,
    }
  }

  // Checked BEFORE the state lookup. A lead carrying state 'TX' and a phone of
  // 111-111-1111 would otherwise sail through to the window check and be
  // dialed, failing at the carrier on every pass — forever, since a failed
  // call leaves it in the queue to be tried again.
  if (isImpossibleUsNumber(lead.phone)) {
    const d = (lead.phone || '').replace(/\D/g, '')
    return {
      allowed: false,
      code: 'impossible_number',
      reason:
        `${lead.phone} is not a dialable US number, no carrier can route it ` +
        `(area code ${d.length === 11 ? d.slice(1, 4) : d.slice(0, 3)} / exchange ` +
        `${d.length === 11 ? d.slice(4, 7) : d.slice(3, 6)} is not a valid combination).`,
    }
  }

  let state = normalizeState(lead.state)

  // Explicit state column preferred; fall back to deriving it from the area
  // code when the column is missing or unrecognized.
  if (!state || !STATE_TIMEZONES[state]) {
    const areaCode = extractAreaCode(lead.phone)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null
    state = normalizeState(info?.state) || info?.state || null
  }

  // Fail CLOSED. If we cannot establish where the lead is, we cannot
  // establish that calling them is legal, and the safe answer is no.
  //
  // But SAY WHICH PROBLEM IT IS. Every one of these used to report "cannot
  // determine calling window", which reads as a time-of-day restriction — so
  // an agent with a malformed phone number was told to wait until morning for
  // a lead that would never become dialable. The three causes need three
  // different actions from the user, so they get three different messages.
  if (!state || !STATE_TIMEZONES[state]) {
    const digits = (lead.phone || '').replace(/\D/g, '')

    if (digits.length === 0) {
      return { allowed: false, code: 'no_number', reason: 'No phone number on this lead' }
    }

    // 10 digits, or 11 starting with a US country code.
    const isPlausibleUsNumber =
      digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))

    if (!isPlausibleUsNumber) {
      return {
        allowed: false,
        code: 'invalid_number',
        reason:
          `Invalid phone number, ${digits.length} digit${digits.length === 1 ? '' : 's'} ` +
          `(a US number needs 10)`,
      }
    }

    // ── NAME THE ACTUAL PROBLEM ──────────────────────────────────────────
    // These all used to collapse into one message: "unrecognised area code —
    // add a state to this lead to dial it." For a toll-free or premium number
    // that advice is simply false; no state makes an 800 number a person's
    // phone, and following it wastes the user's time on data entry that cannot
    // work. Each class gets the sentence that is true of it.
    const areaCodeStr = digits.length === 11 ? digits.slice(1, 4) : digits.slice(0, 3)
    const klass = classifyAreaCode(areaCodeStr)

    if (klass.kind === 'toll_free') {
      return {
        allowed: false,
        code: 'toll_free',
        reason:
          `${areaCodeStr} is a toll-free number, not a personal line, there is ` +
          `nobody at a fixed location to call, and no state will change that.`,
      }
    }

    if (klass.kind === 'non_geographic') {
      return {
        allowed: false,
        code: 'non_geographic',
        reason:
          `${areaCodeStr} is not a geographic area code (premium-rate, service ` +
          `or government), so it has no local time and cannot be dialed as a lead.`,
      }
    }

    if (klass.kind === 'canada' || klass.kind === 'other_nanp') {
      // Same numbering plan, different country. Says so plainly rather than
      // pretending a US state is missing.
      return {
        allowed: false,
        code: 'international',
        reason:
          klass.kind === 'canada'
            ? `${areaCodeStr} is a Canadian area code. Canadian calling rules are ` +
              `not enforced by this dialer, so it is held back rather than dialed blind.`
            : `${areaCodeStr} is outside the US and Canada. Its local rules are not ` +
              `enforced by this dialer, so it is held back rather than dialed blind.`,
      }
    }

    // A well-formed number whose area code we genuinely do not hold. It may be
    // a real number and the table may simply be behind — name the code so it
    // can be checked and added.
    return {
      allowed: false,
      code: 'unknown_area',
      reason:
        `Unrecognised area code ${areaCodeStr}: cannot confirm the lead's state, ` +
        `so the calling window cannot be checked. Add a state to this lead to dial it.`,
    }
  }

  const tz = STATE_TIMEZONES[state]
  const rule = getCallingRule(state)

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const partMap: Record<string, string> = {}
  for (const p of parts) partMap[p.type] = p.value

  const leadHour = parseInt(partMap.hour, 10)
  const leadMinute = parseInt(partMap.minute, 10)
  const leadWeekday = partMap.weekday  // "Sun", "Mon", ...
  const leadDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`
  const isSunday = leadWeekday === 'Sun'

  const leadLocalTime = `${partMap.hour}:${partMap.minute} ${leadWeekday} ${leadDateStr} (${tz})`

  // ── HOURS ONLY ───────────────────────────────────────────────────────────
  // No holiday calendar and no day-of-week rules: the single check is whether
  // the lead's LOCAL time is inside the window (9am-9pm, see
  // lib/timezones.ts). Sundays and federal holidays are dialable as far as
  // this system is concerned — deciding whether that is appropriate is left
  // to the operator.
  //
  // The rule object still carries optional Sunday fields so a stricter policy
  // can be reinstated by populating STATE_RULES, without changing this file.
  const startHour = isSunday ? (rule.sundayStartHour ?? rule.startHour) : rule.startHour
  const endHour = isSunday ? (rule.sundayEndHour ?? rule.endHour) : rule.endHour

  if (rule.noSundayCalls && isSunday) {
    return {
      allowed: false,
      code: 'sunday',
      reason: `${state} prohibits Sunday telemarketing calls`,
      retryAfter: atHourInTz(now, tz, rule.startHour, 1),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }

  if (leadHour < startHour) {
    return {
      allowed: false,
      code: 'too_early',
      reason: `Too early in ${state} (${leadHour}:${String(leadMinute).padStart(2, '0')} local, window starts ${startHour}:00)`,
      retryAfter: atHourInTz(now, tz, startHour, 0),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }
  if (leadHour >= endHour) {
    return {
      allowed: false,
      code: 'too_late',
      reason: `Too late in ${state} (${leadHour}:${String(leadMinute).padStart(2, '0')} local, window ends ${endHour}:00)`,
      retryAfter: atHourInTz(now, tz, startHour, 1),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }

  return {
    allowed: true,
    leadState: state,
    leadTimezone: tz,
    leadLocalTime,
  }
}

/**
 * The instant corresponding to `hour:00` in `tz`, `dayOffset` days from the
 * lead's current local date.
 *
 * BUG THIS FIXES: the previous helpers built a Date from the lead's timezone
 * offset and then called `setDate()` / `setHours()` on it. Those setters
 * operate in the RUNTIME's local timezone — UTC on Vercel — not the lead's.
 * So "tomorrow at 8am Eastern" came out as 8am UTC, i.e. 4am Eastern: a
 * retryAfter several hours BEFORE the window actually opens. Anything
 * scheduling a retry from that value would call while the lead was still
 * inside the prohibited period — the exact thing this module exists to stop.
 *
 * Day arithmetic is done with Date.UTC purely as a calendar calculation, so
 * no local-timezone setter is ever involved; the timezone is applied once,
 * explicitly, via the offset suffix.
 */
function atHourInTz(base: Date, tz: string, hour: number, dayOffset: number): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base) // YYYY-MM-DD in the lead's timezone

  const [y, m, d] = ymd.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + dayOffset))
  const pad = (n: number) => String(n).padStart(2, '0')
  const targetDate =
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`

  return new Date(`${targetDate}T${pad(hour)}:00:00${tzOffsetSuffix(tz, base)}`)
}

/**
 * The lead timezone's UTC offset as a "+HH:MM" suffix at a given instant.
 * Uses the offset in effect now; across a DST boundary the resulting
 * retryAfter can be an hour off, which is acceptable for a "try again after"
 * hint.
 */
function tzOffsetSuffix(tz: string, when: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(when)
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0'
  const match = tzPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 'Z'
  const sign = match[1] || '+'
  const h = match[2].padStart(2, '0')
  const m = match[3] || '00'
  return `${sign}${h}:${m}`
}
