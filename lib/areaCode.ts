




export interface AreaCodeInfo {
  state: string  // 2-letter state code, e.g. 'NY'
  region: Region // broad region for fallback grouping
}

export type Region =
  | 'northeast'
  | 'southeast'
  | 'midwest'
  | 'south_central'
  | 'mountain'
  | 'pacific'
  | 'unknown'



const AREA_CODES: Record<string, AreaCodeInfo> = {
  // Sorted by NPA. This table is the ONLY way a lead without a state column
  // gets a calling window — lib/callingWindow.ts derives the state from the
  // area code and fails CLOSED when it cannot, so a missing entry here is not
  // a degraded experience, it is a lead that never gets dialed. A gap of 25
  // common codes silently held 1,038 leads (6.2% of the book) undialable.
  //
  // When adding: overlays take the state of the geography they overlay. If you
  // cannot place a code with confidence, leave it out — a wrong state is a
  // wrong calling window, and refusing to guess is the whole point.
  // US territories. Genuinely dialable US numbers under US rules, and they
  // were being refused as "unrecognised area code — add a state" because the
  // table only ever held the 50 states. lib/timezones.ts carries the matching
  // zones; without an entry there these would still fail closed.
  '201': { state: 'NJ', region: 'northeast' },
  '202': { state: 'DC', region: 'southeast' },
  '203': { state: 'CT', region: 'northeast' },
  '205': { state: 'AL', region: 'southeast' },
  '206': { state: 'WA', region: 'pacific' },
  '207': { state: 'ME', region: 'northeast' },
  '208': { state: 'ID', region: 'mountain' },
  '209': { state: 'CA', region: 'pacific' },
  '210': { state: 'TX', region: 'south_central' },
  '212': { state: 'NY', region: 'northeast' },
  '213': { state: 'CA', region: 'pacific' },
  '214': { state: 'TX', region: 'south_central' },
  '215': { state: 'PA', region: 'northeast' },
  '216': { state: 'OH', region: 'midwest' },
  '217': { state: 'IL', region: 'midwest' },
  '218': { state: 'MN', region: 'midwest' },
  '219': { state: 'IN', region: 'midwest' },
  '220': { state: 'OH', region: 'midwest' },
  '223': { state: 'PA', region: 'northeast' },
  '224': { state: 'IL', region: 'midwest' },
  '225': { state: 'LA', region: 'south_central' },
  '228': { state: 'MS', region: 'southeast' },
  '229': { state: 'GA', region: 'southeast' },
  '231': { state: 'MI', region: 'midwest' },
  '234': { state: 'OH', region: 'midwest' },
  '239': { state: 'FL', region: 'southeast' },
  '240': { state: 'MD', region: 'northeast' },
  '248': { state: 'MI', region: 'midwest' },
  '251': { state: 'AL', region: 'southeast' },
  '252': { state: 'NC', region: 'southeast' },
  '253': { state: 'WA', region: 'pacific' },
  '254': { state: 'TX', region: 'south_central' },
  '256': { state: 'AL', region: 'southeast' },
  '260': { state: 'IN', region: 'midwest' },
  '262': { state: 'WI', region: 'midwest' },
  '267': { state: 'PA', region: 'northeast' },
  '269': { state: 'MI', region: 'midwest' },
  '270': { state: 'KY', region: 'southeast' },
  '272': { state: 'PA', region: 'northeast' },
  '274': { state: 'WI', region: 'midwest' },
  '276': { state: 'VA', region: 'southeast' },
  '279': { state: 'CA', region: 'pacific' },
  '281': { state: 'TX', region: 'south_central' },
  '283': { state: 'OH', region: 'midwest' },
  '301': { state: 'MD', region: 'northeast' },
  '302': { state: 'DE', region: 'northeast' },
  '303': { state: 'CO', region: 'mountain' },
  '304': { state: 'WV', region: 'southeast' },
  '305': { state: 'FL', region: 'southeast' },
  '307': { state: 'WY', region: 'mountain' },
  '308': { state: 'NE', region: 'midwest' },
  '309': { state: 'IL', region: 'midwest' },
  '310': { state: 'CA', region: 'pacific' },
  '312': { state: 'IL', region: 'midwest' },
  '313': { state: 'MI', region: 'midwest' },
  '314': { state: 'MO', region: 'midwest' },
  '315': { state: 'NY', region: 'northeast' },
  '316': { state: 'KS', region: 'midwest' },
  '317': { state: 'IN', region: 'midwest' },
  '318': { state: 'LA', region: 'south_central' },
  '319': { state: 'IA', region: 'midwest' },
  '320': { state: 'MN', region: 'midwest' },
  '321': { state: 'FL', region: 'southeast' },
  '323': { state: 'CA', region: 'pacific' },
  '325': { state: 'TX', region: 'south_central' },
  '326': { state: 'OH', region: 'midwest' },
  '327': { state: 'AR', region: 'south_central' },
  '329': { state: 'NY', region: 'northeast' },
  '330': { state: 'OH', region: 'midwest' },
  '331': { state: 'IL', region: 'midwest' },
  '332': { state: 'NY', region: 'northeast' },
  '334': { state: 'AL', region: 'southeast' },
  '335': { state: 'CA', region: 'pacific' },
  '336': { state: 'NC', region: 'southeast' },
  '337': { state: 'LA', region: 'southeast' },
  '338': { state: 'CA', region: 'pacific' },
  '339': { state: 'MA', region: 'northeast' },
  '340': { state: 'VI', region: 'southeast' },
  '341': { state: 'OH', region: 'midwest' },
  '346': { state: 'TX', region: 'south_central' },
  '347': { state: 'NY', region: 'northeast' },
  '350': { state: 'CA', region: 'pacific' },
  '351': { state: 'MA', region: 'northeast' },
  '352': { state: 'FL', region: 'southeast' },
  '353': { state: 'WI', region: 'midwest' },
  '357': { state: 'KY', region: 'southeast' },
  '360': { state: 'WA', region: 'pacific' },
  '361': { state: 'TX', region: 'south_central' },
  '363': { state: 'NY', region: 'northeast' },
  '364': { state: 'KY', region: 'southeast' },
  '369': { state: 'CA', region: 'pacific' },
  '380': { state: 'OH', region: 'midwest' },
  '385': { state: 'UT', region: 'mountain' },
  '386': { state: 'FL', region: 'southeast' },
  '401': { state: 'RI', region: 'northeast' },
  '402': { state: 'NE', region: 'midwest' },
  '404': { state: 'GA', region: 'southeast' },
  '405': { state: 'OK', region: 'south_central' },
  '406': { state: 'MT', region: 'mountain' },
  '407': { state: 'FL', region: 'southeast' },
  '408': { state: 'CA', region: 'pacific' },
  '409': { state: 'TX', region: 'south_central' },
  '410': { state: 'MD', region: 'northeast' },
  '412': { state: 'PA', region: 'northeast' },
  '413': { state: 'MA', region: 'northeast' },
  '414': { state: 'WI', region: 'midwest' },
  '415': { state: 'CA', region: 'pacific' },
  '417': { state: 'MO', region: 'midwest' },
  '419': { state: 'OH', region: 'midwest' },
  '423': { state: 'TN', region: 'southeast' },
  '424': { state: 'CA', region: 'pacific' },
  '425': { state: 'WA', region: 'pacific' },
  '430': { state: 'TX', region: 'south_central' },
  '432': { state: 'TX', region: 'south_central' },
  '434': { state: 'VA', region: 'southeast' },
  '435': { state: 'UT', region: 'mountain' },
  '436': { state: 'OH', region: 'midwest' },
  '440': { state: 'OH', region: 'midwest' },
  '442': { state: 'CA', region: 'pacific' },
  '443': { state: 'MD', region: 'northeast' },
  '445': { state: 'PA', region: 'northeast' },
  '446': { state: 'CA', region: 'pacific' },
  '447': { state: 'IL', region: 'midwest' },
  '448': { state: 'FL', region: 'southeast' },
  '458': { state: 'OR', region: 'pacific' },
  '460': { state: 'IN', region: 'midwest' },
  '463': { state: 'IN', region: 'midwest' },
  '464': { state: 'IL', region: 'midwest' },
  '469': { state: 'TX', region: 'south_central' },
  '470': { state: 'GA', region: 'southeast' },
  '472': { state: 'NC', region: 'southeast' },
  '475': { state: 'CT', region: 'northeast' },
  '478': { state: 'GA', region: 'southeast' },
  '479': { state: 'AR', region: 'south_central' },
  '480': { state: 'AZ', region: 'mountain' },
  '483': { state: 'AL', region: 'southeast' },
  '484': { state: 'PA', region: 'northeast' },
  '501': { state: 'AR', region: 'south_central' },
  '502': { state: 'KY', region: 'southeast' },
  '503': { state: 'OR', region: 'pacific' },
  '504': { state: 'LA', region: 'southeast' },
  '505': { state: 'NM', region: 'mountain' },
  '507': { state: 'MN', region: 'midwest' },
  '508': { state: 'MA', region: 'northeast' },
  '509': { state: 'WA', region: 'pacific' },
  '510': { state: 'CA', region: 'pacific' },
  '512': { state: 'TX', region: 'south_central' },
  '513': { state: 'OH', region: 'midwest' },
  '515': { state: 'IA', region: 'midwest' },
  '516': { state: 'NY', region: 'northeast' },
  '517': { state: 'MI', region: 'midwest' },
  '518': { state: 'NY', region: 'northeast' },
  '520': { state: 'AZ', region: 'mountain' },
  '524': { state: 'IL', region: 'midwest' },
  '530': { state: 'CA', region: 'pacific' },
  '531': { state: 'NE', region: 'midwest' },
  '534': { state: 'WI', region: 'midwest' },
  '539': { state: 'OK', region: 'south_central' },
  '540': { state: 'VA', region: 'southeast' },
  '541': { state: 'OR', region: 'pacific' },
  '551': { state: 'NJ', region: 'northeast' },
  '557': { state: 'MO', region: 'midwest' },
  '559': { state: 'CA', region: 'pacific' },
  '561': { state: 'FL', region: 'southeast' },
  '562': { state: 'CA', region: 'pacific' },
  '563': { state: 'IA', region: 'midwest' },
  '564': { state: 'WA', region: 'pacific' },
  '567': { state: 'OH', region: 'midwest' },
  '570': { state: 'PA', region: 'northeast' },
  '571': { state: 'VA', region: 'southeast' },
  '572': { state: 'OK', region: 'south_central' },
  '573': { state: 'MO', region: 'midwest' },
  '574': { state: 'IN', region: 'midwest' },
  '575': { state: 'NM', region: 'mountain' },
  '580': { state: 'OK', region: 'south_central' },
  '582': { state: 'PA', region: 'northeast' },
  '585': { state: 'NY', region: 'northeast' },
  '586': { state: 'MI', region: 'midwest' },
  '601': { state: 'MS', region: 'southeast' },
  '602': { state: 'AZ', region: 'mountain' },
  '603': { state: 'NH', region: 'northeast' },
  '605': { state: 'SD', region: 'midwest' },
  '606': { state: 'KY', region: 'southeast' },
  '607': { state: 'NY', region: 'northeast' },
  '608': { state: 'WI', region: 'midwest' },
  '609': { state: 'NJ', region: 'northeast' },
  '610': { state: 'PA', region: 'northeast' },
  '612': { state: 'MN', region: 'midwest' },
  '614': { state: 'OH', region: 'midwest' },
  '615': { state: 'TN', region: 'southeast' },
  '616': { state: 'MI', region: 'midwest' },
  '617': { state: 'MA', region: 'northeast' },
  '618': { state: 'IL', region: 'midwest' },
  '619': { state: 'CA', region: 'pacific' },
  '620': { state: 'KS', region: 'midwest' },
  '623': { state: 'AZ', region: 'mountain' },
  '626': { state: 'CA', region: 'pacific' },
  '628': { state: 'CA', region: 'pacific' },
  '629': { state: 'TN', region: 'southeast' },
  '630': { state: 'IL', region: 'midwest' },
  '631': { state: 'NY', region: 'northeast' },
  '636': { state: 'MO', region: 'midwest' },
  '640': { state: 'NJ', region: 'northeast' },
  '641': { state: 'IA', region: 'midwest' },
  '645': { state: 'NY', region: 'northeast' },
  '646': { state: 'NY', region: 'northeast' },
  '650': { state: 'CA', region: 'pacific' },
  '651': { state: 'MN', region: 'midwest' },
  '656': { state: 'FL', region: 'southeast' },
  '657': { state: 'CA', region: 'pacific' },
  '659': { state: 'AL', region: 'southeast' },
  '660': { state: 'MO', region: 'midwest' },
  '661': { state: 'CA', region: 'pacific' },
  '662': { state: 'MS', region: 'southeast' },
  '667': { state: 'MD', region: 'northeast' },
  '669': { state: 'CA', region: 'pacific' },
  '678': { state: 'GA', region: 'southeast' },
  '679': { state: 'MI', region: 'midwest' },
  '680': { state: 'NY', region: 'northeast' },
  '681': { state: 'WV', region: 'southeast' },
  '682': { state: 'TX', region: 'south_central' },
  '686': { state: 'VA', region: 'southeast' },
  '689': { state: 'FL', region: 'southeast' },
  '701': { state: 'ND', region: 'midwest' },
  '702': { state: 'NV', region: 'mountain' },
  '703': { state: 'VA', region: 'southeast' },
  '704': { state: 'NC', region: 'southeast' },
  '706': { state: 'GA', region: 'southeast' },
  '707': { state: 'CA', region: 'pacific' },
  '708': { state: 'IL', region: 'midwest' },
  '712': { state: 'IA', region: 'midwest' },
  '713': { state: 'TX', region: 'south_central' },
  '714': { state: 'CA', region: 'pacific' },
  '715': { state: 'WI', region: 'midwest' },
  '716': { state: 'NY', region: 'northeast' },
  '717': { state: 'PA', region: 'northeast' },
  '718': { state: 'NY', region: 'northeast' },
  '719': { state: 'CO', region: 'mountain' },
  '720': { state: 'CO', region: 'mountain' },
  '724': { state: 'PA', region: 'northeast' },
  '725': { state: 'NV', region: 'mountain' },
  '726': { state: 'TX', region: 'south_central' },
  '727': { state: 'FL', region: 'southeast' },
  '729': { state: 'TN', region: 'southeast' },
  '730': { state: 'IL', region: 'midwest' },
  '731': { state: 'TN', region: 'southeast' },
  '732': { state: 'NJ', region: 'northeast' },
  '734': { state: 'MI', region: 'midwest' },
  '737': { state: 'TX', region: 'south_central' },
  '740': { state: 'OH', region: 'midwest' },
  '743': { state: 'NC', region: 'southeast' },
  '746': { state: 'VA', region: 'southeast' },
  '747': { state: 'CA', region: 'pacific' },
  '748': { state: 'CO', region: 'mountain' },
  '754': { state: 'FL', region: 'southeast' },
  '757': { state: 'VA', region: 'southeast' },
  '760': { state: 'CA', region: 'pacific' },
  '762': { state: 'GA', region: 'southeast' },
  '763': { state: 'MN', region: 'midwest' },
  '764': { state: 'CA', region: 'pacific' },
  '765': { state: 'IN', region: 'midwest' },
  '769': { state: 'MS', region: 'southeast' },
  '770': { state: 'GA', region: 'southeast' },
  '771': { state: 'DC', region: 'southeast' },
  '772': { state: 'FL', region: 'southeast' },
  '773': { state: 'IL', region: 'midwest' },
  '774': { state: 'MA', region: 'northeast' },
  '775': { state: 'NV', region: 'mountain' },
  '779': { state: 'IL', region: 'midwest' },
  '781': { state: 'MA', region: 'northeast' },
  '785': { state: 'KS', region: 'midwest' },
  '786': { state: 'FL', region: 'southeast' },
  '787': { state: 'PR', region: 'southeast' },
  '801': { state: 'UT', region: 'mountain' },
  '802': { state: 'VT', region: 'northeast' },
  '803': { state: 'SC', region: 'southeast' },
  '804': { state: 'VA', region: 'southeast' },
  '805': { state: 'CA', region: 'pacific' },
  '806': { state: 'TX', region: 'south_central' },
  '808': { state: 'HI', region: 'pacific' },
  '810': { state: 'MI', region: 'midwest' },
  '812': { state: 'IN', region: 'midwest' },
  '813': { state: 'FL', region: 'southeast' },
  '814': { state: 'PA', region: 'northeast' },
  '815': { state: 'IL', region: 'midwest' },
  '816': { state: 'MO', region: 'midwest' },
  '817': { state: 'TX', region: 'south_central' },
  '818': { state: 'CA', region: 'pacific' },
  '820': { state: 'CA', region: 'pacific' },
  '821': { state: 'SC', region: 'southeast' },
  '826': { state: 'VA', region: 'southeast' },
  '828': { state: 'NC', region: 'southeast' },
  '830': { state: 'TX', region: 'south_central' },
  '831': { state: 'CA', region: 'pacific' },
  '832': { state: 'TX', region: 'south_central' },
  '838': { state: 'NY', region: 'northeast' },
  '839': { state: 'SC', region: 'southeast' },
  '840': { state: 'CA', region: 'pacific' },
  '843': { state: 'SC', region: 'southeast' },
  '845': { state: 'NY', region: 'northeast' },
  '847': { state: 'IL', region: 'midwest' },
  '848': { state: 'NJ', region: 'northeast' },
  '850': { state: 'FL', region: 'southeast' },
  '853': { state: 'CA', region: 'pacific' },
  '854': { state: 'SC', region: 'southeast' },
  '856': { state: 'NJ', region: 'northeast' },
  '857': { state: 'MA', region: 'northeast' },
  '858': { state: 'CA', region: 'pacific' },
  '859': { state: 'KY', region: 'southeast' },
  '860': { state: 'CT', region: 'northeast' },
  '862': { state: 'NJ', region: 'northeast' },
  '863': { state: 'FL', region: 'southeast' },
  '864': { state: 'SC', region: 'southeast' },
  '865': { state: 'TN', region: 'southeast' },
  '870': { state: 'AR', region: 'south_central' },
  '872': { state: 'IL', region: 'midwest' },
  '874': { state: 'PA', region: 'northeast' },
  '878': { state: 'PA', region: 'northeast' },
  '901': { state: 'TN', region: 'southeast' },
  '903': { state: 'TX', region: 'south_central' },
  '904': { state: 'FL', region: 'southeast' },
  '906': { state: 'MI', region: 'midwest' },
  '907': { state: 'AK', region: 'pacific' },
  '908': { state: 'NJ', region: 'northeast' },
  '909': { state: 'CA', region: 'pacific' },
  '910': { state: 'NC', region: 'southeast' },
  '912': { state: 'GA', region: 'southeast' },
  '913': { state: 'KS', region: 'midwest' },
  '914': { state: 'NY', region: 'northeast' },
  '915': { state: 'TX', region: 'south_central' },
  '916': { state: 'CA', region: 'pacific' },
  '917': { state: 'NY', region: 'northeast' },
  '918': { state: 'OK', region: 'south_central' },
  '919': { state: 'NC', region: 'southeast' },
  '920': { state: 'WI', region: 'midwest' },
  '925': { state: 'CA', region: 'pacific' },
  '928': { state: 'AZ', region: 'mountain' },
  '929': { state: 'NY', region: 'northeast' },
  '930': { state: 'IN', region: 'midwest' },
  '931': { state: 'TN', region: 'southeast' },
  '932': { state: 'OH', region: 'midwest' },
  '934': { state: 'NY', region: 'northeast' },
  '935': { state: 'CA', region: 'pacific' },
  '936': { state: 'TX', region: 'south_central' },
  '937': { state: 'OH', region: 'midwest' },
  '938': { state: 'AL', region: 'southeast' },
  '939': { state: 'PR', region: 'southeast' },
  '940': { state: 'TX', region: 'south_central' },
  '941': { state: 'FL', region: 'southeast' },
  '943': { state: 'GA', region: 'southeast' },
  '945': { state: 'TX', region: 'south_central' },
  '947': { state: 'MI', region: 'midwest' },
  '948': { state: 'VA', region: 'southeast' },
  '949': { state: 'CA', region: 'pacific' },
  '951': { state: 'CA', region: 'pacific' },
  '952': { state: 'MN', region: 'midwest' },
  '954': { state: 'FL', region: 'southeast' },
  '956': { state: 'TX', region: 'south_central' },
  '957': { state: 'NM', region: 'mountain' },
  '959': { state: 'CT', region: 'northeast' },
  '970': { state: 'CO', region: 'mountain' },
  '971': { state: 'OR', region: 'pacific' },
  '972': { state: 'TX', region: 'south_central' },
  '973': { state: 'NJ', region: 'northeast' },
  '975': { state: 'MO', region: 'midwest' },
  '978': { state: 'MA', region: 'northeast' },
  '979': { state: 'TX', region: 'south_central' },
  '980': { state: 'NC', region: 'southeast' },
  '983': { state: 'CO', region: 'mountain' },
  '984': { state: 'NC', region: 'southeast' },
  '985': { state: 'LA', region: 'southeast' },
  '986': { state: 'ID', region: 'mountain' },
  '988': { state: 'TN', region: 'southeast' },
  '989': { state: 'MI', region: 'midwest' },
}


export function getAreaCodeInfo(areaCode: string | null | undefined): AreaCodeInfo | null {
  if (!areaCode) return null
  return AREA_CODES[areaCode] ?? null
}

// =============================================================================
// STATE -> REGION
// =============================================================================
// Derived from the table above rather than written out a second time, so a
// state can never end up in two different regions depending on which lookup
// you happened to use. Every area code in a state agrees on its region, so the
// first one seen wins and the rest confirm it.
//
// This exists for caller-ID selection: when a lead's recorded state disagrees
// with their phone's area code — someone who moved and kept their number — the
// area code's region is misleading, and the region we still want to fall back
// to is the one their STATE belongs to. Without this, that fallback tier was
// simply lost and such leads dropped straight to "any number with capacity".
const STATE_TO_REGION: Record<string, Region> = (() => {
  const map: Record<string, Region> = {}
  for (const info of Object.values(AREA_CODES)) {
    if (info.region !== 'unknown' && !map[info.state]) {
      map[info.state] = info.region
    }
  }
  return map
})()

/** Broad region for a 2-letter state code, or null if it isn't one we place. */
export function stateToRegion(state: string | null | undefined): Region | null {
  if (!state) return null
  return STATE_TO_REGION[state.toUpperCase()] ?? null
}

// =============================================================================
// CLASSIFICATION
// =============================================================================
// getAreaCodeInfo answers one question — "which state?" — and returns null for
// everything else. That single null was being read as "unknown US area code",
// which produced actively wrong advice: a toll-free 800 number and a Canadian
// 902 number were both reported as "unrecognised area code, add a state to
// dial it". No state makes an 800 number dialable, and a Canadian number needs
// Canadian rules rather than a state.
//
// So the null is split into the cases that need different handling.
// =============================================================================

/**
 * Checked against NANP records and regulator notices, and deliberately NOT in
 * the table above: 485, 489, 632, 723, 823, 846, 974.
 *
 * Every one is unassigned or reserved — 823 is listed as "not in use, available
 * for geographic assignment", the rest are held for future relief. Leads
 * carrying them exist (two each in production) and are almost certainly typos
 * or spoofed caller ID. They stay undialable on purpose.
 *
 * Do not fill these in from a lookup site. Several such sites invent a
 * plausible state for unassigned codes, and a wrong state here is a wrong
 * calling window.
 */
export type AreaCodeClass =
  /** A US state or territory we can place, and therefore time correctly. */
  | { kind: 'us'; state: string; region: Region }
  /** Canada. Same numbering plan, different country's calling rules. */
  | { kind: 'canada' }
  /** 800/833/844/855/866/877/888 — reachable, but never a lead's own line. */
  | { kind: 'toll_free' }
  /** 900 premium, N11 service codes, 710 government, personal-comms ranges. */
  | { kind: 'non_geographic' }
  /** Caribbean and other NANP members outside the US and Canada. */
  | { kind: 'other_nanp' }
  /** Well-formed, but not a code we hold. Genuinely unknown. */
  | { kind: 'unknown' }

const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888'])

/**
 * Codes that are valid NANP but never reach a person at a fixed location.
 * 900 is premium-rate, 710 is US Government, N11 are service codes, and the
 * 5XX range is non-geographic personal communications.
 */
const NON_GEOGRAPHIC = new Set([
  '900', '710', '500', '521', '522', '523', '524', '525', '526', '527', '528',
  '529', '532', '533', '535', '538', '542', '543', '544', '545', '547', '550',
  '552', '553', '554', '556', '558', '566', '577', '588',
  '211', '311', '411', '511', '611', '711', '811', '911',
])

/** Canadian NPAs. Same dial plan, different country — and different law. */
const CANADA = new Set([
  '204', '226', '236', '249', '250', '263', '289', '306', '343', '354', '365',
  '367', '368', '382', '387', '403', '416', '418', '428', '431', '437', '438',
  '450', '468', '474', '506', '514', '519', '548', '579', '581', '584', '587',
  '600', '604', '613', '622', '639', '647', '672', '683', '705', '709', '742',
  '753', '778', '780', '782', '807', '819', '825', '867', '873', '879', '902',
  '905',
])

/** Caribbean and other NANP members that are neither the US nor Canada. */
const OTHER_NANP = new Set([
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664',
  '670', '671', '684', '721', '758', '767', '784', '809', '829', '849', '868',
  '869', '876',
])

/**
 * Place an area code precisely enough to give the user a true sentence.
 *
 * Order matters: the US table wins first, because a handful of the sets below
 * would otherwise shadow real assignments if either list drifts.
 */
export function classifyAreaCode(areaCode: string | null | undefined): AreaCodeClass {
  if (!areaCode || !/^\d{3}$/.test(areaCode)) return { kind: 'unknown' }

  const us = AREA_CODES[areaCode]
  if (us) return { kind: 'us', state: us.state, region: us.region }

  if (TOLL_FREE.has(areaCode)) return { kind: 'toll_free' }
  if (NON_GEOGRAPHIC.has(areaCode)) return { kind: 'non_geographic' }
  if (CANADA.has(areaCode)) return { kind: 'canada' }
  if (OTHER_NANP.has(areaCode)) return { kind: 'other_nanp' }

  return { kind: 'unknown' }
}

/** Convenience wrapper for the common "classify a phone number" call. */
export function classifyPhone(phone: string | null | undefined): AreaCodeClass {
  return classifyAreaCode(extractAreaCode(phone))
}

/** How many US area codes the table holds. Used by tests to catch silent loss. */
export const US_AREA_CODE_COUNT = Object.keys(AREA_CODES).length


export function extractAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1, 4)
  }
  if (digits.length === 10) {
    return digits.slice(0, 3)
  }
  return null
}


export function phoneToState(phone: string | null | undefined): string | null {
  const ac = extractAreaCode(phone)
  return getAreaCodeInfo(ac)?.state ?? null
}


export function phoneToRegion(phone: string | null | undefined): Region {
  const ac = extractAreaCode(phone)
  return getAreaCodeInfo(ac)?.region ?? 'unknown'
}