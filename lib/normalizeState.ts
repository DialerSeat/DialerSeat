// =============================================================================
// normalizeState — robust lead-state resolution
// =============================================================================
// Lead sheets store state in many forms: "NC", "nc", "N.C.", "North Carolina",
// "north carolina", " North Carolina ", "Calif.", etc. The TCPA calling-window
// check needs a clean 2-letter USPS code to look up the timezone. This function
// turns any reasonable representation into that code, or returns null if the
// value genuinely isn't a US state/territory.
//
// Why this matters: blocking a real, callable lead because the sheet wrote
// "North Carolina" instead of "NC" is a false positive that costs real dials.
// The compliance gate should still fail closed on TRULY unknown input, but it
// must first actually understand valid input.
// =============================================================================

// Full state/territory name -> USPS code. Lowercased keys for case-insensitive
// matching. Includes DC and the common US territories that the timezone table
// supports, plus a few frequent abbreviations/misspellings seen in real sheets.
const NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d.c.': 'DC',
  'd.c.': 'DC',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'washington state': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
  // Common abbreviations / shorthand seen in real lead sheets
  'calif': 'CA',
  'cali': 'CA',
  'penn': 'PA',
  'penna': 'PA',
  'mass': 'MA',
  'conn': 'CT',
  'tenn': 'TN',
  'fla': 'FL',
  'ariz': 'AZ',
  'wash': 'WA',
  'n carolina': 'NC',
  's carolina': 'SC',
  'n dakota': 'ND',
  's dakota': 'SD',
  'n. carolina': 'NC',
  's. carolina': 'SC',
}

// The set of valid 2-letter codes (50 states + DC). Territories intentionally
// excluded here unless the timezone table supports them; callers fall back to
// area-code inference for anything not resolvable.
const VALID_CODES = new Set<string>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

/**
 * Normalize any reasonable representation of a US state to its 2-letter USPS
 * code. Returns null if the input is empty or not recognizable as a state, so
 * the caller can decide what to do (e.g. fall back to area-code inference).
 *
 * Handles:
 *   - 2-letter codes in any case: "nc", "NC", "Nc"
 *   - codes with punctuation/space: "N.C.", "N C", " NC "
 *   - full names in any case: "north carolina", "North Carolina"
 *   - common abbreviations: "Calif.", "Penn", "Mass"
 */
export function normalizeState(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Trim and collapse internal whitespace
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  // 1) Direct 2-letter code (strip non-letters first, e.g. "N.C." -> "NC")
  const lettersOnly = cleaned.replace(/[^a-zA-Z]/g, '').toUpperCase()
  if (lettersOnly.length === 2 && VALID_CODES.has(lettersOnly)) {
    return lettersOnly
  }

  // 2) Full name or known variant (case-insensitive)
  const lower = cleaned.toLowerCase()
  if (NAME_TO_CODE[lower]) {
    return NAME_TO_CODE[lower]
  }

  // 3) Name variant with periods removed (e.g. "n. carolina" already covered,
  //    but also handles "calif." -> "calif")
  const lowerNoDots = lower.replace(/\./g, '').replace(/\s+/g, ' ').trim()
  if (NAME_TO_CODE[lowerNoDots]) {
    return NAME_TO_CODE[lowerNoDots]
  }

  // Not recognizable as a state
  return null
}