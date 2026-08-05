import { getAreaCodeInfo, extractAreaCode } from './areaCode'
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

export interface CallabilityResult {
  allowed: boolean
  reason?: string
  retryAfter?: Date  // earliest time when this lead becomes callable again
  leadState?: string
  leadTimezone?: string
  leadLocalTime?: string
}

interface LeadInput {
  phone: string
  state?: string | null  // explicit state column from leads table (optional)
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

export function isCallableNow(lead: LeadInput): CallabilityResult {
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
      reason: intlResult.reason,
      leadState: intlRegion === 'OTHER_INTL' ? undefined : intlRegion,
      leadLocalTime: intlResult.localTime,
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
  if (!state || !STATE_TIMEZONES[state]) {
    return {
      allowed: false,
      reason: 'Unknown state — cannot determine calling window',
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
