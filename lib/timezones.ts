







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










export interface CallingRule {
  startHour: number
  endHour: number
  sundayStartHour?: number
  sundayEndHour?: number
  
  noSundayCalls?: boolean
}


const FEDERAL: CallingRule = { startHour: 8, endHour: 21 }




export const STATE_RULES: Record<string, CallingRule> = {
  
  FL: { startHour: 8, endHour: 20 },
  
  LA: { startHour: 8, endHour: 21, noSundayCalls: true },
  
  AL: { startHour: 8, endHour: 20 },
  
  MS: { startHour: 8, endHour: 20 },
  
  
}

export function getCallingRule(state: string): CallingRule {
  return STATE_RULES[state] || FEDERAL
}



export function getFederalHolidays(year: number): Set<string> {
  const dates = new Set<string>()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  
  dates.add(`${year}-01-01`) // New Year's Day
  dates.add(`${year}-07-04`) // Independence Day
  dates.add(`${year}-11-11`) // Veterans Day
  dates.add(`${year}-12-25`) // Christmas

  
  dates.add(fmt(nthWeekday(year, 0, 1, 3))) // MLK Day — 3rd Monday in January
  dates.add(fmt(nthWeekday(year, 1, 1, 3))) // Presidents Day — 3rd Monday in February
  dates.add(fmt(lastWeekday(year, 4, 1)))   // Memorial Day — last Monday in May
  dates.add(fmt(nthWeekday(year, 8, 1, 1))) // Labor Day — 1st Monday in September
  dates.add(fmt(nthWeekday(year, 9, 1, 2))) // Columbus Day — 2nd Monday in October
  dates.add(fmt(nthWeekday(year, 10, 4, 4))) // Thanksgiving — 4th Thursday in November

  
  const thanksgiving = nthWeekday(year, 10, 4, 4)
  const dayAfter = new Date(thanksgiving)
  dayAfter.setDate(dayAfter.getDate() + 1)
  dates.add(fmt(dayAfter))

  
  dates.add(`${year}-12-24`)

  
  dates.add(`${year}-06-19`)

  return dates
}



function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1))
  const offset = (weekday - d.getUTCDay() + 7) % 7
  d.setUTCDate(1 + offset + (n - 1) * 7)
  return d
}


function lastWeekday(year: number, month: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0)) // last day of month
  const offset = (d.getUTCDay() - weekday + 7) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d
}