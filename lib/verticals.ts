// =============================================================================
// VERTICALS — one record per industry that buys dialers
// =============================================================================
// The data behind the /faq/dialer-for-<vertical> pages rendered by
// components/VerticalView. Insurance, real estate, call centers and offshore
// agents have hand-written pages; these are the next six, and they share one
// layout so each page is its content rather than its markup.
//
// WHY A PAGE PER INDUSTRY: nobody searches "outbound dialer". They search
// "dialer for mortgage loan officers", "debt collection dialer", "solar
// dialer", and the page that ranks is the one that knows the rules of that
// trade. So every record carries the trade's own compliance facts, each with
// a source, and those facts are what make these pages worth linking to rather
// than six copies of one sales page with the noun swapped.
//
// THE RULE FOR PRODUCT CLAIMS: only what lib/canonicalFacts already states.
// Where a trade has a rule DialerSeat does not enforce (Regulation F's call
// frequency, consent for texts), the page says the customer owns it. Checked
// 2026-09-26.
// =============================================================================

export interface VerticalSource {
  label: string
  url: string
}

export interface Vertical {
  slug: string
  /** Title tag, without the brand suffix. */
  title: string
  description: string
  keywords: string[]
  eyebrow: string
  h1: [string, string]
  intro: string
  /** Which dialing mode fits which list, in this trade's words. */
  modes: { role: string; mode: string; body: string }[]
  /** The trade-specific sections. */
  sections: { icon: 'phone' | 'list' | 'team' | 'calendar' | 'chat' | 'swap'; title: string; body: string; links?: { href: string; label: string }[] }[]
  /** Rules DialerSeat enforces or supports. */
  enforced: string[]
  /** Rules the customer owns, stated plainly. */
  yours: string[]
  sources: VerticalSource[]
  faqs: { question: string; answer: string }[]
  /** Comparison pages most relevant to this trade. */
  related: { href: string; label: string }[]
}

const COMMON_ENFORCED = [
  'Calling windows enforced on the server against each lead’s own state, not the agent’s.',
  'Predictive campaigns held under the federal 3% abandoned-call limit, dropping to one line per agent before it is reached.',
  'Local caller ID matched to each lead’s area code, state or region, on by default.',
  'A per-call compliance export: AMD result, abandon flag and disposition for any date range.',
]

export const VERTICALS: Vertical[] = [
  {
    slug: 'mortgage',
    title: 'Dialer for Mortgage Loan Officers: Refi, Purchase & Aged Leads',
    description:
      'A dialer for loan officers and mortgage teams: predictive for aged internet leads, preview for referrals, calling windows per borrower state, and $35 per seat per week with no contract. What the 2026 trigger-lead rules change.',
    keywords: ['mortgage dialer', 'dialer for loan officers', 'mortgage auto dialer', 'refinance leads dialer', 'mortgage predictive dialer', 'trigger leads ban'],
    eyebrow: 'MORTGAGE',
    h1: ['A dialer for loan officers', 'working rate-sheet days.'],
    intro:
      'Refinance waves, purchase season, aged internet leads and a pipeline of past clients. What a loan officer needs from a dialer, what changed for trigger leads in 2026, and what DialerSeat does about each part.',
    modes: [
      { role: 'AGED INTERNET LEADS', mode: 'Predictive', body: 'Several lines per agent. The first borrower who answers reaches you.' },
      { role: 'FRESH APPLICATIONS', mode: 'Preview', body: 'Read the file first. A new lead is worth a slower, prepared call.' },
      { role: 'PAST CLIENTS, REFI ALERTS', mode: 'Power', body: 'One call at a time, dialed the moment the last one ends.' },
      { role: 'NOT A TIER', mode: 'All four included', body: 'Chosen per campaign, not per plan.' },
    ],
    sections: [
      {
        icon: 'list',
        title: 'Trigger leads changed on March 5, 2026',
        body:
          'The Homebuyers Privacy Protection Act, signed September 5, 2025, stops the credit bureaus selling a mortgage applicant’s data to other lenders unless the lender has the borrower’s documented consent or an existing relationship: it originated their mortgage, services it, or holds their account. For most loan officers that ends the cold trigger-lead list. The leads worth dialing now are your own: past clients, referral partners’ clients, and internet leads that consented to you.',
      },
      {
        icon: 'phone',
        title: 'A local number, because borrowers screen hard',
        body:
          'A borrower who just applied somewhere has already had calls from lenders they never contacted. An out-of-state number is the easiest to ignore. Every DialerSeat call goes out from a number matched to the borrower, with no add-on fee, spread across the pool so no number is worn into a Spam Likely label.',
        links: [{ href: '/faq/local-presence-dialing', label: 'How the number is picked' }],
      },
      {
        icon: 'team',
        title: 'A branch or a team on one list',
        body:
          'Each loan officer gets their own seat at the same $35 a week, and a shared campaign never hands the same borrower to two of them. Manager+ adds team ownership and lead drip, which sends new leads from your CRM or point-of-sale system straight into a running campaign by webhook.',
        links: [{ href: '/faq/teams-how-it-works', label: 'How teams work' }, { href: '/faq/send-leads-from-your-crm', label: 'Lead drip' }],
      },
    ],
    enforced: COMMON_ENFORCED,
    yours: [
      'Consent for every lead you buy. Aged internet leads are only as callable as the consent they were collected with.',
      'Scrubbing marketing lists against the National Do Not Call Registry. Calls to your own past clients may fall under the existing-business-relationship exception; check its time limits.',
      'Trigger-lead use under the Homebuyers Privacy Protection Act, and any state licensing rules on who may place the call.',
    ],
    sources: [
      { label: 'Homebuyers Privacy Protection Act, H.R.2808 (Congress.gov)', url: 'https://www.congress.gov/bill/119th-congress/house-bill/2808' },
      { label: 'HPPA amends the FCRA (Hunton)', url: 'https://www.hunton.com/privacy-and-cybersecurity-law-blog/homebuyers-privacy-protection-act-amends-fcra' },
      { label: 'FTC Telemarketing Sales Rule', url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310' },
    ],
    faqs: [
      {
        question: 'What is the best dialer for mortgage loan officers?',
        answer:
          'One that matches the lead. Aged internet leads need predictive dialing and a local caller ID; fresh applications and referrals need preview dialing and notes. DialerSeat includes all four modes at $35 per seat per week with no contract, chosen per campaign.',
      },
      {
        question: 'Can loan officers still buy trigger leads?',
        answer:
          'Only in narrow cases since March 5, 2026. The Homebuyers Privacy Protection Act lets a credit bureau share an applicant’s data with a lender only with the borrower’s documented consent, or when the lender already originated or services the borrower’s mortgage or holds their account.',
      },
      {
        question: 'Do mortgage marketing calls have to follow the Do Not Call Registry?',
        answer:
          'Yes. A call offering a refinance or a purchase loan is a telemarketing call, so numbers on the National Do Not Call Registry need consent or an existing business relationship. Scrubbing is your responsibility; DialerSeat enforces calling windows and the abandoned-call limit.',
      },
    ],
    related: [
      { href: '/vs/readymode', label: 'vs ReadyMode' },
      { href: '/vs/phoneburner', label: 'vs PhoneBurner' },
      { href: '/vs/kixie', label: 'vs Kixie' },
    ],
  },
  {
    slug: 'solar',
    title: 'Solar Sales Dialer: Appointment Setting, Lead Gen & Compliance',
    description:
      'A dialer for solar setters and lead-gen floors: predictive for homeowner lists, calling windows per lead state, the 3% cap enforced, and $35 per seat per week you can pause between seasons.',
    keywords: ['solar dialer', 'solar sales dialer', 'solar appointment setting dialer', 'solar lead generation calls', 'solar predictive dialer', 'solar telemarketing compliance'],
    eyebrow: 'SOLAR',
    h1: ['A dialer for solar setters', 'who book the next roof.'],
    intro:
      'Appointment setters, lead-gen floors and installers calling homeowners. Solar is one of the most litigated trades under the telemarketing rules, so the compliance part comes first here.',
    modes: [
      { role: 'HOMEOWNER LISTS', mode: 'Predictive', body: 'Several lines per setter; the first homeowner who answers reaches you.' },
      { role: 'WEB FORM LEADS', mode: 'Progressive', body: 'Dialed the moment they arrive, with the setter already on the line.' },
      { role: 'RESCHEDULES, NO-SHOWS', mode: 'Power', body: 'One call at a time, no pause between them.' },
      { role: 'NOT A TIER', mode: 'All four included', body: 'Chosen per campaign.' },
    ],
    sections: [
      {
        icon: 'list',
        title: 'Consent is where solar calling goes wrong',
        body:
          'Most solar complaints start with a lead form that sold one homeowner’s consent to many callers. The FCC’s rule requiring consent to name a single seller was struck down by the Eleventh Circuit on January 24, 2025, but prerecorded messages still need prior express written consent, the Do Not Call Registry still applies, and states keep adding rules of their own. Know where every lead came from and what the homeowner agreed to.',
      },
      {
        icon: 'calendar',
        title: 'Seasonal floors, weekly seats',
        body:
          'Solar hiring follows the season and the incentives. On DialerSeat a seat is $35 a week and can be paused instead of cancelled: billing stops, the setter’s data stays, and resuming is one click. You are not paying for twelve months of seats you staffed for four.',
        links: [{ href: '/tools/dialer-cost-calculator', label: 'Work out the cost for your season' }],
      },
      {
        icon: 'phone',
        title: 'Numbers that stay answerable',
        body:
          'High-volume homeowner campaigns are exactly what gets numbers labelled Spam Likely. DialerSeat spreads calls across a pool of local numbers with per-number daily caps and answer-rate tracking, so one caller ID is not burned by a whole floor.',
        links: [{ href: '/faq/why-calls-show-spam-likely', label: 'Why calls get flagged' }, { href: '/faq/how-we-keep-numbers-clean', label: 'How numbers stay clean' }],
      },
    ],
    enforced: COMMON_ENFORCED,
    yours: [
      'Proof of consent for every lead, with where it was collected and when. If your lead source sends consent details, DialerSeat stores them with the lead.',
      'Do Not Call Registry scrubbing, and any state registry or calling-hour rule stricter than the federal one.',
      'Consent for texts and for any prerecorded message.',
    ],
    sources: [
      { label: 'Eleventh Circuit vacates the one-to-one consent rule (Wiley)', url: 'https://www.wiley.law/alert-UPDATE-11th-Circuit-Vacates-FCCs-One-to-One-TCPA-Consent-Rule' },
      { label: 'FTC Telemarketing Sales Rule', url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310' },
    ],
    faqs: [
      {
        question: 'What is the best dialer for solar appointment setting?',
        answer:
          'A predictive dialer with local caller ID and number rotation for homeowner lists, and a progressive mode for web-form leads so they are called within minutes. DialerSeat includes every mode at $35 per seat per week, and seats can be paused between seasons.',
      },
      {
        question: 'Is the FCC one-to-one consent rule in effect?',
        answer:
          'No. The Eleventh Circuit vacated it on January 24, 2025, in Insurance Marketing Coalition v. FCC. Prior express written consent is still required for prerecorded marketing calls and for autodialed marketing calls to mobile phones, and the Do Not Call Registry still applies.',
      },
    ],
    related: [
      { href: '/vs/convoso', label: 'vs Convoso' },
      { href: '/vs/readymode', label: 'vs ReadyMode' },
      { href: '/vs/calltools', label: 'vs CallTools' },
    ],
  },
  {
    slug: 'debt-collection',
    title: 'Debt Collection Dialer: Regulation F, the 7-in-7 Rule & Calling Hours',
    description:
      'What a collections floor needs from a dialer under the FDCPA and Regulation F: the 7-in-7 call frequency limit, 8 a.m. to 9 p.m. calling hours, and which rules the dialer enforces versus the agency. $35 per seat per week.',
    keywords: ['debt collection dialer', 'collections dialer', 'regulation f dialer', '7 in 7 rule', 'fdcpa calling hours', 'collection agency predictive dialer'],
    eyebrow: 'DEBT COLLECTION',
    h1: ['A dialer for collections,', 'under Regulation F.'],
    intro:
      'Collection calls are not telemarketing, and a different rulebook applies: the Fair Debt Collection Practices Act and the CFPB’s Regulation F. Here is what those rules require of the dialing, and which parts a dialer can and cannot do for you.',
    modes: [
      { role: 'EARLY-STAGE ACCOUNTS', mode: 'Progressive', body: 'The collector is on the line when the consumer answers. No dead air.' },
      { role: 'SKIP-TRACED NUMBERS', mode: 'Power', body: 'One number at a time, the next dialed as the last ends.' },
      { role: 'DISPUTES, PAYMENT PLANS', mode: 'Preview', body: 'Read the account first; these calls are the ones that get reviewed.' },
      { role: 'LARGE PORTFOLIOS', mode: 'Predictive', body: 'Several lines per collector, within the abandoned-call limit.' },
    ],
    sections: [
      {
        icon: 'calendar',
        title: 'The 7-in-7 rule',
        body:
          'Under Regulation F, a collector is presumed to be harassing if it calls about a particular debt more than seven times in seven consecutive days, or within seven days after having a conversation about that debt. The count is per debt, not per consumer, and a consumer’s own calls to you do not count. The presumption can be rebutted, but most agencies build their dialing around it.',
      },
      {
        icon: 'phone',
        title: 'Calling hours and the right time zone',
        body:
          'Calls before 8 a.m. or after 9 p.m. in the consumer’s local time are presumed inconvenient. DialerSeat enforces the calling window on the server against each account’s own state, so a collector in another time zone cannot dial outside it.',
        links: [{ href: '/faq/calling-hours', label: 'Calling hours by state' }],
      },
      {
        icon: 'list',
        title: 'Retries and the frequency count',
        body:
          'Leads are dialed on a three-attempt retry cycle and then rotate to the back of the queue. That is not a Regulation F control. Set attempts and campaign cadence so no debt is called more than seven times in seven days, and keep your own count across campaigns.',
      },
    ],
    enforced: [
      'Calling windows enforced on the server against each account holder’s own state.',
      'Predictive campaigns held under the 3% abandoned-call limit, dropping to one line per collector before it is reached.',
      'An internal suppression list: once a number is added, it is not dialed again.',
      'A per-call compliance export: AMD result, abandon flag and disposition for any date range.',
    ],
    yours: [
      'The 7-in-7 call frequency count per debt, across every campaign it appears in. DialerSeat does not count it for you.',
      'Mini-Miranda disclosures, validation notices, and honouring requests to stop or to call a different way.',
      'Consent for prerecorded messages and texts, and any state collection-licensing rule.',
    ],
    sources: [
      { label: 'Regulation F, 12 CFR 1006.14 (eCFR)', url: 'https://www.ecfr.gov/current/title-12/chapter-X/part-1006/subpart-B/section-1006.14' },
      { label: 'CFPB debt collection rule FAQs', url: 'https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/debt-collection/debt-collection-rule-faqs/' },
    ],
    faqs: [
      {
        question: 'What is the 7-in-7 rule in debt collection?',
        answer:
          'Under Regulation F, 12 CFR 1006.14(b), a debt collector is presumed to violate the ban on repeated calls if it calls about a particular debt more than seven times within seven consecutive days, or within seven days after a telephone conversation about that debt. The count is per debt, and calls the consumer makes to the collector are not counted.',
      },
      {
        question: 'What hours can debt collectors call?',
        answer:
          'Between 8 a.m. and 9 p.m. in the consumer’s local time, unless the collector knows another time is convenient for them. DialerSeat enforces the window per account, against the account holder’s state.',
      },
      {
        question: 'Does the Do Not Call Registry apply to collection calls?',
        answer:
          'No. Collection calls are not telemarketing, so the National Do Not Call Registry does not apply. The FDCPA and Regulation F do, as do the TCPA’s rules on prerecorded messages and autodialed calls.',
      },
    ],
    related: [
      { href: '/vs/five9', label: 'vs Five9' },
      { href: '/vs/convoso', label: 'vs Convoso' },
      { href: '/vs/vicidial', label: 'vs VICIdial' },
    ],
  },
  {
    slug: 'recruiters',
    title: 'Dialer for Recruiters & Staffing Agencies: Call More Candidates',
    description:
      'A dialer for recruiters and staffing desks: power dialing through candidate lists, local caller ID, notes that stay with the candidate, and $35 per seat per week that follows your hiring volume.',
    keywords: ['dialer for recruiters', 'recruiting dialer', 'staffing agency dialer', 'recruiter power dialer', 'candidate calling software'],
    eyebrow: 'RECRUITING',
    h1: ['A dialer for recruiters', 'with a req to fill by Friday.'],
    intro:
      'High-volume staffing desks, agency recruiters and in-house teams calling candidates. What matters in a dialer when the person you are calling is a candidate rather than a customer.',
    modes: [
      { role: 'SOURCED CANDIDATE LISTS', mode: 'Power', body: 'One call at a time, dialed the moment the last one ends.' },
      { role: 'APPLICANTS FROM A JOB POST', mode: 'Progressive', body: 'Called while the application is fresh, recruiter already on the line.' },
      { role: 'SHORTLISTED CANDIDATES', mode: 'Preview', body: 'Read the résumé and notes, then start the call.' },
      { role: 'VOLUME HIRING', mode: 'Predictive', body: 'Several lines per recruiter for hourly and seasonal roles.' },
    ],
    sections: [
      {
        icon: 'chat',
        title: 'Notes that follow the candidate',
        body:
          'Dispositions and notes stay with the candidate across sessions and across seats, and campaigns carry multiple scripts you can switch mid-call: a screening script and a submittal script are different conversations.',
        links: [{ href: '/faq/scripts', label: 'Call scripts' }, { href: '/faq/leads', label: 'Leads and notes' }],
      },
      {
        icon: 'calendar',
        title: 'Seats that follow the hiring volume',
        body:
          'Staffing volume swings with clients’ demand. A DialerSeat seat is $35 a week and can be paused when a desk goes quiet, so a recruiter hired for one surge does not cost a year.',
      },
      {
        icon: 'list',
        title: 'Which rules apply to recruiting calls',
        body:
          'A call about a job is not selling anything, so it generally falls outside telemarketing rules like the Do Not Call Registry. The TCPA still covers prerecorded messages and texts, and candidates who ask not to be called should not be called again.',
      },
    ],
    enforced: [
      'Calling windows enforced on the server against each candidate’s own state.',
      'Local caller ID matched to each candidate’s area code, state or region.',
      'An internal suppression list: a number added to it is not dialed again.',
    ],
    yours: [
      'Consent for texts and prerecorded messages to candidates.',
      'Any client’s rules on how its candidates may be contacted.',
    ],
    sources: [
      { label: 'FTC: complying with the Telemarketing Sales Rule', url: 'https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule' },
    ],
    faqs: [
      {
        question: 'Do recruiters need to follow the Do Not Call Registry?',
        answer:
          'Generally not for calls about a job, because they do not sell goods or services. The TCPA’s rules on prerecorded messages and texts still apply, and a candidate who asks not to be called should be suppressed.',
      },
      {
        question: 'What is the best dialer for a staffing agency?',
        answer:
          'One with power and progressive dialing for candidate lists, notes that persist across recruiters, and seats you can add and pause as volume changes. DialerSeat is $35 per seat per week with every mode included.',
      },
    ],
    related: [
      { href: '/vs/kixie', label: 'vs Kixie' },
      { href: '/vs/justcall', label: 'vs JustCall' },
      { href: '/vs/aircall', label: 'vs Aircall' },
    ],
  },
  {
    slug: 'b2b-sales',
    title: 'Dialer for B2B Sales Teams & SDRs: Cold Calling Without the Contract',
    description:
      'A dialer for SDRs and B2B sales teams: multi-line predictive, local caller ID, calling windows per prospect, and $35 per seat per week with no annual contract or seat minimum. What the 2024 FTC rule change means for B2B calls.',
    keywords: ['b2b dialer', 'sdr dialer', 'dialer for sales teams', 'b2b cold calling software', 'sales dialer', 'power dialer for sdrs', 'orum alternative'],
    eyebrow: 'B2B SALES',
    h1: ['A dialer for SDRs', 'without the annual contract.'],
    intro:
      'SDR teams, founders doing their own outbound, and agencies booking meetings for clients. What a B2B floor needs from a dialer, what changed for business calls in 2024, and where DialerSeat is and is not the right tool.',
    modes: [
      { role: 'COLD LISTS', mode: 'Predictive', body: 'Several lines per rep; the first prospect who picks up reaches you.' },
      { role: 'TARGET ACCOUNTS', mode: 'Preview', body: 'Research first, then call. For the accounts that matter.' },
      { role: 'SEQUENCES', mode: 'Power', body: 'Work a call step one after another, no gaps.' },
      { role: 'NOT A TIER', mode: 'All four included', body: 'Chosen per campaign.' },
    ],
    sections: [
      {
        icon: 'list',
        title: 'B2B calls came under the telemarketing rule in 2024',
        body:
          'Until 2024 most business-to-business calls sat outside the FTC’s Telemarketing Sales Rule. Amendments effective May 16, 2024 extended its ban on misrepresentations to B2B calls and expanded recordkeeping. The National Do Not Call Registry still does not cover genuine calls to businesses, but a founder’s mobile may be a personal number, and state laws and the TCPA still apply.',
      },
      {
        icon: 'team',
        title: 'The honest fit',
        body:
          'Parallel dialers built for SDR teams sync deeply with Salesforce and HubSpot. DialerSeat takes leads by CSV upload or an inbound webhook per campaign rather than a native CRM sync. If your reps live inside a CRM sequence, weigh that; if you want multi-line dialing without an annual contract and a three-seat minimum, it is a fit.',
        links: [{ href: '/vs/orum', label: 'vs Orum' }, { href: '/faq/send-leads-from-your-crm', label: 'Lead drip' }],
      },
      {
        icon: 'phone',
        title: 'Getting past “Spam Likely” to the decision maker',
        body:
          'Local caller ID by default, numbers spread across a pool with per-number daily caps, and carrier registration with STIR/SHAKEN attestation and CNAM, so calls to mobiles are not labelled before they are answered.',
        links: [{ href: '/faq/why-calls-show-spam-likely', label: 'Why calls get flagged' }],
      },
    ],
    enforced: COMMON_ENFORCED,
    yours: [
      'Truthful claims on every call: since May 2024 the Telemarketing Sales Rule’s misrepresentation ban covers B2B calls.',
      'Checking whether a number is a business line or a person’s own mobile, and any state rule that applies to it.',
      'CRM updates: DialerSeat takes leads in by webhook but does not write back to your CRM.',
    ],
    sources: [
      { label: 'Telemarketing Sales Rule amendments, 2024 (Federal Register)', url: 'https://www.federalregister.gov/documents/2024/04/16/2024-07180/telemarketing-sales-rule' },
      { label: 'FTC: complying with the Telemarketing Sales Rule', url: 'https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule' },
    ],
    faqs: [
      {
        question: 'Does the Do Not Call Registry apply to B2B cold calls?',
        answer:
          'Not to genuine calls to businesses. But since May 16, 2024 the FTC’s Telemarketing Sales Rule bans misrepresentations on B2B calls too, and a sole trader’s or founder’s mobile may be a personal number covered by the registry and by state law.',
      },
      {
        question: 'Is DialerSeat an Orum or Nooks alternative?',
        answer:
          'For teams that want multi-line dialing without an annual contract or a seat minimum, yes: $35 per seat per week with predictive included. Orum and Nooks sync more deeply with Salesforce and HubSpot; DialerSeat takes leads by CSV or webhook.',
      },
    ],
    related: [
      { href: '/vs/orum', label: 'vs Orum' },
      { href: '/vs/kixie', label: 'vs Kixie' },
      { href: '/vs/close', label: 'vs Close' },
      { href: '/vs/hubspot', label: 'vs HubSpot Calling' },
    ],
  },
  {
    slug: 'fundraising',
    title: 'Dialer for Nonprofits & Telefundraising: Donor Calling Rules',
    description:
      'A dialer for nonprofits and telefunders calling donors: preview and power dialing, calling windows per donor state, and $35 per seat per week you can pause between campaigns. Which Do Not Call rules apply to charity calls.',
    keywords: ['nonprofit dialer', 'fundraising dialer', 'telefundraising software', 'donor calling software', 'charity calling rules', 'telefunder do not call'],
    eyebrow: 'FUNDRAISING',
    h1: ['A dialer for donor calls,', 'campaign by campaign.'],
    intro:
      'Nonprofits calling their own supporters, and telefundraising firms calling on a charity’s behalf. Charity calls have their own place in the telemarketing rules; here is what applies and what a dialer does about it.',
    modes: [
      { role: 'MAJOR DONORS', mode: 'Preview', body: 'Read the giving history first, then make the call yourself.' },
      { role: 'LAPSED DONORS', mode: 'Power', body: 'One call at a time, the next dialed as the last ends.' },
      { role: 'YEAR-END DRIVES', mode: 'Progressive', body: 'The caller is on the line when the donor answers.' },
      { role: 'LARGE APPEALS', mode: 'Predictive', body: 'Several lines per caller, within the abandoned-call limit.' },
    ],
    sections: [
      {
        icon: 'list',
        title: 'Which Do Not Call rules apply to charity calls',
        body:
          'Calls asking for a donation are exempt from the National Do Not Call Registry, even when a for-profit telefunder makes them. Telefunders must still honour entity-specific requests: a donor who asks not to be called on behalf of a charity must not be called again for it. Nonprofits calling on their own behalf generally fall outside the FTC’s rule, but state charitable-solicitation laws may still apply.',
      },
      {
        icon: 'calendar',
        title: 'Campaign-length seats',
        body:
          'Fundraising runs in drives. A DialerSeat seat is $35 a week and can be paused between campaigns, so a year-end appeal staffed for six weeks costs six weeks.',
        links: [{ href: '/tools/dialer-cost-calculator', label: 'Cost for your campaign' }],
      },
    ],
    enforced: [
      'Calling windows enforced on the server against each donor’s own state.',
      'An internal suppression list: a number added to it is not dialed again, which is how an entity-specific do-not-call request is kept.',
      'Predictive campaigns held under the 3% abandoned-call limit.',
    ],
    yours: [
      'Recording each entity-specific do-not-call request against the charity it applies to.',
      'State charitable-solicitation registration and disclosure rules.',
      'Consent for prerecorded messages and texts.',
    ],
    sources: [
      { label: 'FTC: Q&A on the TSR’s Do Not Call provisions', url: 'https://www.ftc.gov/business-guidance/resources/qa-telemarketers-sellers-about-dnc-provisions-tsr-0' },
      { label: 'FTC: complying with the Telemarketing Sales Rule', url: 'https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule' },
    ],
    faqs: [
      {
        question: 'Can charities call numbers on the Do Not Call Registry?',
        answer:
          'Yes. Calls soliciting a charitable contribution are exempt from the National Do Not Call Registry, including calls by for-profit telefunders. A telefunder must honour a donor’s request not to be called on behalf of that particular charity.',
      },
      {
        question: 'Does the Telemarketing Sales Rule apply to nonprofits?',
        answer:
          'Nonprofits calling on their own behalf are generally outside it. For-profit telemarketers calling on a charity’s behalf are covered by most of it, including the entity-specific do-not-call requirement.',
      },
    ],
    related: [
      { href: '/vs/phoneburner', label: 'vs PhoneBurner' },
      { href: '/vs/kixie', label: 'vs Kixie' },
    ],
  },
]

export function verticalBySlug(slug: string): Vertical | undefined {
  return VERTICALS.find((v) => v.slug === slug)
}
