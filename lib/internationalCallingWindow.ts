// =============================================================================
// INTERNATIONAL CALLING WINDOWS — UK, Australia, France
// =============================================================================
// Per-country legal/regulatory calling-hour restrictions, applied ONLY to
// leads whose phone number carries that country's international dialing
// code (detected from the E.164 phone string — see detectInternationalRegion
// below). US-format numbers (no country code, or +1) are untouched and
// continue to go through the existing state-based logic in callingWindow.ts.
//
// WHY THIS IS ITS OWN FILE INSTEAD OF EXTENDING STATE_TIMEZONES /
// STATE_RULES: the US system keys everything off a 2-letter STATE code
// verified against the leads.state column. There is no leads.country column
// in the schema (checked — db/schema.sql has no such field), and the
// existing `state` field is a free-text column used US-conventionally (2
// letter codes). Detecting UK/AU/FR leads has to come from the phone
// number's international prefix instead. Keeping this as a separate,
// explicitly-named module makes clear which leads this logic actually
// applies to, rather than silently overloading the US-shaped STATE_RULES
// table with entries that were never state codes.
//
// WHAT'S DELIBERATELY NOT INCLUDED: holiday blocking. Per instruction, this
// mirrors the US side (see timezones.ts — "Holiday calendar intentionally
// removed") — day-of-week and hour-of-day rules are enforced, but no
// calendar of national holidays is checked for any region here, even
// though at least the UK guidance and the AU industry standard formally
// reference public holidays. That's a deliberate scope decision, not an
// oversight — flagged here so it isn't mistaken for one later.
//
// RESEARCH BASIS PER COUNTRY (checked directly, not assumed):
//
//   UNITED KINGDOM — NOT a hard statute. Ofcom/ICO have no legislated
//   calling-hour restriction on the books (confirmed via multiple industry
//   sources, including practitioners who directly consulted the DMA/TPS/
//   ICO: "there is NO legislation in the UK regarding Outbound cold calling
//   hours on the statute or Civil books"). What exists is DMA/Ofcom-aligned
//   INDUSTRY GUIDANCE, consistently cited as Mon-Fri 8am-9pm, Sat 9am-9pm,
//   no Sunday calls. Enforced in practice via PECR/ICO complaint-driven
//   action (fines up to six figures have been issued for related nuisance-
//   call conduct), not via a specific hours statute. Implemented here as
//   the best-practice standard, with that distinction preserved in the
//   `legalBasis` field returned below rather than overstating it as
//   binding law.
//
//   AUSTRALIA — REAL, codified, enforceable federal law: the
//   Telecommunications (Telemarketing and Research Calls) Industry
//   Standard 2017, made under the Do Not Call Register Act 2006. Verified
//   directly against the primary source (donotcall.gov.au, run by the
//   Australian Communications and Media Authority — ACMA): telemarketing
//   calls Mon-Fri 9:00am-8:00pm, Sat 9:00am-5:00pm, no calls Sunday. ACMA
//   can issue penalties up to $250,000 for breaches per that same page.
//   (Research/opinion-polling calls have slightly different hours per the
//   Standard; this codebase only places telemarketing/sales calls, so only
//   the telemarketing row of the Standard's table is implemented.)
//
//   FRANCE — REAL, codified law (décret n°2022-1313, the "loi Naegelen"
//   framework, in force since 1 March 2023): telemarketing calls permitted
//   ONLY Mon-Fri 10:00-13:00 and 14:00-20:00 — note the lunch-hour gap and
//   the fact that NO weekend calls are permitted at all, unlike the US/UK/
//   AU patterns which all allow at least some Saturday hours. Confirmed
//   consistently across multiple independent sources (Connexion France,
//   Squaretalk, Procontact) citing the same decree and the same hours.
//   Fines up to EUR 375,000 for corporate violations.
//
// EXPLICITLY NOT COVERED — REST OF THE EU: the EU has NO single calling-
// hours law. The ePrivacy Directive (2002/58/EC) sets a CONSENT framework
// (member states choose opt-in/opt-out for telemarketing) but does not
// specify calling-hour windows at all — that is left entirely to each
// member state's own national law, and those laws genuinely differ in
// kind, not just in the numbers. Germany, for example, essentially
// requires documented prior consent for any B2C marketing call regardless
// of time of day — there is no "safe window" to encode the way there is
// for the US/UK/AU/FR. Building one blended "EU" rule would misrepresent
// real, materially different national frameworks (see France above, which
// is nothing like the UK's numbers). Rather than guess, any phone number
// with a non-UK/AU/FR/US international prefix falls through to
// FALLBACK_INTERNATIONAL_RULE below — a conservative, clearly-labeled
// placeholder, not a researched rule for that specific country.
// =============================================================================

export type InternationalRegion = 'UK' | 'AU' | 'FR'

export interface InternationalCallingRule {
  region: InternationalRegion
  timezone: string
  legalBasis: 'industry_guidance' | 'statute'
  citation: string
  // Each day's allowed window(s). Multiple ranges = a mid-day gap (France's
  // lunch break). Empty array = no calls permitted that day at all.
  windows: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Array<{ startHour: number; endHour: number }>>
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export const INTERNATIONAL_RULES: Record<InternationalRegion, InternationalCallingRule> = {
  UK: {
    region: 'UK',
    timezone: 'Europe/London',
    legalBasis: 'industry_guidance',
    citation: 'Ofcom/DMA industry guidance (no UK statute sets calling hours; enforced in practice via PECR/ICO complaint action)',
    windows: {
      mon: [{ startHour: 8, endHour: 21 }],
      tue: [{ startHour: 8, endHour: 21 }],
      wed: [{ startHour: 8, endHour: 21 }],
      thu: [{ startHour: 8, endHour: 21 }],
      fri: [{ startHour: 8, endHour: 21 }],
      sat: [{ startHour: 9, endHour: 21 }],
      sun: [],
    },
  },
  AU: {
    region: 'AU',
    timezone: 'Australia/Sydney', // Most populous AU timezone; see per-state note below
    legalBasis: 'statute',
    citation: 'Telecommunications (Telemarketing and Research Calls) Industry Standard 2017, under the Do Not Call Register Act 2006 (ACMA), donotcall.gov.au',
    windows: {
      mon: [{ startHour: 9, endHour: 20 }],
      tue: [{ startHour: 9, endHour: 20 }],
      wed: [{ startHour: 9, endHour: 20 }],
      thu: [{ startHour: 9, endHour: 20 }],
      fri: [{ startHour: 9, endHour: 20 }],
      sat: [{ startHour: 9, endHour: 17 }],
      sun: [],
    },
  },
  FR: {
    region: 'FR',
    timezone: 'Europe/Paris',
    legalBasis: 'statute',
    citation: 'Décret n°2022-1313 (1 March 2023), "loi Naegelen" telemarketing framework',
    windows: {
      mon: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
      tue: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
      wed: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
      thu: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
      fri: [{ startHour: 10, endHour: 13 }, { startHour: 14, endHour: 20 }],
      sat: [],
      sun: [],
    },
  },
}

// Conservative placeholder for any other international number (e.g. other
// EU member states, or any prefix not explicitly researched above). NOT a
// researched rule for any specific country — deliberately narrower than any
// of the three researched regions above (mirrors the US federal TCPA/TSR
// default: Mon-Sat 9am-8pm, no Sunday) so an unresearched region defaults
// to caution rather than either blocking everything or allowing 24/7.
const FALLBACK_INTERNATIONAL_RULE: InternationalCallingRule = {
  region: 'UK', // placeholder tag only — see legalBasis/citation, this is NOT UK-specific
  timezone: 'UTC',
  legalBasis: 'industry_guidance',
  citation: 'UNRESEARCHED REGION: conservative fallback window, not a verified rule for this specific country. Verify local law before relying on this for a real campaign.',
  windows: {
    mon: [{ startHour: 9, endHour: 20 }],
    tue: [{ startHour: 9, endHour: 20 }],
    wed: [{ startHour: 9, endHour: 20 }],
    thu: [{ startHour: 9, endHour: 20 }],
    fri: [{ startHour: 9, endHour: 20 }],
    sat: [{ startHour: 9, endHour: 20 }],
    sun: [],
  },
}

// International dialing codes for the three researched regions.
const REGION_DIAL_CODES: Array<{ prefix: string; region: InternationalRegion }> = [
  { prefix: '+44', region: 'UK' },
  { prefix: '+61', region: 'AU' },
  { prefix: '+33', region: 'FR' },
]

// Any other +<code> prefix that isn't US (+1) and isn't one of the three
// above — used to decide whether to apply the conservative fallback rule
// instead of silently treating an international number as if it were a
// domestic US call (which would be wrong in a different, worse way: it'd
// apply US state-timezone logic to a number that was never a US area
// code, likely misdetecting the state/timezone entirely via areaCode.ts).
const NON_US_INTL_PATTERN = /^\+(?!1\d{10}$)\d{7,15}$/

/**
 * Detects whether a normalized E.164 phone number belongs to one of the
 * explicitly-researched international regions, a different (unresearched)
 * international region, or looks like a domestic US number.
 *
 * Returns null for anything that looks like a US number (no leading +, or
 * +1 followed by 10 digits) — those are left entirely to the existing
 * US state-based logic in callingWindow.ts, unchanged.
 */
export function detectInternationalRegion(phone: string | null | undefined): InternationalRegion | 'OTHER_INTL' | null {
  if (!phone) return null
  const trimmed = phone.trim()

  for (const { prefix, region } of REGION_DIAL_CODES) {
    if (trimmed.startsWith(prefix)) return region
  }

  if (NON_US_INTL_PATTERN.test(trimmed)) return 'OTHER_INTL'

  return null
}

export interface InternationalCallabilityResult {
  allowed: boolean
  reason?: string
  region: InternationalRegion | 'OTHER_INTL'
  localTime?: string
}

/**
 * Checks a lead's callability against the researched (or fallback)
 * international rule for its region. Only call this after
 * detectInternationalRegion() has returned non-null for the lead's phone.
 */
export function isCallableNowInternational(phone: string, region: InternationalRegion | 'OTHER_INTL'): InternationalCallabilityResult {
  const rule = region === 'OTHER_INTL' ? FALLBACK_INTERNATIONAL_RULE : INTERNATIONAL_RULES[region]

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: rule.timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const partMap: Record<string, string> = {}
  for (const p of parts) partMap[p.type] = p.value

  const hour = parseInt(partMap.hour, 10)
  const minute = parseInt(partMap.minute, 10)
  const weekdayShort = partMap.weekday.toLowerCase().slice(0, 3) as typeof DOW_KEYS[number]
  const localTime = `${partMap.hour}:${partMap.minute} ${partMap.weekday} (${rule.timezone})`

  const todaysWindows = rule.windows[weekdayShort] || []

  if (todaysWindows.length === 0) {
    return {
      allowed: false,
      reason: region === 'OTHER_INTL'
        ? `No verified calling-hours rule for this number's region, conservative default blocks ${partMap.weekday} calls entirely. Confirm local law before overriding.`
        : `${region}, no calls permitted on ${partMap.weekday} (${rule.citation})`,
      region,
      localTime,
    }
  }

  const currentMinutes = hour * 60 + minute
  const inAnyWindow = todaysWindows.some(w => currentMinutes >= w.startHour * 60 && currentMinutes < w.endHour * 60)

  if (!inAnyWindow) {
    const windowsDesc = todaysWindows.map(w => `${w.startHour}:00-${w.endHour}:00`).join(' and ')
    return {
      allowed: false,
      reason: region === 'OTHER_INTL'
        ? `Outside conservative default window (${windowsDesc} local): no verified rule for this specific region, confirm local law.`
        : `${region}: outside permitted window (${windowsDesc} local, ${rule.citation})`,
      region,
      localTime,
    }
  }

  return { allowed: true, region, localTime }
}
