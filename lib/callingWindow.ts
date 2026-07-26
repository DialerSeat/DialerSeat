import { getAreaCodeInfo, extractAreaCode } from './areaCode'
import { STATE_TIMEZONES, getCallingRule } from './timezones'
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

  // ── SANDBOX OVERRIDE: 24/7 TESTING ──────────────────────────────────────
  // Per build instruction: the sandbox needs to place test calls at any
  // hour, not just within each state's TCPA/TSR calling window, since
  // admin testing doesn't happen on a lead's schedule.
  //
  // WHY THIS CHECKS THE HOSTNAME, NOT A MANUAL ENV VAR: the original
  // version gated this behind SANDBOX_DISABLE_CALLING_WINDOW=true, a
  // variable someone sets by hand. That's fragile now that sandbox and
  // production run from the SAME codebase pushed to two different Vercel
  // projects — env vars get copied between them (exactly what happened
  // during this migration), and a copy-paste mistake could carry
  // SANDBOX_DISABLE_CALLING_WINDOW=true into production, silently
  // disabling real TCPA/TSR compliance for actual subscribers. That's not
  // a hypothetical; it's the literal failure mode being guarded against
  // here.
  //
  // Instead, this checks VERCEL_URL — a value Vercel itself injects
  // automatically per-deployment, reflecting the REAL domain the code is
  // actually running on right now. It cannot be copy-pasted between
  // projects the way a manual env var can; it's generated fresh by
  // Vercel's own infrastructure for every single deployment. The bypass
  // only activates when that hostname matches the sandbox's own known
  // domain(s) — listed explicitly below, not a wildcard/pattern match, so
  // there's no ambiguity about what counts as "sandbox."
  //
  // Add every real sandbox domain/alias here (the ones from `vercel
  // inspect`, or your primary sandbox domain) — anything NOT in this list
  // gets full, real TCPA enforcement, including the actual production
  // domain, by default, with no separate flag required to keep it safe.
  // WHY THIS CHECKS VERCEL_PROJECT_PRODUCTION_URL, NOT VERCEL_URL: VERCEL_URL
  // is the per-deployment generated hash URL (e.g.
  // sandbox-r71dg6k9n-dialerseats-projects.vercel.app) — it's DIFFERENT on
  // every single deployment, so a fixed hostname list could never reliably
  // match it. VERCEL_PROJECT_PRODUCTION_URL is the stable project-level
  // domain Vercel exposes instead (confirmed via Vercel's own system env
  // var docs) — the same value across every deployment of a given
  // project, which is what makes a fixed comparison list actually work.
  const SANDBOX_HOSTNAMES = [
    'sandbox21.vercel.app',
    'sandbox-dialerseats-projects.vercel.app',
    'sandbox-dialerseat-dialerseats-projects.vercel.app',
  ]
  const currentHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').toLowerCase()
  const isSandboxDeployment = SANDBOX_HOSTNAMES.some(h => currentHost === h.toLowerCase())

  if (isSandboxDeployment) {
    return {
      allowed: true,
      reason: 'Sandbox deployment: calling-window enforcement disabled for 24/7 testing',
    }
  }

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

  // Holiday blocking removed by request — calls are no longer refused for
  // Independence Day, Thanksgiving, etc. The 8am-9pm (or state-specific)
  // hour window and Sunday rules below still apply.

  
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