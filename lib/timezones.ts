







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



// Holiday calendar intentionally removed — dialing on federal holidays is
// left to each user's discretion and is no longer enforced by the system.
// See lib/callingWindow.ts: isCallableNow() only checks calling-window hours
// and state Sunday rules.