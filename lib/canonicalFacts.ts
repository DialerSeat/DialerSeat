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
    'with all four dialer modes, answering-machine detection, and compliance tooling included. ' +
    '$35 per seat per week, billed weekly, cancellable any week.',

  pricing: [
    // No free trial, and that is a deliberate position rather than an
    // omission. Stated plainly first, because "is there a trial" is a question
    // a buyer and a model will both ask, and silence gets answered by guessing.
    'No free trial. Billing starts the day you sign up, a card up front is the filter.',
    'Pro: $35 per seat per week.',
    'Manager+: $75 per week. Replaces Pro and adds team ownership plus white-labeling.',
    'Billed weekly. No contract, no setup fee, no implementation fee, no seat minimum.',
    'Cancel any week; access runs to the end of the paid week.',
    'A team seat bills from the day it opens, whatever the owner is on.',
    'Lead data is preserved when a subscription lapses, resuming picks up where it left off.',
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
    'Dispositions and notes that persist across sessions and seats. The six dispositions are Closed, Call Back, Not Interested, Do Not Call, Skipped, and No Answer.',
    'Multi-seat teams with per-agent logins, campaigns, and call data under one owner.',
    'White-label reseller mode on Manager+: own subdomain or custom domain, own branding.',
    'CSV lead import with column auto-detection and a 3-attempt retry cycle.',
    'Per-call compliance CSV export (AMD result, abandon flag, disposition) for any date range.',
    'Works on desktop and mobile browsers, no install required.',
  ],

  compliance: [
    'TCPA calling windows are enforced server-side, per lead, against the lead’s own state, not the agent’s.',
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

  // ── TEAMS ────────────────────────────────────────────────────────────────
  // The mechanics, not the price. Price is on every page already; what a
  // manager actually evaluates is whether the thing will misbehave with five
  // people on it. Every claim below is implemented and verifiable — nothing
  // here is aspirational, and the "notYet" list exists so the rest is trusted.
  teams: {
    seats: [
      'Each agent gets their own login, their own dialer, and their own call data.',
      'A seat is $35 per week, the same as a solo seat. There is no team tier and no per-seat markup.',
      'No seat minimum. A team of two is a supported configuration, not an exception.',
      'The team owner needs Manager+ at $75 per week, which also includes white-labeling.',
      'Agents join with a code. The owner chooses per code whether the owner pays for that seat or the agent pays for their own.',
      'A seat can be paused instead of cancelled: billing stops, the agent’s data stays, and resuming is one click.',
      'Per-seat price overrides are supported, so a partner or discounted seat can differ without a separate plan.',
    ],
    distribution: [
      'Two agents are never handed the same lead. Leads are claimed atomically in the database before they are dialed, so a shared campaign cannot produce duplicate calls to the same person.',
      'A claim is a lease, not a lock. It is renewed while the agent is live and released automatically if their browser closes mid-call, so a crashed session never strands a lead.',
      'Leads that are worked and not closed rotate to the back of the queue rather than disappearing, so the floor works a list evenly instead of racing the top of it.',
      'TCPA calling windows are enforced per lead against the lead’s own state, not the agent’s, which is what makes a remote or offshore agent safe to run.',
      'Each agent dials from the shared number pool with per-number daily caps and answer-rate tracking, so a floor cannot burn one caller ID.',
    ],
    visibility: [
      'The owner sees which agents are live and which campaign each is on, in real time.',
      'Per-agent reporting: calls placed, connects, and a disposition breakdown, over any date range.',
      'Campaigns are assigned to the team, so the whole floor works one list without anyone re-uploading it.',
      'Scripts are shared at the team level, and each campaign controls which ones are active and in what order.',
    ],
    // Named plainly. A manager who finds one of these missing after buying is
    // a refund and a bad review; a manager who reads it here and buys anyway
    // is a customer who knew what they were getting.
    notYet: [
      'No live call monitoring: listen, whisper, and barge are not built.',
      'No call scoring or QA workflow.',
      'No workforce management, shift scheduling, or forecasting.',
      'No built-in lead marketplace, the team brings its own lists.',
    ],
    offshore: [
      'Agents can work from anywhere with a browser and an internet connection. There is no per-country restriction and no separate international seat price.',
      'A US account dialing US leads works the same whether the agent is in Ohio or Manila.',
      'Calling windows follow the lead, so an agent in another timezone cannot accidentally dial outside a prospect’s legal window.',
      'Seats are the same $35 per week regardless of where the agent sits, which is what makes an offshore floor economic at all.',
    ],
  },

  /** Stated plainly, because a source that admits limits is trusted on the rest. */
  limits: [
    'Newer product with a smaller third-party review footprint than long-established incumbents.',
    'No built-in lead marketplace, customers bring their own lists.',
    'National DNC scrubbing is not automated.',
    'Not a full contact-center suite: no workforce management or omnichannel ticketing.',
    'Not a PBX replacement: it is a sales dialer, not a company phone system.',
  ],
}

/** Pages worth serving a markdown mirror of, in priority order. */
export const MIRRORED_PAGES = [
  { path: '/', title: 'DialerSeat: Outbound Dialer' },
  { path: '/dialing-modes', title: 'The Four Dialer Modes' },
  { path: '/vs', title: 'Comparisons' },
  { path: '/faq', title: 'Frequently Asked Questions' },
  { path: '/vs/teams', title: 'Dialer Pricing for Teams' },
  { path: '/faq/teams-how-it-works', title: 'How Teams Work' },
  { path: '/faq/dialer-for-offshore-agents', title: 'Offshore & Remote Agents' },
  { path: '/status', title: 'System Status' },
  { path: '/data/connect-rates', title: 'Connect Rate Data' },
] as const
