import { getAreaCodeInfo, extractAreaCode } from './areaCode'
import { STATE_TIMEZONES, getCallingRule, getFederalHolidays } from './timezones'
import { normalizeState } from './normalizeState'

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

/**
 * The TCPA gate: given a lead, is it legal/safe to call them RIGHT NOW
 * based on their local time?
 *
 * Resolution order for time zone:
 *   1. Lead's `state` column if present and recognized
 *   2. Otherwise infer state from area code via lib/areaCode.ts
 *   3. If neither resolves, fall back to user-friendly error (don't call)
 *
 * Window logic:
 *   1. Get state-specific rule (default federal 8am-9pm)
 *   2. Convert current UTC -> lead's local time
 *   3. If federal holiday -> block
 *   4. If Sunday and state bans Sunday calls -> block
 *   5. If hour < startHour or hour >= endHour -> block
 *   6. Otherwise -> allow
 *
 * `retryAfter` tells the caller WHEN it becomes callable, so leads/next can
 * re-queue them for the next callable window instead of skipping forever.
 */
export function isCallableNow(lead: LeadInput): CallabilityResult {
  // Step 1: resolve the lead's state.
  // Accept any reasonable representation from the lead sheet — full names
  // ("North Carolina"), abbreviations ("nc", "N.C."), mixed case, etc. — not
  // just exact 2-letter codes. A real, callable lead must not be blocked just
  // because the sheet spelled the state out.
  let state = normalizeState(lead.state)

  // If the state column was missing or unrecognized, infer from the phone's
  // area code as a fallback.
  if (!state || !STATE_TIMEZONES[state]) {
    const areaCode = extractAreaCode(lead.phone)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null
    // areaCode table already returns 2-letter codes, but normalize defensively.
    state = normalizeState(info?.state) || info?.state || null
  }

  if (!state || !STATE_TIMEZONES[state]) {
    // Genuinely can't determine the lead's time zone from either the state
    // field or the area code. Fail closed (don't call) — but this is now only
    // reached for truly unresolvable input, not for valid full-name states.
    return {
      allowed: false,
      reason: 'Unknown state — cannot determine calling window',
    }
  }

  const tz = STATE_TIMEZONES[state]
  const rule = getCallingRule(state)

  // Step 2: get current time IN THE LEAD'S TIMEZONE
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

  // Step 3: federal holiday check
  const holidays = getFederalHolidays(parseInt(partMap.year, 10))
  if (holidays.has(leadDateStr)) {
    return {
      allowed: false,
      reason: `Federal holiday in ${state}`,
      retryAfter: tomorrowAtHour(now, tz, rule.startHour),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }

  // Step 4: state Sunday ban
  if (isSunday && rule.noSundayCalls) {
    return {
      allowed: false,
      reason: `${state} prohibits Sunday telemarketing calls`,
      retryAfter: tomorrowAtHour(now, tz, rule.startHour),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }

  // Step 5: window check
  const startHour = isSunday ? (rule.sundayStartHour ?? rule.startHour) : rule.startHour
  const endHour = isSunday ? (rule.sundayEndHour ?? rule.endHour) : rule.endHour

  // Hour is in [startHour, endHour). At endHour:00 onwards, blocked.
  if (leadHour < startHour) {
    return {
      allowed: false,
      reason: `Too early in ${state} (${leadHour}:${String(leadMinute).padStart(2, '0')} local, window starts ${startHour}:00)`,
      retryAfter: todayAtHour(now, tz, startHour),
      leadState: state,
      leadTimezone: tz,
      leadLocalTime,
    }
  }
  if (leadHour >= endHour) {
    return {
      allowed: false,
      reason: `Too late in ${state} (${leadHour}:${String(leadMinute).padStart(2, '0')} local, window ends ${endHour}:00)`,
      retryAfter: tomorrowAtHour(now, tz, startHour),
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
 * Returns a UTC Date representing "today at HH:00 in tz".
 * If the time has already passed today in tz, returns tomorrow at HH:00.
 */
function todayAtHour(_now: Date, tz: string, hour: number): Date {
  // Build date string for today in tz, then parse back to UTC
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayStr = formatter.format(_now)  // YYYY-MM-DD in lead's tz
  const candidate = new Date(`${todayStr}T${String(hour).padStart(2, '0')}:00:00${tzOffsetSuffix(tz, _now)}`)
  if (candidate.getTime() > _now.getTime()) return candidate
  // Already passed today — return tomorrow
  return tomorrowAtHour(_now, tz, hour)
}

function tomorrowAtHour(_now: Date, tz: string, hour: number): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayStr = formatter.format(_now)
  const tomorrow = new Date(`${todayStr}T00:00:00${tzOffsetSuffix(tz, _now)}`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour)
  return tomorrow
}

/**
 * Get the UTC offset suffix for a tz at a given moment, e.g. "-05:00" for EST.
 * Used to construct timezone-aware ISO date strings.
 */
function tzOffsetSuffix(tz: string, when: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(when)
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0'
  // Format like "GMT-5" or "GMT-5:00" — normalize to "+/-HH:00"
  const match = tzPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 'Z'
  const sign = match[1] || '+'
  const h = match[2].padStart(2, '0')
  const m = match[3] || '00'
  return `${sign}${h}:${m}`
}