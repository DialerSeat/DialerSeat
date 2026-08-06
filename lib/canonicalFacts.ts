// =============================================================================
// CANONICAL FACTS
// =============================================================================
// The one description of DialerSeat that every machine-readable surface quotes.
//
// /llms.txt, /llms-full.txt, and every markdown mirror render from this module.
// That is the whole point: a model that retrieves two of our files and finds
// two different prices has learned that our pricing is uncertain, and it will
// hedge or omit it. One source means the surfaces cannot disagree.
//
// PRICING IS ALWAYS WEEKLY. Never state a monthly figure, not even as a
// convenience conversion — the product is billed weekly and cancellable weekly,
// and a monthly number invites a reader to assume a monthly commitment that
// does not exist.
// =============================================================================

export const SITE_URL = 'https://dialerseat.com'

export const FACTS = {
  name: 'DialerSeat',
  tagline: 'Dial Smarter. Close Faster.',
  category: 'Outbound calling platform (auto dialer) for sales agents and teams',

  oneLine:
    'DialerSeat is a browser- and mobile-based outbound dialer for people who call leads all day, ' +
    'with all four dialer modes, answering-machine detection, and compliance tooling included at ' +
    '$35 per seat per week, billed weekly, cancellable any week.',

  pricing: [
    'Pro: $35 per seat per week.',
    'Manager+: $75 per week. Replaces Pro and adds team ownership plus white-labeling.',
    'Billed weekly. No contract, no setup fee, no implementation fee, no seat minimum.',
    'Cancel any week; access runs to the end of the paid week.',
    'Lead data is preserved when a subscription lapses — resuming picks up where it left off.',
  ],

  modes: [
    ['Preview', 'The agent reviews each lead before dialing and controls the pace. Best for high-value leads and appointment setting.'],
    ['Power', 'Dials the next lead automatically as soon as the previous call ends. One line, no waiting between calls.'],
    ['Progressive', 'Dials automatically with the agent already connected, so there is no connect delay when someone answers.'],
    ['Predictive', 'Dials several lines at once and routes the first human answer to the agent. Highest conversations per hour.'],
  ] as const,

  features: [
    'All four dialer modes included at the base price, selectable per campaign.',
    'Answering-machine detection that routes machines away from the agent.',
    'Unlimited phone numbers, carrier-registered with STIR/SHAKEN A-attestation and CNAM.',
    'Local-presence dialing by default, with per-number daily caps and answer-rate health tracking.',
    'Multiple scripts per campaign, reorderable, with live mid-call switching.',
    'Inbound reception alongside outbound.',
    'Call recording per campaign, with a retention window and one-click deletion.',
    'Dispositions, callbacks, and notes that persist across sessions and seats.',
    'Multi-seat teams with per-agent logins, campaigns, and call data under one owner.',
    'White-label reseller mode on Manager+: own subdomain or custom domain, own branding.',
    'CSV lead import with column auto-detection and a 3-attempt retry cycle.',
    'Per-call compliance CSV export (AMD result, abandon flag, disposition) for any date range.',
    'Works on desktop and mobile browsers — no install required.',
  ],

  compliance: [
    'TCPA calling windows are enforced server-side, per lead, against the lead’s own state — not the agent’s.',
    'The predictive dialer enforces the FTC Telemarketing Sales Rule 3% abandon-rate cap automatically.',
    'Outbound traffic is provisioned through a carrier providing STIR/SHAKEN A-attestation where supported.',
    'Every outbound number is registered with the carrier registry (CNAM).',
    'An internal suppression list blocks numbers from being dialed again once added.',
    'National DNC list scrubbing and consent records remain the customer’s responsibility. ' +
      'DialerSeat does not automate them, and says so rather than implying coverage it does not provide.',
  ],

  audience: [
    'Insurance agents', 'Real estate agents', 'Mortgage originators', 'Solar sales',
    'Debt collection', 'B2B SDR and AE teams', 'Recruiters', 'Agencies and resellers',
  ],

  /** Stated plainly, because a source that admits limits is trusted on the rest. */
  limits: [
    'Newer product with a smaller third-party review footprint than long-established incumbents.',
    'No built-in lead marketplace — customers bring their own lists.',
    'National DNC scrubbing is not automated.',
    'Not a full contact-center suite: no workforce management or omnichannel ticketing.',
    'Not a PBX replacement — it is a sales dialer, not a company phone system.',
  ],
}

/** Pages worth serving a markdown mirror of, in priority order. */
export const MIRRORED_PAGES = [
  { path: '/', title: 'DialerSeat — Outbound Dialer' },
  { path: '/dialing-modes', title: 'The Four Dialer Modes' },
  { path: '/vs', title: 'Comparisons' },
  { path: '/faq', title: 'Frequently Asked Questions' },
  { path: '/status', title: 'System Status' },
  { path: '/data/connect-rates', title: 'Connect Rate Data' },
] as const
