




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
  
  '201': { state: 'NJ', region: 'northeast' },
  '203': { state: 'CT', region: 'northeast' },
  '207': { state: 'ME', region: 'northeast' },
  '212': { state: 'NY', region: 'northeast' },
  '215': { state: 'PA', region: 'northeast' },
  '267': { state: 'PA', region: 'northeast' },
  '301': { state: 'MD', region: 'northeast' },
  '302': { state: 'DE', region: 'northeast' },
  '315': { state: 'NY', region: 'northeast' },
  '347': { state: 'NY', region: 'northeast' },
  '401': { state: 'RI', region: 'northeast' },
  '410': { state: 'MD', region: 'northeast' },
  '412': { state: 'PA', region: 'northeast' },
  '413': { state: 'MA', region: 'northeast' },
  '443': { state: 'MD', region: 'northeast' },
  '475': { state: 'CT', region: 'northeast' },
  '516': { state: 'NY', region: 'northeast' },
  '518': { state: 'NY', region: 'northeast' },
  '551': { state: 'NJ', region: 'northeast' },
  '585': { state: 'NY', region: 'northeast' },
  '603': { state: 'NH', region: 'northeast' },
  '607': { state: 'NY', region: 'northeast' },
  '609': { state: 'NJ', region: 'northeast' },
  '610': { state: 'PA', region: 'northeast' },
  '617': { state: 'MA', region: 'northeast' },
  '631': { state: 'NY', region: 'northeast' },
  '646': { state: 'NY', region: 'northeast' },
  '716': { state: 'NY', region: 'northeast' },
  '717': { state: 'PA', region: 'northeast' },
  '718': { state: 'NY', region: 'northeast' },
  '724': { state: 'PA', region: 'northeast' },
  '732': { state: 'NJ', region: 'northeast' },
  '774': { state: 'MA', region: 'northeast' },
  '781': { state: 'MA', region: 'northeast' },
  '802': { state: 'VT', region: 'northeast' },
  '845': { state: 'NY', region: 'northeast' },
  '848': { state: 'NJ', region: 'northeast' },
  '856': { state: 'NJ', region: 'northeast' },
  '857': { state: 'MA', region: 'northeast' },
  '860': { state: 'CT', region: 'northeast' },
  '862': { state: 'NJ', region: 'northeast' },
  '878': { state: 'PA', region: 'northeast' },
  '908': { state: 'NJ', region: 'northeast' },
  '914': { state: 'NY', region: 'northeast' },
  '917': { state: 'NY', region: 'northeast' },
  '929': { state: 'NY', region: 'northeast' },
  '973': { state: 'NJ', region: 'northeast' },
  '978': { state: 'MA', region: 'northeast' },

  
  '202': { state: 'DC', region: 'southeast' },
  '205': { state: 'AL', region: 'southeast' },
  '229': { state: 'GA', region: 'southeast' },
  '239': { state: 'FL', region: 'southeast' },
  '251': { state: 'AL', region: 'southeast' },
  '252': { state: 'NC', region: 'southeast' },
  '256': { state: 'AL', region: 'southeast' },
  '276': { state: 'VA', region: 'southeast' },
  '305': { state: 'FL', region: 'southeast' },
  '321': { state: 'FL', region: 'southeast' },
  '336': { state: 'NC', region: 'southeast' },
  '337': { state: 'LA', region: 'southeast' },
  '352': { state: 'FL', region: 'southeast' },
  '386': { state: 'FL', region: 'southeast' },
  '404': { state: 'GA', region: 'southeast' },
  '407': { state: 'FL', region: 'southeast' },
  '423': { state: 'TN', region: 'southeast' },
  '434': { state: 'VA', region: 'southeast' },
  '470': { state: 'GA', region: 'southeast' },
  '478': { state: 'GA', region: 'southeast' },
  '484': { state: 'PA', region: 'northeast' },
  '501': { state: 'AR', region: 'south_central' },
  '502': { state: 'KY', region: 'southeast' },
  '504': { state: 'LA', region: 'southeast' },
  '540': { state: 'VA', region: 'southeast' },
  '561': { state: 'FL', region: 'southeast' },
  '571': { state: 'VA', region: 'southeast' },
  '601': { state: 'MS', region: 'southeast' },
  '615': { state: 'TN', region: 'southeast' },
  '662': { state: 'MS', region: 'southeast' },
  '678': { state: 'GA', region: 'southeast' },
  '703': { state: 'VA', region: 'southeast' },
  '704': { state: 'NC', region: 'southeast' },
  '706': { state: 'GA', region: 'southeast' },
  '727': { state: 'FL', region: 'southeast' },
  '731': { state: 'TN', region: 'southeast' },
  '754': { state: 'FL', region: 'southeast' },
  '757': { state: 'VA', region: 'southeast' },
  '770': { state: 'GA', region: 'southeast' },
  '772': { state: 'FL', region: 'southeast' },
  '786': { state: 'FL', region: 'southeast' },
  '803': { state: 'SC', region: 'southeast' },
  '804': { state: 'VA', region: 'southeast' },
  '813': { state: 'FL', region: 'southeast' },
  '828': { state: 'NC', region: 'southeast' },
  '843': { state: 'SC', region: 'southeast' },
  '850': { state: 'FL', region: 'southeast' },
  '854': { state: 'SC', region: 'southeast' },
  '863': { state: 'FL', region: 'southeast' },
  '865': { state: 'TN', region: 'southeast' },
  '901': { state: 'TN', region: 'southeast' },
  '910': { state: 'NC', region: 'southeast' },
  '912': { state: 'GA', region: 'southeast' },
  '919': { state: 'NC', region: 'southeast' },
  '931': { state: 'TN', region: 'southeast' },
  '941': { state: 'FL', region: 'southeast' },
  '954': { state: 'FL', region: 'southeast' },
  '980': { state: 'NC', region: 'southeast' },
  '984': { state: 'NC', region: 'southeast' },

  
  '216': { state: 'OH', region: 'midwest' },
  '218': { state: 'MN', region: 'midwest' },
  '219': { state: 'IN', region: 'midwest' },
  '231': { state: 'MI', region: 'midwest' },
  '234': { state: 'OH', region: 'midwest' },
  '248': { state: 'MI', region: 'midwest' },
  '260': { state: 'IN', region: 'midwest' },
  '262': { state: 'WI', region: 'midwest' },
  '269': { state: 'MI', region: 'midwest' },
  '274': { state: 'WI', region: 'midwest' },
  '309': { state: 'IL', region: 'midwest' },
  '312': { state: 'IL', region: 'midwest' },
  '313': { state: 'MI', region: 'midwest' },
  '314': { state: 'MO', region: 'midwest' },
  '316': { state: 'KS', region: 'midwest' },
  '317': { state: 'IN', region: 'midwest' },
  '319': { state: 'IA', region: 'midwest' },
  '320': { state: 'MN', region: 'midwest' },
  '330': { state: 'OH', region: 'midwest' },
  '331': { state: 'IL', region: 'midwest' },
  '341': { state: 'OH', region: 'midwest' },
  '414': { state: 'WI', region: 'midwest' },
  '419': { state: 'OH', region: 'midwest' },
  '440': { state: 'OH', region: 'midwest' },
  '463': { state: 'IN', region: 'midwest' },
  '507': { state: 'MN', region: 'midwest' },
  '513': { state: 'OH', region: 'midwest' },
  '515': { state: 'IA', region: 'midwest' },
  '517': { state: 'MI', region: 'midwest' },
  '524': { state: 'IL', region: 'midwest' },
  '531': { state: 'NE', region: 'midwest' },
  '534': { state: 'WI', region: 'midwest' },
  '563': { state: 'IA', region: 'midwest' },
  '567': { state: 'OH', region: 'midwest' },
  '573': { state: 'MO', region: 'midwest' },
  '574': { state: 'IN', region: 'midwest' },
  '586': { state: 'MI', region: 'midwest' },
  '608': { state: 'WI', region: 'midwest' },
  '612': { state: 'MN', region: 'midwest' },
  '614': { state: 'OH', region: 'midwest' },
  '616': { state: 'MI', region: 'midwest' },
  '618': { state: 'IL', region: 'midwest' },
  '630': { state: 'IL', region: 'midwest' },
  '636': { state: 'MO', region: 'midwest' },
  '641': { state: 'IA', region: 'midwest' },
  '651': { state: 'MN', region: 'midwest' },
  '660': { state: 'MO', region: 'midwest' },
  '708': { state: 'IL', region: 'midwest' },
  '712': { state: 'IA', region: 'midwest' },
  '715': { state: 'WI', region: 'midwest' },
  '734': { state: 'MI', region: 'midwest' },
  '740': { state: 'OH', region: 'midwest' },
  '763': { state: 'MN', region: 'midwest' },
  '765': { state: 'IN', region: 'midwest' },
  '773': { state: 'IL', region: 'midwest' },
  '779': { state: 'IL', region: 'midwest' },
  '785': { state: 'KS', region: 'midwest' },
  '810': { state: 'MI', region: 'midwest' },
  '812': { state: 'IN', region: 'midwest' },
  '815': { state: 'IL', region: 'midwest' },
  '816': { state: 'MO', region: 'midwest' },
  '847': { state: 'IL', region: 'midwest' },
  '872': { state: 'IL', region: 'midwest' },
  '906': { state: 'MI', region: 'midwest' },
  '913': { state: 'KS', region: 'midwest' },
  '920': { state: 'WI', region: 'midwest' },
  '930': { state: 'IN', region: 'midwest' },
  '937': { state: 'OH', region: 'midwest' },
  '952': { state: 'MN', region: 'midwest' },
  '989': { state: 'MI', region: 'midwest' },

  
  '210': { state: 'TX', region: 'south_central' },
  '214': { state: 'TX', region: 'south_central' },
  '225': { state: 'LA', region: 'south_central' },
  '254': { state: 'TX', region: 'south_central' },
  '281': { state: 'TX', region: 'south_central' },
  '318': { state: 'LA', region: 'south_central' },
  '325': { state: 'TX', region: 'south_central' },
  '346': { state: 'TX', region: 'south_central' },
  '361': { state: 'TX', region: 'south_central' },
  '405': { state: 'OK', region: 'south_central' },
  '409': { state: 'TX', region: 'south_central' },
  '430': { state: 'TX', region: 'south_central' },
  '432': { state: 'TX', region: 'south_central' },
  '469': { state: 'TX', region: 'south_central' },
  '479': { state: 'AR', region: 'south_central' },
  '512': { state: 'TX', region: 'south_central' },
  '580': { state: 'OK', region: 'south_central' },
  '682': { state: 'TX', region: 'south_central' },
  '713': { state: 'TX', region: 'south_central' },
  '737': { state: 'TX', region: 'south_central' },
  '806': { state: 'TX', region: 'south_central' },
  '817': { state: 'TX', region: 'south_central' },
  '830': { state: 'TX', region: 'south_central' },
  '832': { state: 'TX', region: 'south_central' },
  '870': { state: 'AR', region: 'south_central' },
  '903': { state: 'TX', region: 'south_central' },
  '915': { state: 'TX', region: 'south_central' },
  '918': { state: 'OK', region: 'south_central' },
  '936': { state: 'TX', region: 'south_central' },
  '940': { state: 'TX', region: 'south_central' },
  '956': { state: 'TX', region: 'south_central' },
  '972': { state: 'TX', region: 'south_central' },
  '979': { state: 'TX', region: 'south_central' },

  
  '208': { state: 'ID', region: 'mountain' },
  '303': { state: 'CO', region: 'mountain' },
  '307': { state: 'WY', region: 'mountain' },
  '385': { state: 'UT', region: 'mountain' },
  '435': { state: 'UT', region: 'mountain' },
  '480': { state: 'AZ', region: 'mountain' },
  '505': { state: 'NM', region: 'mountain' },
  '520': { state: 'AZ', region: 'mountain' },
  '575': { state: 'NM', region: 'mountain' },
  '602': { state: 'AZ', region: 'mountain' },
  '623': { state: 'AZ', region: 'mountain' },
  '702': { state: 'NV', region: 'mountain' },
  '719': { state: 'CO', region: 'mountain' },
  '720': { state: 'CO', region: 'mountain' },
  '725': { state: 'NV', region: 'mountain' },
  '801': { state: 'UT', region: 'mountain' },
  '928': { state: 'AZ', region: 'mountain' },
  '970': { state: 'CO', region: 'mountain' },

  
  '206': { state: 'WA', region: 'pacific' },
  '209': { state: 'CA', region: 'pacific' },
  '213': { state: 'CA', region: 'pacific' },
  '253': { state: 'WA', region: 'pacific' },
  '279': { state: 'CA', region: 'pacific' },
  '310': { state: 'CA', region: 'pacific' },
  '323': { state: 'CA', region: 'pacific' },
  '350': { state: 'CA', region: 'pacific' },
  '360': { state: 'WA', region: 'pacific' },
  '408': { state: 'CA', region: 'pacific' },
  '415': { state: 'CA', region: 'pacific' },
  '425': { state: 'WA', region: 'pacific' },
  '442': { state: 'CA', region: 'pacific' },
  '503': { state: 'OR', region: 'pacific' },
  '509': { state: 'WA', region: 'pacific' },
  '510': { state: 'CA', region: 'pacific' },
  '530': { state: 'CA', region: 'pacific' },
  '541': { state: 'OR', region: 'pacific' },
  '559': { state: 'CA', region: 'pacific' },
  '562': { state: 'CA', region: 'pacific' },
  '619': { state: 'CA', region: 'pacific' },
  '626': { state: 'CA', region: 'pacific' },
  '628': { state: 'CA', region: 'pacific' },
  '650': { state: 'CA', region: 'pacific' },
  '657': { state: 'CA', region: 'pacific' },
  '661': { state: 'CA', region: 'pacific' },
  '669': { state: 'CA', region: 'pacific' },
  '707': { state: 'CA', region: 'pacific' },
  '714': { state: 'CA', region: 'pacific' },
  '747': { state: 'CA', region: 'pacific' },
  '760': { state: 'CA', region: 'pacific' },
  '775': { state: 'NV', region: 'mountain' },
  '805': { state: 'CA', region: 'pacific' },
  '818': { state: 'CA', region: 'pacific' },
  '831': { state: 'CA', region: 'pacific' },
  '858': { state: 'CA', region: 'pacific' },
  '909': { state: 'CA', region: 'pacific' },
  '916': { state: 'CA', region: 'pacific' },
  '925': { state: 'CA', region: 'pacific' },
  '949': { state: 'CA', region: 'pacific' },
  '951': { state: 'CA', region: 'pacific' },
  '971': { state: 'OR', region: 'pacific' },

  
  '907': { state: 'AK', region: 'pacific' },
  '808': { state: 'HI', region: 'pacific' },
}


export function getAreaCodeInfo(areaCode: string | null | undefined): AreaCodeInfo | null {
  if (!areaCode) return null
  return AREA_CODES[areaCode] ?? null
}


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