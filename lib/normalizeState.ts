

















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




const VALID_CODES = new Set<string>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])


export function normalizeState(raw: string | null | undefined): string | null {
  if (!raw) return null

  
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  
  const lettersOnly = cleaned.replace(/[^a-zA-Z]/g, '').toUpperCase()
  if (lettersOnly.length === 2 && VALID_CODES.has(lettersOnly)) {
    return lettersOnly
  }

  
  const lower = cleaned.toLowerCase()
  if (NAME_TO_CODE[lower]) {
    return NAME_TO_CODE[lower]
  }

  
  
  const lowerNoDots = lower.replace(/\./g, '').replace(/\s+/g, ' ').trim()
  if (NAME_TO_CODE[lowerNoDots]) {
    return NAME_TO_CODE[lowerNoDots]
  }

  
  return null
}