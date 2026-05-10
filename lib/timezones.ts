// Time-zone-aware TCPA calling-window enforcement.
// Source of truth for: state -> IANA tz, state-specific rules, federal holidays.

// Each US state to its primary IANA time zone identifier.
// Some states span multiple zones (TX, FL, KS, NE, ND, SD, OR, ID, KY, IN, MI, AK).
// We use the most populous zone for these — there's no perfect answer without
// city/zip data. The 8am-9pm window means a 1-hour misclassification only
// matters near 7am or 10pm local, which is already conservative territory.
export const STATE_TIMEZONES: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',     // Most of AZ doesn't observe DST
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  DC: 'America/New_York',
  FL: 'America/New_York',    // Panhandle is Central — minority
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York',    // Western KY is Central
  LA: 'America/Chicago',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  MT: 'America/Denver',
  NE: 'America/Chicago',
  NV: 'America/Los_Angeles',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NY: 'America/New_York',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',     // East TN is Eastern
  TX: 'America/Chicago',     // El Paso is Mountain
  UT: 'America/Denver',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WA: 'America/Los_Angeles',
  WV: 'America/New_York',
  WI: 'America/Chicago',
  WY: 'America/Denver',
}

// State-specific calling rules. Stricter than federal TCPA where applicable.
// Federal default: 8am-9pm local. Some states are tighter, especially on Sundays.
// Sources: state attorney general consumer-protection rules and state-specific
// telemarketing statutes. Conservative interpretation throughout.
//
// Format: { startHour, endHour, sundayStartHour, sundayEndHour } in 24h local time.
//   startHour 8 = 8:00am earliest call
//   endHour 21 = before 9:00pm last call (call must be initiated <21:00)
// Sunday fields override Sunday-only. If undefined, weekday rule applies on Sunday too.
export interface CallingRule {
  startHour: number
  endHour: number
  sundayStartHour?: number
  sundayEndHour?: number
  // Some states ban Sunday calls entirely
  noSundayCalls?: boolean
}

// Federal TCPA baseline
const FEDERAL: CallingRule = { startHour: 8, endHour: 21 }

// State-specific overrides — only states with rules tighter than federal.
// Most states defer to federal 8am-9pm. We only diverge where a state explicitly
// went tighter.
export const STATE_RULES: Record<string, CallingRule> = {
  // Florida — 8am-8pm any day, no Sunday calls for some commercial speech
  FL: { startHour: 8, endHour: 20 },
  // Louisiana — 8am-9pm, no Sunday calls
  LA: { startHour: 8, endHour: 21, noSundayCalls: true },
  // Alabama — 8am-8pm
  AL: { startHour: 8, endHour: 20 },
  // Mississippi — 8am-8pm
  MS: { startHour: 8, endHour: 20 },
  // Louisiana already covered above
  // All other states: use FEDERAL
}

export function getCallingRule(state: string): CallingRule {
  return STATE_RULES[state] || FEDERAL
}

// US federal holidays (and a few we treat as holidays for telemarketing safety).
// Returns YYYY-MM-DD strings. Computed on demand for current and next year.
export function getFederalHolidays(year: number): Set<string> {
  const dates = new Set<string>()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  // Fixed-date holidays
  dates.add(`${year}-01-01`) // New Year's Day
  dates.add(`${year}-07-04`) // Independence Day
  dates.add(`${year}-11-11`) // Veterans Day
  dates.add(`${year}-12-25`) // Christmas

  // Floating holidays
  dates.add(fmt(nthWeekday(year, 0, 1, 3))) // MLK Day — 3rd Monday in January
  dates.add(fmt(nthWeekday(year, 1, 1, 3))) // Presidents Day — 3rd Monday in February
  dates.add(fmt(lastWeekday(year, 4, 1)))   // Memorial Day — last Monday in May
  dates.add(fmt(nthWeekday(year, 8, 1, 1))) // Labor Day — 1st Monday in September
  dates.add(fmt(nthWeekday(year, 9, 1, 2))) // Columbus Day — 2nd Monday in October
  dates.add(fmt(nthWeekday(year, 10, 4, 4))) // Thanksgiving — 4th Thursday in November

  // Day after Thanksgiving — many states treat this as quasi-holiday
  const thanksgiving = nthWeekday(year, 10, 4, 4)
  const dayAfter = new Date(thanksgiving)
  dayAfter.setDate(dayAfter.getDate() + 1)
  dates.add(fmt(dayAfter))

  // Christmas Eve — many people are unreachable
  dates.add(`${year}-12-24`)

  // Juneteenth (added 2021)
  dates.add(`${year}-06-19`)

  return dates
}

// Get the Nth occurrence of a weekday in a month
// month: 0-11 (Jan=0), weekday: 0-6 (Sun=0), n: 1-5
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1))
  const offset = (weekday - d.getUTCDay() + 7) % 7
  d.setUTCDate(1 + offset + (n - 1) * 7)
  return d
}

// Get the last occurrence of a weekday in a month
function lastWeekday(year: number, month: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0)) // last day of month
  const offset = (d.getUTCDay() - weekday + 7) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d
}