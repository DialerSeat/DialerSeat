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


export function isCallableNow(lead: LeadInput): CallabilityResult {
  
  
  
  
  
  let state = normalizeState(lead.state)

  
  
  if (!state || !STATE_TIMEZONES[state]) {
    const areaCode = extractAreaCode(lead.phone)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null
    
    state = normalizeState(info?.state) || info?.state || null
  }

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

  
  const startHour = isSunday ? (rule.sundayStartHour ?? rule.startHour) : rule.startHour
  const endHour = isSunday ? (rule.sundayEndHour ?? rule.endHour) : rule.endHour

  
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


function todayAtHour(_now: Date, tz: string, hour: number): Date {
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayStr = formatter.format(_now)  // YYYY-MM-DD in lead's tz
  const candidate = new Date(`${todayStr}T${String(hour).padStart(2, '0')}:00:00${tzOffsetSuffix(tz, _now)}`)
  if (candidate.getTime() > _now.getTime()) return candidate
  
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