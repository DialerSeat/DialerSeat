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
   * What it takes to add one more agent.
   *
   * This is the field the team comparison runs on, and it is deliberately
   * about FRICTION rather than price. A manager comparing tools already knows
   * the headline rate; what decides the purchase is whether adding a seat is
   * an afternoon decision or a procurement event.
   */
  team: {
    /** Smallest purchasable configuration. */
    minimum: string
    /** What actually happens when you want one more agent. */
    addingASeat: string
    /** Approximate monthly cost of a five-agent floor, stated as the vendor states it. */
    fiveSeats: string
  }
  /**
   * Do buyers actually cross-shop this against other tools on this list?
   * Necessary but not sufficient for a pairwise page — see segment below.
   */
  crossShopped: boolean
  /**
   * Which shortlist this tool actually appears on.
   *
   * crossShopped alone was a blanket flag, and blanket flags do not scale: at
   * 17 flagged tools it authorises 136 head-to-head pages, most describing a
   * decision nobody is making. "smrtPhone vs 3CX" is not a shortlist. Pairing
   * within a segment keeps every generated page a real question.
   *
   *   call_center   High-volume predictive floors
   *   sales_crm     CRM-attached dialers for sales teams
   *   real_estate   Real-estate and investor-focused tools
   *   phone_system  PBX / UCaaS platforms that are not really dialers
   */
  segment: 'call_center' | 'sales_crm' | 'real_estate' | 'phone_system'
}

// ── ONLY CLAIMS ABOUT OURSELVES ──────────────────────────────────────────
// The trial is stated on DialerSeat's own record and NOWHERE on a
// competitor's. Whether ReadyMode or Convoso offer a trial is not something
// this repo knows, and "they don't" is a factual assertion about another
// company on a page built to be quoted. The comparison earns its credibility
// by conceding what rivals are genuinely good at; inventing an absence to win
// a row would spend that in one line.
export const DIALERSEAT = {
  name: 'DialerSeat',
  pricing: '$35 per seat per week on Pro. $75 per week on Manager+, which adds team ownership and white-labeling.',
  contract: 'Billed weekly from day one: no trial, no contract, no setup fee, cancel any week. Lead data is preserved if a subscription lapses.',
  dialing: 'Preview, power, progressive, and predictive: all four included at the base price, selectable per campaign.',
  wins: [
    'Every dialer mode included at one price, with no tier to climb',
    'Weekly billing with no annual commitment and no implementation fee',
    'Self-serve signup: no demo, no sales call, no quote to see pricing',
    'Self-serve signup: no demo required to see pricing or start dialing',
    'Server-side TCPA calling-window enforcement per lead state',
    'FTC Telemarketing Sales Rule 3% abandon-rate cap enforced in predictive',
    'Unlimited numbers with STIR/SHAKEN A-attestation and CNAM registration',
    'Multiple scripts per campaign with live mid-call switching',
    'White-label reseller option on Manager+',
  ],
  friction: [
    'Newer product with a smaller review footprint than the incumbents',
    'National DNC scrubbing and consent records remain the customer’s responsibility',
    'No built-in lead marketplace: bring your own list',
  ],
  bestFor:
    'Solo agents through mid-size floors who dial daily, want every mode included, and refuse an annual contract.',
  team: {
    minimum: 'One seat',
    addingASeat: 'Send a join code. The seat is live the moment they accept, and the owner chooses who pays.',
    fiveSeats: '$175/week in seats plus $75/week for the Manager+ owner: all four dialer modes included, no contract. Seats bill from the day they open.',
  },
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'readymode',
    name: 'ReadyMode',
    summary:
      'A long-established predictive dialer for call centers, sold with an onboarding process and a setup fee.',
    pricing: 'Per-seat pricing quoted on contact, commonly with a $500-$2,000 setup fee.',
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
    team: {
      minimum: 'Quoted per deployment',
      addingASeat: 'Contact the vendor; setup fee applies before the first call',
      fiveSeats: 'Quoted, plus a $500-$2,000 setup fee',
    },
    crossShopped: true,
    segment: 'call_center',
  },
  {
    slug: 'mojo',
    name: 'Mojo Dialer',
    summary:
      'The default dialer in residential real estate, known for triple-line dialing and bundled lead data.',
    pricing:
      'Roughly $10/month per Agent Access licence plus a dialer plan, with lead-data add-ons commonly $25-$49/month.',
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
    team: {
      minimum: 'One agent',
      addingASeat: "Add an Agent Access licence, roughly $10/month, plus that agent's dialer plan",
      fiveSeats: 'Dialer plans plus ~$10/agent, before lead-data add-ons',
    },
    crossShopped: true,
    segment: 'real_estate',
  },
  {
    slug: 'phoneburner',
    name: 'PhoneBurner',
    summary: 'A polished single-line power dialer with a strong reputation for call quality and deliverability.',
    pricing: 'Per-seat monthly pricing, with some capability behind higher tiers.',
    contract: 'Monthly, with annual discounting.',
    dialing: 'Single-line power dialing only, no multi-line predictive.',
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
    team: {
      minimum: 'One user',
      addingASeat: 'Add a paid user at the standard per-seat monthly rate',
      fiveSeats: 'Five per-seat monthly licences',
    },
    crossShopped: true,
    segment: 'sales_crm',
  },
  {
    slug: 'five9',
    name: 'Five9',
    summary: 'Enterprise contact-center software sold through a sales cycle, aimed at large floors.',
    pricing: 'Not published. Quotes commonly land at $175+ per seat per month.',
    contract: 'Multi-year commitments and implementation fees are typical.',
    dialing: 'Full predictive and blended contact-center dialing.',
    wins: [
      'Genuine enterprise depth: WFM, QA, omnichannel, reporting',
      'Established compliance and security posture for regulated buyers',
      'Support and implementation resources a large floor needs',
    ],
    friction: [
      'No public pricing; a demo cycle of one to four weeks before a number',
      'Implementation fees on top of seat cost',
      'Overbuilt for teams under roughly fifty seats',
    ],
    bestFor: 'Contact centers of 50-500+ seats with procurement and a dedicated ops function.',
    team: {
      minimum: 'Enterprise-scale',
      addingASeat: 'A sales conversation and a revised contract',
      fiveSeats: 'Not published; quotes commonly land at $175+ per seat per month',
    },
    crossShopped: true,
    segment: 'call_center',
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
    team: {
      minimum: 'Seat minimum applies',
      addingASeat: 'Renegotiate the quote; usage billing changes with volume',
      fiveSeats: 'Custom quote, usage-billed',
    },
    crossShopped: true,
    segment: 'call_center',
  },
  {
    slug: 'batchdialer',
    name: 'BatchDialer',
    summary: 'A multi-line dialer aimed at real-estate investors, with a headline rate tied to annual prepay.',
    pricing: 'Advertised around $95/seat on annual prepay; month to month is roughly $119-$249.',
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
    team: {
      minimum: 'One seat',
      addingASeat: 'Add a seat at the prepay or month-to-month rate',
      fiveSeats: '~$475 on annual prepay, or roughly $595-$1,245 month to month',
    },
    crossShopped: true,
    segment: 'real_estate',
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
      'No migration required: the CRM stays the system of record',
      'Reasonable entry price for single-line use',
    ],
    friction: [
      'Predictive sits behind the top plan',
      'Per-number monthly charges on top of the seat',
      'Value depends on already using a supported CRM',
    ],
    bestFor: 'Teams committed to a CRM who want dialing inside it.',
    team: {
      minimum: 'One user',
      addingASeat: 'Add a user, plus $1/month for each additional number',
      fiveSeats: '$149/month Multi Line for predictive, plus per-number charges',
    },
    crossShopped: true,
    segment: 'real_estate',
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
    team: {
      minimum: 'One user',
      addingASeat: 'Add a user at the tier your dialing needs, which for multi-line is $95+',
      fiveSeats: '$475+/month at the multi-line tier',
    },
    crossShopped: true,
    segment: 'sales_crm',
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
    team: {
      minimum: 'Three seats',
      addingASeat: 'Amend the annual contract',
      fiveSeats: '~$1,250/month, billed annually',
    },
    crossShopped: true,
    segment: 'sales_crm',
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
    team: {
      minimum: 'Two seats',
      addingASeat: 'Add a user on the Pro tier or above',
      fiveSeats: '$245+/month on the tier that includes dialing',
    },
    crossShopped: true,
    segment: 'sales_crm',
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
    team: {
      minimum: 'One seat',
      addingASeat: 'Add a seat, plus the dialer add-on per seat',
      fiveSeats: '$95 in seats plus $75-$195 in dialer add-ons',
    },
    crossShopped: true,
    segment: 'phone_system',
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
    team: {
      minimum: 'Three licences',
      addingASeat: 'Add a licence on Professional to keep the Power Dialer',
      fiveSeats: '$250/month on Professional',
    },
    crossShopped: true,
    segment: 'phone_system',
  },
  {
    slug: 'dialpad',
    name: 'Dialpad',
    summary: 'A unified communications platform where the dialer lives in a separate product.',
    pricing: 'Dialpad Connect is $15-$35/user/month; the dialer is in Dialpad Sell, from around $39/user/month.',
    contract: 'Monthly or annual.',
    dialing: 'No power dialer in Connect at any tier; dialing requires Sell.',
    wins: ['Excellent voice AI and transcription', 'Strong UCaaS feature set', 'Good meetings and messaging'],
    friction: ['Two products to buy outbound dialing', 'Sell is priced separately from the phone system'],
    bestFor: 'Companies standardising on one communications platform company-wide.',
    team: {
      minimum: 'One user',
      addingASeat: 'Add a Dialpad Sell licence, separate from the phone system',
      fiveSeats: '~$195/month for Sell, on top of Connect',
    },
    crossShopped: false,
    segment: 'phone_system',
  },
  {
    slug: 'vicidial',
    name: 'VICIdial',
    summary:
      'The open-source predictive dialer that runs a large share of the world’s call-centre floors. Free software, paid everything else.',
    pricing:
      'The software is free under the AGPL. Official VICIhost managed hosting is about $400/month per server after a $1,000 setup, roughly $16 per user at 25 agents. Third-party hosts charge $100-$149 per agent per month.',
    contract:
      'None for the software itself. Hosting and SIP trunking are separate contracts with separate vendors.',
    dialing:
      'Predictive, power, preview and manual, all included. Ratio, drop rate and hopper depth are directly configurable, more control than most commercial products expose.',
    wins: [
      'Genuinely free software with no per-seat licence, ever',
      'The deepest configurability in outbound dialing: nearly every pacing parameter is exposed',
      'Enormous install base, so almost any problem has already been solved on a forum',
      'Cheapest per-agent cost in the industry once you are past roughly 100 agents',
      'No vendor can raise your price, deprecate your setup, or lock your data in',
    ],
    friction: [
      'Free software is not a free system: published TCO lands at $130-$400+ per agent per month once servers, SIP trunking and administration are counted',
      'A dedicated VICIdial administrator is a real hire; industry salary data puts the median near $97,000 a year',
      'Below about 30 agents the operational overhead eats the savings entirely',
      'Compliance is yours to build: calling windows, DNC scrubbing and abandon-rate control are configuration, not guarantees',
      'You own uptime. A dialer that is down mid-shift is your emergency at 9am',
    ],
    bestFor:
      'Floors of 30+ agents with a competent telephony administrator on staff who want total control and the lowest possible cost at scale.',
    team: {
      minimum: 'One server, however many agents it holds',
      addingASeat:
        'Free in licence terms, add a user in the admin panel. The real limit is server capacity and trunk concurrency, which you plan and pay for yourself.',
      fiveSeats:
        'No licence cost. In practice a server, SIP trunking and someone who can run it, which is why published TCO starts around $130/agent/month.',
    },
    crossShopped: true,
    segment: 'call_center',
  },
  {
    slug: 'calltools',
    name: 'CallTools',
    summary:
      'A predictive-dialing contact-centre platform sold through sales, with setup and integration fees on top of the seat price.',
    pricing:
      'Roughly $119.99 per user per month month-to-month, or about $101.99 annually. Quote-based, so the published figure is a starting point.',
    contract: 'Month-to-month available; annual pricing is materially cheaper.',
    dialing: 'Predictive and preview dialing are core to the product.',
    wins: [
      'Mature predictive engine with real contact-centre reporting',
      'Built-in CRM and list management',
      'Month-to-month is genuinely available, not just annual',
    ],
    friction: [
      'Setup fees are commonly $500-$1,500 before the first call',
      'Complex CRM integrations are quoted separately, reportedly $2,000-$5,000',
      'Pricing is quote-based, so the real number requires a sales conversation',
      'SMS is billed separately per message',
    ],
    bestFor: 'Established outbound teams that want a full contact-centre platform and will absorb onboarding.',
    team: {
      minimum: 'Quoted per deployment',
      addingASeat: 'Contact the vendor to add a licence',
      fiveSeats: 'Roughly $510-$600/month in seats at published rates, before setup and integration fees',
    },
    crossShopped: true,
    segment: 'call_center',
  },
  {
    slug: 'dialedin',
    name: 'DialedIn',
    summary:
      'Formerly ChaseData. A long-running cloud contact-centre product covering inbound and outbound in one system.',
    pricing: 'Published starting price around $89 per user per month.',
    contract: 'Per-user subscription; terms vary by plan.',
    dialing: 'Predictive, progressive and preview dialing across its tiers.',
    wins: [
      'Publishes a starting price rather than hiding everything behind a demo',
      'Handles inbound and outbound in one platform',
      'Long operating history under the ChaseData name',
    ],
    friction: [
      'The entry price is the entry tier: the outbound features most teams want sit higher up',
      'Feature availability by tier is not obvious until you are in a sales conversation',
      'Interface is functional rather than modern',
    ],
    bestFor: 'Blended inbound/outbound teams that want one vendor for both directions.',
    team: {
      minimum: 'One user',
      addingASeat: 'Add a user licence at the tier you are on',
      fiveSeats: 'From roughly $445/month at the published entry rate',
    },
    crossShopped: true,
    segment: 'call_center',
  },
  {
    slug: 'ringcentral',
    name: 'RingCentral',
    summary:
      'A large business phone system. Outbound dialing lives in a separate contact-centre product, not in the plan most buyers start on.',
    pricing:
      'Core is about $20 per user per month billed annually, or $30 monthly; Advanced $25 and Ultra $35 annually. The RingCX contact-centre product, which is where the dialer lives, starts around $65 per user per month.',
    contract: 'Annual billing is materially cheaper than monthly. Contract terms apply.',
    dialing:
      'Not in the core phone plans, even Ultra requires an add-on. Predictive and progressive dialing come with RingCX, the contact-centre tier.',
    wins: [
      'Enormous, stable company with global carrier infrastructure',
      'Excellent as a business phone system, which is what it actually is',
      'Deep integration catalogue and enterprise compliance certifications',
      'Genuinely useful if you need a full UCaaS platform alongside outbound',
    ],
    friction: [
      'The dialer is not in the plans people quote: reaching it means the contact-centre product at roughly triple the price',
      'Outbound dialer minutes can be metered separately on top of the seat',
      'Sold and priced for organisations with a procurement process',
      'Substantial platform for a team that only wants to dial leads',
    ],
    bestFor: 'Companies that need a full business phone system first and outbound dialing second.',
    team: {
      minimum: 'One user, but the dialer needs the contact-centre product',
      addingASeat: 'Add a licence; the dialer tier is a different product line from the phone plan',
      fiveSeats: 'From roughly $325/month on RingCX at the published starting rate, before usage',
    },
    crossShopped: false,
    segment: 'phone_system',
  },
  {
    slug: 'smrtphone',
    name: 'smrtPhone',
    summary:
      'A phone system built for real-estate investors, tightly integrated with Podio and REI CRMs. The dialer is a paid add-on to the subscription.',
    pricing:
      'Standard $62/month and Pro $104/month billed monthly. smrtDialer is an add-on on top: about $42/seat/month single-line or $75/seat/month multi-line. Call time is then deducted from pre-paid credits, from around $0.02/minute.',
    contract: 'Monthly or annual. Usage runs on a pre-paid credit balance.',
    dialing: 'Single-line and multi-line power dialing, up to four lines.',
    wins: [
      'Purpose-built for real-estate investors, with deep Podio and REI CRM integration',
      'One vendor for calls, texts and CRM plumbing in that niche',
      'Well understood by the wholesaling community',
    ],
    friction: [
      'Three separate charges stack: subscription, dialer seat, then per-minute credits',
      'Multi-line power dialing is not predictive; there is no pacing engine',
      'Usage-based billing makes a heavy dialing day cost more than a light one',
      'Strongest fit is real-estate investing specifically',
    ],
    bestFor: 'Real-estate investors already running Podio or an REI CRM who want calling wired into it.',
    team: {
      minimum: 'One subscription plus one dialer seat',
      addingASeat: 'Add a smrtDialer seat to the subscription, then fund credits for their call time',
      fiveSeats: 'Subscription plus roughly $210-$375/month in dialer seats, before per-minute credits',
    },
    crossShopped: true,
    segment: 'real_estate',
  },
  {
    slug: 'aloware',
    name: 'Aloware',
    summary:
      'A CRM-attached calling and texting platform aimed at sales teams, priced in tiers with AI features bundled in.',
    pricing:
      'iPro + AI about $30 per user per month, uPro + AI about $60, xPro + AI about $85.',
    contract: 'Monthly per-user subscription.',
    dialing: 'Power dialing on the lower tiers; higher tiers add more automation.',
    wins: [
      'Genuinely low entry price for a CRM-integrated dialer',
      'Strong HubSpot and Pipedrive integration',
      'Combined calling and texting in one place',
    ],
    friction: [
      'Ad-hoc charges sit outside the seat price and are documented separately by the vendor',
      'Dialing capability is tiered: the entry plan is not the outbound plan',
      'Built around CRM workflows rather than high-volume list dialing',
    ],
    bestFor: 'Sales teams living inside HubSpot or Pipedrive who want calling and texting attached to it.',
    team: {
      minimum: 'One user',
      addingASeat: 'Add a user at your tier',
      fiveSeats: 'From roughly $150/month at the entry tier, more once outbound features are needed',
    },
    crossShopped: true,
    segment: 'sales_crm',
  },
  {
    slug: 'ytel',
    name: 'Ytel',
    summary:
      'A contact-centre and communications-API platform, priced per seat on top of a platform fee.',
    pricing:
      'Contact Centre Seat around $99/month, Engagement Platform around $399/month, Trust Center around $499/month. Seats are priced per agent on top of a platform fee.',
    contract: 'Per-seat subscription with a platform fee.',
    dialing: 'Predictive and preview dialing in the contact-centre product.',
    wins: [
      'Communications APIs alongside the dialer, useful if you are building on top',
      'Compliance tooling is a named part of the product',
      'Handles voice and SMS at scale',
    ],
    friction: [
      'Platform fee sits on top of per-seat pricing, so small teams pay a disproportionate share',
      'Positioned for larger operations: the economics do not favour a handful of agents',
      'More platform than a team that just wants to dial a list needs',
    ],
    bestFor: 'Larger operations that want a dialer and communications APIs from the same vendor.',
    team: {
      minimum: 'Platform fee plus at least one seat',
      addingASeat: 'Add a seat at roughly $99/month on top of the platform fee',
      fiveSeats: 'Roughly $495/month in seats plus the platform fee',
    },
    crossShopped: false,
    segment: 'call_center',
  },
  {
    slug: '3cx',
    name: '3CX',
    summary: 'A business PBX licensed by simultaneous call capacity, not a sales dialer.',
    pricing: 'Licensed by simultaneous call capacity rather than per seat.',
    contract: 'Annual licensing.',
    dialing: 'Not an outbound sales dialer: no lead lists, dispositions, or AMD.',
    wins: ['Very cost-effective as a PBX', 'Self-hostable', 'Mature telephony feature set'],
    friction: [
      'Solves a different problem: it is a phone system, not a dialer',
      'No lead management, dispositions, or answering-machine detection',
      'Capacity planning required',
    ],
    bestFor: 'Organisations that need a PBX and will run outbound some other way.',
    team: {
      minimum: 'Licensed by call capacity',
      addingASeat: 'Increase the simultaneous-call licence tier',
      fiveSeats: 'Capacity licence: not priced per agent',
    },
    crossShopped: false,
    segment: 'phone_system',
  },
]

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find(c => c.slug === slug)
}

/**
 * The pairs we publish a head-to-head page for.
 *
 * DELIBERATELY NOT EVERY PAIR. Twenty-one competitors is 210 combinations, and
 * most of them describe a decision nobody is actually making — 3CX versus Orum
 * is not a shortlist anyone holds. Generating all of them would be textbook
 * doorway content: near-identical pages built for a crawler rather than a
 * reader, which is exactly what thin-content penalties exist to catch.
 *
 * TWO GATES, because one was not enough. crossShopped says a tool is compared
 * at all; segment says which shortlist it appears on. The flag alone allowed
 * 136 pages the moment the roster grew, including pairs like smrtPhone versus
 * 3CX — a real-estate CRM dialer against a self-hosted PBX, which is not a
 * decision any buyer has ever had to make.
 *
 * Pairing inside a segment keeps every page a real answer to a real question,
 * which is also the only version that earns links.
 */
export function crossShoppedPairs(): Array<[Competitor, Competitor]> {
  const pool = COMPETITORS.filter(c => c.crossShopped)
  const pairs: Array<[Competitor, Competitor]> = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].segment !== pool[j].segment) continue
      pairs.push([pool[i], pool[j]])
    }
  }
  return pairs
}

/** URL slug for a head-to-head, always in registry order so it is stable. */
export function matchupSlug(a: Competitor, b: Competitor): string {
  return `${a.slug}-vs-${b.slug}`
}
