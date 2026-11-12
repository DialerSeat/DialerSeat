// =============================================================================
// OUTBOUND CALLING RULES BY US STATE
// =============================================================================
// The dataset behind /data/calling-rules-by-state, the state-level companion to
// lib/countryRules.ts and built the same way: every statement has a source in
// `sources`, read from the state's own statute or agency site, and a rule we
// could not read there is left out rather than filled in. A state with one
// verified rule gets a page with one rule.
//
// A state's own Do Not Call list (who runs it, the fee, how often it changes)
// lives in components/tools/StateDncTable.tsx, checked 2026-11-05, and the
// state page shows it from there so the two cannot disagree. `list: true`
// marks the states that have one.
//
// Federal rules apply in every state on top of these; the page says so and
// links them. NOT LEGAL ADVICE, and the page says so.
// =============================================================================

export const STATE_RULES_CHECKED = '2026-11-12'

export interface StateRule {
  code: string
  name: string
  /** Has its own Do Not Call list, shown from StateDncTable. */
  list?: boolean
  /** A note on Do Not Call lists for a state without its own. */
  dnc?: string
  hours?: string
  /** How often the same person may be called. */
  limits?: string
  /** Consent needed for autodialed or prerecorded calls. */
  consent?: string
  /** What has to be said or shown on the call. */
  identify?: string
  /** What to do when the person asks not to be called. */
  onRequest?: string
  /** Licensing or registration before calling into the state. */
  registration?: string
  penalties?: string
  sources: { label: string; url: string }[]
}

export const STATE_RULES: StateRule[] = [
  {
    code: 'CO',
    name: 'Colorado',
    list: true,
    sources: [{ label: 'Colorado No-Call program (PUC)', url: 'https://puc.colorado.gov/coloradonocall' }],
  },
  {
    code: 'FL',
    name: 'Florida',
    list: true,
    hours: 'No commercial telephone solicitation before 8 a.m. or after 8 p.m. in the called person’s time zone, including calls made with automated dialing or recorded messages (section 501.616).',
    limits: 'No more than three commercial telephone solicitation calls to the same person in 24 hours on the same subject, from any number (section 501.616).',
    consent:
      'An unsolicited sales call made with an automated system that selects and dials numbers, or that plays a recorded message, needs the called party’s prior express written consent: a written agreement they have signed (section 501.059).',
    identify:
      'Transmit the originating number and, when the carrier offers it, the caller’s name. The seller’s name and customer service number may be shown instead, and the number shown must reach the caller or the seller when called back (section 501.059).',
    registration: 'Commercial telephone sellers and salespeople must be licensed (section 501.616).',
    penalties:
      'The person called can sue for actual damages or $500, whichever is greater, and up to three times that for a willful or knowing violation. The winning side recovers attorney fees (section 501.059).',
    sources: [
      { label: 'Florida Statutes section 501.059', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.059.html' },
      { label: 'Florida Statutes section 501.616', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.616.html' },
      { label: 'Florida Do Not Call (FDACS)', url: 'https://www.fdacs.gov/Business-Services/Florida-Do-Not-Call' },
    ],
  },
  {
    code: 'IN',
    name: 'Indiana',
    list: true,
    sources: [{ label: 'Indiana Do Not Call: telephone solicitors (Attorney General)', url: 'https://www.in.gov/attorneygeneral/consumer-protection-division/id-theft-prevention/do-not-call/telephone-solicitors/' }],
  },
  {
    code: 'LA',
    name: 'Louisiana',
    list: true,
    sources: [{ label: 'Louisiana Do Not Call FAQ (Public Service Commission)', url: 'https://lpsc.louisiana.gov/DNC_ConsumerFAQ' }],
  },
  {
    code: 'MD',
    name: 'Maryland',
    hours: 'No telephone solicitation between 8 p.m. and 8 a.m. in the called party’s time zone, including calls made with automated dialing or recorded messages (section 14-4502).',
    limits: 'No more than three calls to the same person in 24 hours on the same subject, whatever numbers are used (section 14-4502).',
    consent:
      'A telephone solicitation that uses an automated system to select or dial numbers, or that plays a recorded message, needs the called party’s prior express written consent (section 14-4502).',
    identify: 'Transmit the originating number or the seller’s customer service number (section 14-4502).',
    penalties:
      'The person called can sue for up to $500 or actual damages, whichever is greater, and up to three times that for a willful or knowing violation. A call to any Maryland area code is presumed to reach a Maryland resident (section 14-4503).',
    sources: [
      { label: 'Maryland Commercial Law section 14-4502', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502&enactments=false' },
      { label: 'Maryland Commercial Law section 14-4503', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4503&enactments=false' },
    ],
  },
  {
    code: 'MA',
    name: 'Massachusetts',
    list: true,
    sources: [{ label: 'Massachusetts Do Not Call registry', url: 'https://www.mass.gov/info-details/do-not-call-registry-for-residents-and-businesses' }],
  },
  {
    code: 'MO',
    name: 'Missouri',
    list: true,
    sources: [{ label: 'Missouri No-Call: FAQs for telemarketers (Attorney General)', url: 'https://ago.mo.gov/get-help/no-call/faqs-for-telemarketers/' }],
  },
  {
    code: 'OK',
    name: 'Oklahoma',
    list: true,
    sources: [{ label: 'Oklahoma Telemarketer Restriction Act (Attorney General)', url: 'https://oklahoma.gov/oag/resources/telemarketer-restriction-act.html' }],
  },
  {
    code: 'PA',
    name: 'Pennsylvania',
    list: true,
    sources: [{ label: 'Pennsylvania Do Not Call (Attorney General)', url: 'https://www.attorneygeneral.gov/protect-yourself/do-not-call' }],
  },
  {
    code: 'TN',
    name: 'Tennessee',
    list: true,
    sources: [{ label: 'Tennessee Do Not Call: telemarketer FAQs (TPUC)', url: 'https://www.tn.gov/tpuc/tennessee-do-not-call-program/csd-tn-do-not-call-telemarketer-faqs.html' }],
  },
  {
    code: 'TX',
    name: 'Texas',
    list: true,
    sources: [{ label: 'Texas No-Call (Public Utility Commission)', url: 'https://www.puc.texas.gov/consumer/phone/telemarket_faq.aspx' }],
  },
  {
    code: 'WA',
    name: 'Washington',
    dnc: 'Calling a number on the federal Do Not Call Registry also breaks state law (RCW 80.36.390).',
    hours: 'No calls received before 8:00 a.m. or after 8:00 p.m. in the recipient’s local time (RCW 80.36.390).',
    identify: 'Within the first 30 seconds, give your name, the company or organization you are calling for and the purpose of the call (RCW 80.36.390).',
    onRequest:
      'If the person asks not to be called, tell them their details will be removed for at least one year, end the call within 10 seconds, do not call any number they asked to be removed for at least one year, and do not pass their details to anyone else (RCW 80.36.390).',
    sources: [{ label: 'RCW 80.36.390 (Washington Legislature)', url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=80.36.390' }],
  },
  {
    code: 'WY',
    name: 'Wyoming',
    list: true,
    sources: [{ label: 'Wyoming telephone solicitation for businesses (Attorney General)', url: 'https://attorneygeneral.wyo.gov/law-office-division/consumer-protection-and-antitrust-unit/telephone-solicitation-for-businesses' }],
  },
]
