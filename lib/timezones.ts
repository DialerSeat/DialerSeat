







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


// ── ONE UNIFORM WINDOW: 9am–9pm IN THE LEAD'S LOCAL TIME ──────────────────
// Per product decision: the system enforces hours and nothing else. No
// holiday calendar, no Sunday rules, no per-state variations. Which days are
// appropriate to dial is left to each user's judgement.
//
// 9am is deliberately one hour LATER than the federal TCPA floor of 8am, so
// the uniform window sits inside the federal rule everywhere rather than at
// its edge.
//
// WHAT THIS GIVES UP, stated plainly so it is a decision and not a surprise:
// some states are stricter than the federal rule, and those rules are no
// longer applied. FL / AL / MS end telemarketing at 8pm, not 9pm, and LA
// prohibits Sunday telemarketing outright. Under this uniform window the
// dialer will place calls in those states between 8pm and 9pm, and on
// Sundays in Louisiana. That compliance judgement now sits with the operator,
// which is the explicit intent.
const UNIFORM_WINDOW: CallingRule = { startHour: 9, endHour: 21 }

// Kept exported (other modules import it) but intentionally empty: no state
// overrides the uniform window. Adding an entry here is all it takes to
// reinstate a stricter state rule later.
export const STATE_RULES: Record<string, CallingRule> = {}

export function getCallingRule(state: string): CallingRule {
  // STATE_RULES is empty today, so every state resolves to the uniform
  // window. Kept as a real lookup rather than a hardcoded return so
  // reinstating a stricter state rule is a one-line data change here, with
  // no code change in lib/callingWindow.ts.
  return STATE_RULES[state] || UNIFORM_WINDOW
}



// Holiday calendar intentionally removed — dialing on federal holidays is
// left to each user's discretion and is no longer enforced by the system.
// See lib/callingWindow.ts: isCallableNow() checks calling-window HOURS only.
// No holidays, no day-of-week rules — a lead is dialable whenever its local
// time is inside the window.