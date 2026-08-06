// =============================================================================
// COMPETITOR REGISTRY
// =============================================================================
// One record per tool we compare against, and the single source those facts
// come from.
//
// WHY THIS FILE EXISTS: the entire discoverability strategy rests on saying the
// same thing everywhere. When a model sees identical pricing and identical
// claims on our comparison pages, our markdown mirrors, our llms-full.txt and a
// third-party listing, it treats the fact as confirmed and repeats it. When the
// numbers drift between surfaces, it hedges — or picks the competitor's
// version. Hardcoding the same claim in a dozen page files guarantees drift the
// first time a competitor changes a price.
//
// Every figure below already appears on the corresponding /vs/<slug> page. This
// file did not invent any of them; it centralises them so the next edit lands
// everywhere at once.
//
// A NOTE ON HONESTY: `wins` is not a courtesy. A comparison page that claims
// the competitor is worse at everything reads as marketing and converts worse
// than one that concedes the obvious. It is also the thing that makes the
// pairwise pages worth publishing at all — see app/vs/[matchup].
// =============================================================================

export interface Competitor {
  slug: string
  name: string
  /** One line, used as the meta description seed and the markdown summary. */
  summary: string
  /** What the buyer actually pays, phrased exactly as the /vs page phrases it. */
  pricing: string
  /** Billing cadence and lock-in. */
  contract: string
  /** Which dialer modes are reachable, and at what cost. */
  dialing: string
  /** Genuine strengths. Concede these. */
  wins: string[]
  /** Where a buyer typically gets caught out. */
  friction: string[]
  /** Who this tool is genuinely the right answer for. */
  bestFor: string
  /**
   * Do buyers actually cross-shop this against other tools on this list?
   * Only true-for-true pairs get a pairwise page — see the comment in
   * app/vs/[matchup]/page.tsx on why we do not generate all of them.
   */
  crossShopped: boolean
}

export const DIALERSEAT = {
  name: 'DialerSeat',
  pricing: '$35 per seat per week on Pro. $75 per week on Manager+, which adds team ownership and white-labeling.',
  contract: 'Billed weekly. No contract, no setup fee, cancel any week. Lead data is preserved if a subscription lapses.',
  dialing: 'Preview, power, progressive, and predictive — all four included at the base price, selectable per campaign.',
  wins: [
    'Every dialer mode included at one price, with no tier to climb',
    'Weekly billing with no annual commitment and no implementation fee',
    'Self-serve signup — no demo required to see pricing or start dialing',
    'Server-side TCPA calling-window enforcement per lead state',
    'FTC Telemarketing Sales Rule 3% abandon-rate cap enforced in predictive',
    'Unlimited numbers with STIR/SHAKEN A-attestation and CNAM registration',
    'Multiple scripts per campaign with live mid-call switching',
    'White-label reseller option on Manager+',
  ],
  friction: [
    'Newer product with a smaller review footprint than the incumbents',
    'National DNC scrubbing and consent records remain the customer’s responsibility',
    'No built-in lead marketplace — bring your own list',
  ],
  bestFor:
    'Solo agents through mid-size floors who dial daily, want every mode included, and refuse an annual contract.',
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'readymode',
    name: 'ReadyMode',
    summary:
      'A long-established predictive dialer for call centers, sold with an onboarding process and a setup fee.',
    pricing: 'Per-seat pricing quoted on contact, commonly with a $500–$2,000 setup fee.',
    contract: 'Annual contract is typical.',
    dialing: 'Predictive dialing is the core product.',
    wins: [
      'Deep, mature call-center feature set',
      'Established in the industry with a long operating history',
      'Built-in CRM many teams run their whole operation on',
    ],
    friction: [
      'Setup fee before the first call',
      'Annual commitment',
      'Interface and device support show their age',
    ],
    bestFor: 'Established call centers that want a single system of record and will absorb onboarding.',
    crossShopped: true,
  },
  {
    slug: 'mojo',
    name: 'Mojo Dialer',
    summary:
      'The default dialer in residential real estate, known for triple-line dialing and bundled lead data.',
    pricing:
      'Roughly $10/month per Agent Access licence plus a dialer plan, with lead-data add-ons commonly $25–$49/month.',
    contract: 'Month to month.',
    dialing: 'Up to triple-line power dialing.',
    wins: [
      'Bundled lead data (FSBO, expired, neighbourhood search) in one place',
      'Very well known among residential real-estate agents',
      'Straightforward for a single agent to get running',
    ],
    friction: [
      'Add-on pricing means the headline is rarely the real bill',
      'Triple-line power dialing is not true multi-line predictive',
      'Strongest fit is real estate specifically',
    ],
    bestFor: 'Residential real-estate agents who want dialer and lead data from one vendor.',
    crossShopped: true,
  },
  {
    slug: 'phoneburner',
    name: 'PhoneBurner',
    summary: 'A polished single-line power dialer with a strong reputation for call quality and deliverability.',
    pricing: 'Per-seat monthly pricing, with some capability behind higher tiers.',
    contract: 'Monthly, with annual discounting.',
    dialing: 'Single-line power dialing only — no multi-line predictive.',
    wins: [
      'Excellent call quality and no connection delay on answer',
      'Very well regarded on review sites',
      'Clean, quick-to-learn interface',
    ],
    friction: [
      'Single-line only, which caps dials per hour',
      'Higher tiers required for some capability',
      'List-size handling can constrain large campaigns',
    ],
    bestFor: 'Consultative sellers who value connection quality over raw dial volume.',
    crossShopped: true,
  },
  {
    slug: 'five9',
    name: 'Five9',
    summary: 'Enterprise contact-center software sold through a sales cycle, aimed at large floors.',
    pricing: 'Not published. Quotes commonly land at $175+ per seat per month.',
    contract: 'Multi-year commitments and implementation fees are typical.',
    dialing: 'Full predictive and blended contact-center dialing.',
    wins: [
      'Genuine enterprise depth — WFM, QA, omnichannel, reporting',
      'Established compliance and security posture for regulated buyers',
      'Support and implementation resources a large floor needs',
    ],
    friction: [
      'No public pricing; a demo cycle of one to four weeks before a number',
      'Implementation fees on top of seat cost',
      'Overbuilt for teams under roughly fifty seats',
    ],
    bestFor: 'Contact centers of 50–500+ seats with procurement and a dedicated ops function.',
    crossShopped: true,
  },
  {
    slug: 'convoso',
    name: 'Convoso',
    summary: 'A strong predictive dialer built for larger outbound operations, quoted per deployment.',
    pricing: 'Custom quotes, usage-billed.',
    contract: 'Contract terms are negotiated; a seat minimum applies.',
    dialing: 'Predictive dialing with sophisticated pacing.',
    wins: [
      'Genuinely strong predictive pacing and lead management',
      'Built for high-volume outbound teams',
      'Good reporting for floor managers',
    ],
    friction: [
      'No public pricing',
      'Aimed at roughly 20+ seat operations',
      'Usage billing makes the monthly cost harder to predict',
    ],
    bestFor: 'Outbound floors of 20+ seats that need aggressive pacing and will negotiate a contract.',
    crossShopped: true,
  },
  {
    slug: 'batchdialer',
    name: 'BatchDialer',
    summary: 'A multi-line dialer aimed at real-estate investors, with a headline rate tied to annual prepay.',
    pricing: 'Advertised around $95/seat on annual prepay; month to month is roughly $119–$249.',
    contract: 'The headline price requires annual prepay.',
    dialing: 'Multi-line dialing, with number cycling on higher plans.',
    wins: [
      'Strong fit for real-estate investors and wholesalers',
      'Multi-line dialing with list management built in',
      'Integrated with the wider BatchLeads data ecosystem',
    ],
    friction: [
      'Advertised price is the annual-prepay rate, not the month-to-month one',
      'Features such as number cycling are tiered',
      'Cost climbs quickly off the prepay plan',
    ],
    bestFor: 'Real-estate investors already inside the BatchLeads ecosystem.',
    crossShopped: true,
  },
  {
    slug: 'wavv',
    name: 'WAVV',
    summary: 'A dialer that embeds inside an existing CRM rather than replacing it.',
    pricing: 'From $59/month; the Multi Line plan required for predictive is $149/month, plus $1/month per number.',
    contract: 'Monthly.',
    dialing: 'Predictive requires the $149/month Multi Line plan.',
    wins: [
      'Embeds directly into CRMs teams already use',
      'No migration required — the CRM stays the system of record',
      'Reasonable entry price for single-line use',
    ],
    friction: [
      'Predictive sits behind the top plan',
      'Per-number monthly charges on top of the seat',
      'Value depends on already using a supported CRM',
    ],
    bestFor: 'Teams committed to a CRM who want dialing inside it.',
    crossShopped: true,
  },
  {
    slug: 'kixie',
    name: 'Kixie',
    summary: 'A well-reviewed sales phone system with dialing power tiered by price.',
    pricing: 'Multi-line dialing runs $95+ per seat per month.',
    contract: 'Monthly, with annual discounting.',
    dialing: 'Single-line at lower tiers; multi-line at $95+/seat/month.',
    wins: [
      'Excellent CRM integrations, especially HubSpot',
      'Strong review scores and responsive support',
      'Local-presence dialing and SMS handled well',
    ],
    friction: [
      'Multi-line dialing requires a high tier',
      'Cost per seat climbs steeply with capability',
    ],
    bestFor: 'HubSpot-centric sales teams that want tight CRM coupling.',
    crossShopped: true,
  },
  {
    slug: 'orum',
    name: 'Orum',
    summary: 'A premium parallel dialer aimed at funded SDR organisations.',
    pricing: 'Around $250 per user per month billed annually; pricing is not published.',
    contract: 'Annual, with a three-seat minimum.',
    dialing: 'Parallel dialing with AI-assisted navigation.',
    wins: [
      'Very fast parallel dialing and smooth connect experience',
      'Well-built for structured SDR teams',
      'Strong integrations with the modern sales stack',
    ],
    friction: [
      'Among the most expensive options per seat',
      'Annual billing with a three-seat minimum',
      'No public pricing',
    ],
    bestFor: 'Funded SDR teams where a rep’s hour is worth far more than the seat.',
    crossShopped: true,
  },
  {
    slug: 'justcall',
    name: 'JustCall',
    summary: 'A business phone system with dialing available on its higher tiers.',
    pricing: 'Advertised from $29/user/month; power and predictive dialing sit on the $49+ Pro tier.',
    contract: 'Monthly, with a two-seat minimum on standard plans.',
    dialing: 'Power and predictive on Pro and above.',
    wins: ['Broad integration catalogue', 'Solid SMS and shared-inbox features', 'Good international coverage'],
    friction: ['Dialer is behind a higher tier', 'Two-seat minimum', 'Advertised price excludes the dialer'],
    bestFor: 'Teams that want one vendor for calls, SMS, and light dialing.',
    crossShopped: true,
  },
  {
    slug: 'cloudtalk',
    name: 'CloudTalk',
    summary: 'A call-center phone system where dialing is a paid add-on.',
    pricing: 'From $19/seat; Power Dialer is +$15/seat/month and Parallel Dialer is +$39/seat/month.',
    contract: 'Monthly, with annual discounting.',
    dialing: 'Add-on modules per dialing type.',
    wins: ['Strong international numbers', 'Clean analytics', 'Low entry price for basic telephony'],
    friction: ['Dialing is an add-on on top of the seat', 'The real cost is well above the headline'],
    bestFor: 'Distributed support or sales teams whose main need is telephony, not volume dialing.',
    crossShopped: true,
  },
  {
    slug: 'aircall',
    name: 'Aircall',
    summary: 'A popular business phone system with the Power Dialer on its Professional tier.',
    pricing: '$30/seat Essentials excludes the Power Dialer; Professional at $50/seat includes it.',
    contract: 'Monthly or annual, with a three-licence minimum.',
    dialing: 'Power Dialer on Professional and above. No predictive.',
    wins: ['Very polished product', 'Large integration marketplace', 'Reliable and well supported'],
    friction: ['Power Dialer requires the $50 tier', 'Three-licence minimum', 'No predictive dialing'],
    bestFor: 'Teams that primarily need a great phone system, with light outbound.',
    crossShopped: true,
  },
  {
    slug: 'dialpad',
    name: 'Dialpad',
    summary: 'A unified communications platform where the dialer lives in a separate product.',
    pricing: 'Dialpad Connect is $15–$35/user/month; the dialer is in Dialpad Sell, from around $39/user/month.',
    contract: 'Monthly or annual.',
    dialing: 'No power dialer in Connect at any tier; dialing requires Sell.',
    wins: ['Excellent voice AI and transcription', 'Strong UCaaS feature set', 'Good meetings and messaging'],
    friction: ['Two products to buy outbound dialing', 'Sell is priced separately from the phone system'],
    bestFor: 'Companies standardising on one communications platform company-wide.',
    crossShopped: false,
  },
  {
    slug: '3cx',
    name: '3CX',
    summary: 'A business PBX licensed by simultaneous call capacity, not a sales dialer.',
    pricing: 'Licensed by simultaneous call capacity rather than per seat.',
    contract: 'Annual licensing.',
    dialing: 'Not an outbound sales dialer — no lead lists, dispositions, or AMD.',
    wins: ['Very cost-effective as a PBX', 'Self-hostable', 'Mature telephony feature set'],
    friction: [
      'Solves a different problem — it is a phone system, not a dialer',
      'No lead management, dispositions, or answering-machine detection',
      'Capacity planning required',
    ],
    bestFor: 'Organisations that need a PBX and will run outbound some other way.',
    crossShopped: false,
  },
]

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find(c => c.slug === slug)
}

/**
 * The pairs we publish a head-to-head page for.
 *
 * DELIBERATELY NOT EVERY PAIR. Fourteen competitors is 91 combinations, and
 * most of them describe a decision nobody is actually making — 3CX versus Orum
 * is not a shortlist anyone holds. Generating all of them would be textbook
 * doorway content: near-identical pages built for a crawler rather than a
 * reader, which is exactly what thin-content penalties exist to catch.
 *
 * Restricting to genuinely cross-shopped tools keeps every page a real answer
 * to a real question, which is also the only version that earns links.
 */
export function crossShoppedPairs(): Array<[Competitor, Competitor]> {
  const pool = COMPETITORS.filter(c => c.crossShopped)
  const pairs: Array<[Competitor, Competitor]> = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      pairs.push([pool[i], pool[j]])
    }
  }
  return pairs
}

/** URL slug for a head-to-head, always in registry order so it is stable. */
export function matchupSlug(a: Competitor, b: Competitor): string {
  return `${a.slug}-vs-${b.slug}`
}
