// =============================================================================
// THE DOCS, AS DATA
// =============================================================================
// Rendered by app/developers/docs/[slug] and indexed, sentence by sentence, by
// the console search. Write a fact here once and both carry it.
// =============================================================================

import { API_BASE, EMBED_SRC, SALES_EMAIL, WEBHOOK_EVENTS, DIAL_MODES } from './catalog'

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string; id: string }
  | { t: 'list'; items: string[] }
  | { t: 'code'; lang: string; code: string; title?: string }
  | { t: 'note'; text: string }

export interface DocPage {
  slug: string
  title: string
  summary: string
  group: 'Start here' | 'Build' | 'Operate'
  keywords: string[]
  blocks: Block[]
}

export const DOCS: DocPage[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    group: 'Start here',
    summary: 'From a new account to a dialer inside your app in five steps.',
    keywords: ['getting started', 'setup', 'install', 'first call', 'tutorial', 'how to', 'integrate'],
    blocks: [
      { t: 'p', text: 'DialerSeat for Developers puts the DialerSeat dialer inside your CRM or platform. Your users dial from your pages; every result comes back to you through webhooks, under your own campaigns and dispositions.' },
      { t: 'h', id: 'activate', text: '1. Activate your developer account' },
      { t: 'p', text: 'Sign in at dev.dialerseat.com with any DialerSeat login and choose Activate developer account. It is free. You get test keys straight away and every part of the console and API. Nothing places a real call until you activate live dialing.' },
      { t: 'h', id: 'seat', text: '2. Create a seat for a user' },
      { t: 'p', text: 'A seat is one of your users who dials. Create it from your server with your secret key, keyed on your own user id. Calling it again with the same id updates the seat instead of making a second one.' },
      { t: 'code', lang: 'bash', code: `curl ${API_BASE}/seats \\\n  -H "Authorization: Bearer sk_test_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"external_user_id":"usr_829","email":"ana@acme.com","name":"Ana Ruiz"}'` },
      { t: 'h', id: 'session', text: '3. Create a session' },
      { t: 'p', text: 'Sessions sign a seat into the miniplayer with no second login. A session token lasts 15 minutes and is used once. Create one each time the user opens the dialer.' },
      { t: 'code', lang: 'bash', code: `curl -X POST ${API_BASE}/seats/seat_123/sessions \\\n  -H "Authorization: Bearer sk_test_..."` },
      { t: 'h', id: 'embed', text: '4. Drop in the miniplayer' },
      { t: 'code', lang: 'html', code: `<script src="${EMBED_SRC}"></script>\n<div id="dialer"></div>\n<script>\n  DialerSeat.mount('#dialer', { session: SESSION_TOKEN, campaign: 'your_campaign_id' })\n</script>` },
      { t: 'h', id: 'webhooks', text: '5. Receive results' },
      { t: 'p', text: 'Add a webhook endpoint in the console. call.dispositioned carries your disposition code and the lead\'s external id, so you can write the result straight onto your record.' },
    ],
  },
  {
    slug: 'accounts',
    title: 'Developer accounts',
    group: 'Start here',
    summary: 'One DialerSeat login, two independent accounts: the developer account and the dialerseat.com account.',
    keywords: ['sign up', 'sign in', 'login', 'activate', 'free', 'subscription', 'independent', 'not a developer', 'welcome'],
    blocks: [
      { t: 'p', text: 'dev.dialerseat.com uses the same login as dialerseat.com. Signing in does not make you a developer: the first time you arrive you choose Activate developer account, or go back to dialerseat.com if you came here by mistake.' },
      { t: 'h', id: 'free', text: 'A developer account is free' },
      { t: 'p', text: 'Activating gives you the whole console, test keys, the full API, webhooks, the miniplayer in test mode and every setting. You can build and test the complete integration without paying. Calls are simulated until live dialing is active.' },
      { t: 'h', id: 'live', text: 'Live dialing is what you pay for' },
      { t: 'p', text: 'Live keys authenticate from the start, but refuse to place a call until live dialing is active on your platform. Activation is under Billing.' },
      { t: 'h', id: 'independent', text: 'The two accounts are independent' },
      { t: 'list', items: [
        'A dialerseat.com subscription does not activate live dialing for your platform.',
        'A developer account does not give you a dialer on dialerseat.com. You can subscribe to your own dialer there and own your own teams like anyone else.',
        'If you are subscribed on dialerseat.com and also a developer, your own dialer works exactly as before.',
      ] },
    ],
  },
  {
    slug: 'authentication',
    title: 'Authentication and API keys',
    group: 'Start here',
    summary: 'Secret keys for your server, publishable keys for the browser, and test against live.',
    keywords: ['api key', 'secret key', 'publishable key', 'bearer', 'token', 'rotate', 'revoke', 'leaked', 'credentials', 'sk_test', 'sk_live', 'pk_test', 'pk_live', 'authorization header'],
    blocks: [
      { t: 'p', text: 'Every API request carries a secret key in the Authorization header as a bearer token.' },
      { t: 'code', lang: 'http', code: 'Authorization: Bearer sk_live_...' },
      { t: 'h', id: 'kinds', text: 'Two kinds of key' },
      { t: 'list', items: [
        'Secret keys (sk_test_, sk_live_) can do anything the API can. Keep them on your server. They are shown once, when you create them; after that the console shows only the last four characters.',
        'Publishable keys (pk_test_, pk_live_) are safe in a browser. They only identify your platform to the miniplayer loader, and only from origins you allow.',
      ] },
      { t: 'h', id: 'environments', text: 'Test and live' },
      { t: 'p', text: 'Test keys see only test data and never dial. Live keys see only live data and dial once live dialing is active. A seat, campaign or lead made with a test key does not exist for a live key.' },
      { t: 'h', id: 'rotate', text: 'Rotating a key' },
      { t: 'p', text: 'Create the new key, deploy it, then revoke the old one. Revoking is immediate and cannot be undone. If a secret key leaks, revoke it first.' },
    ],
  },
  {
    slug: 'seats-and-sessions',
    title: 'Seats and sessions',
    group: 'Build',
    summary: 'Map your users to DialerSeat seats and sign them into the miniplayer.',
    keywords: ['user', 'agent', 'seat', 'session', 'token', 'sso', 'single sign on', 'external_user_id', 'billed_to', 'provision'],
    blocks: [
      { t: 'p', text: 'A seat is a user on your platform who dials. Behind it is a normal DialerSeat user, so every call they make is recorded and reported exactly as any other DialerSeat call.' },
      { t: 'h', id: 'billing', text: 'Who pays for a seat' },
      { t: 'p', text: 'billed_to is user or platform. A user-billed seat sees DialerSeat checkout the first time it opens the miniplayer and becomes active when the payment goes through. A platform-billed seat is active at once and counts toward your weekly invoice.' },
      { t: 'h', id: 'sessions', text: 'Sessions' },
      { t: 'p', text: 'POST /seats/{id}/sessions returns a token that lasts 15 minutes and works once. Pass it to DialerSeat.mount. The user is never asked to sign in to DialerSeat.' },
    ],
  },
  {
    slug: 'campaigns-and-leads',
    title: 'Campaigns and leads',
    group: 'Build',
    summary: 'Tie your CRM campaigns to DialerSeat campaigns and push the leads to dial.',
    keywords: ['campaign', 'list', 'leads', 'contacts', 'import', 'bulk', 'external_id', 'calling hours', 'amd', 'voicemail drop', 'attempts', 'retries', 'consent'],
    blocks: [
      { t: 'p', text: 'Create a campaign with your own external_id and it stays tied to your campaign. Settings mirror a DialerSeat campaign: dial mode, answering-machine detection, voicemail drop, recording, attempts per lead.' },
      { t: 'h', id: 'leads', text: 'Adding leads' },
      { t: 'p', text: 'POST up to 500 leads per request. Each lead keeps your external_id, and every webhook about it carries that id back. A lead added to a running campaign is dialled on the next pick; nobody needs to restart.' },
      { t: 'code', lang: 'json', code: '{\n  "leads": [\n    { "external_id": "c_5501", "phone": "+15125550142", "first_name": "Dana", "consent_source": "web form 2026-11-02" }\n  ]\n}' },
      { t: 'p', text: 'Every response says what happened to each lead: accepted, duplicate, or rejected with the reason.' },
      { t: 'h', id: 'hours', text: 'Calling hours' },
      { t: 'p', text: 'Calling hours are enforced by the lead\'s local time, the same rules as every DialerSeat campaign. You cannot turn them off from the API.' },
    ],
  },
  {
    slug: 'dispositions',
    title: 'Dispositions',
    group: 'Build',
    summary: 'Use your CRM\'s own outcomes in the miniplayer and get them back by code.',
    keywords: ['disposition', 'outcome', 'result', 'wrap up', 'status', 'code', 'label', 'mapping', 'conversion'],
    blocks: [
      { t: 'p', text: 'Agents pick from your disposition list, not ours. Each disposition has your code, the label agents see, and an outcome class so DialerSeat reporting, redial rules and do-not-call handling still work.' },
      { t: 'list', items: ['contact, conversion, callback, not_interested, no_answer, voicemail, bad_number, dnc, other'] },
      { t: 'p', text: 'A disposition mapped to dnc adds the number to your platform\'s do-not-call list automatically.' },
    ],
  },
  {
    slug: 'dial-modes',
    title: 'Dial modes and exceptions',
    group: 'Build',
    summary: 'Set the dial mode for your whole platform, then make exceptions per seat or campaign.',
    keywords: ['dial mode', 'dialer mode', 'predictive', 'power', 'progressive', 'preview', 'policy', 'exception', 'upgrade', 'override', 'lines'],
    blocks: [
      { t: 'p', text: 'Every DialerSeat mode is available: ' + DIAL_MODES.map(m => `${m.name} (${m.summary.replace(/\.$/, '').toLowerCase()})`).join('; ') + '.' },
      { t: 'h', id: 'policy', text: 'Platform policy' },
      { t: 'p', text: 'Under Dial modes in the console you choose the default mode, which modes are allowed, and whether a seat may switch between them itself.' },
      { t: 'h', id: 'exceptions', text: 'Exceptions and upgrades' },
      { t: 'p', text: 'An exception overrides the policy for one seat or one campaign: give a single team predictive while everyone else stays on power, or lock one campaign to preview.' },
    ],
  },
  {
    slug: 'webhooks',
    title: 'Webhooks',
    group: 'Build',
    summary: 'Events, payloads, signatures and retries.',
    keywords: ['webhook', 'events', 'callback url', 'notification', 'signature', 'hmac', 'verify', 'retry', 'endpoint', 'whsec'],
    blocks: [
      { t: 'p', text: 'Add an endpoint in the console and choose its events. Each delivery is a POST with a JSON body and a DialerSeat-Signature header.' },
      { t: 'h', id: 'events', text: 'Events' },
      { t: 'list', items: WEBHOOK_EVENTS.map(e => `${e.type}: ${e.summary}`) },
      { t: 'h', id: 'verify', text: 'Verifying a signature' },
      { t: 'p', text: 'The header is t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body" with your endpoint\'s signing secret>. Reject deliveries more than five minutes old.' },
      { t: 'code', lang: 'js', title: 'Node.js', code: "import crypto from 'node:crypto'\n\nfunction verify(rawBody, header, secret) {\n  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))\n  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false\n  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))\n}" },
      { t: 'h', id: 'retries', text: 'Retries' },
      { t: 'p', text: 'Anything but a 2xx within 10 seconds is retried with backoff for 72 hours. Every delivery has an id; process each id once.' },
    ],
  },
  {
    slug: 'miniplayer',
    title: 'The miniplayer',
    group: 'Build',
    summary: 'The portable DialerSeat dialer, embedded in your page with one script tag.',
    keywords: ['embed', 'widget', 'iframe', 'script tag', 'portable dialer', 'mount', 'sdk', 'javascript', 'allowed origins', 'cors', 'frame', 'theme', 'events', 'postmessage'],
    blocks: [
      { t: 'p', text: 'The miniplayer is the DialerSeat dialer in a compact panel: the queue, the call controls, the script and the disposition picker. It runs in a frame on your page.' },
      { t: 'code', lang: 'html', code: `<script src="${EMBED_SRC}"></script>\n<div id="dialer" style="width:380px;height:640px"></div>\n<script>\n  const dialer = DialerSeat.mount('#dialer', {\n    session: SESSION_TOKEN,\n    campaign: 'crm_campaign_77',\n    theme: 'dark',\n  })\n  dialer.on('disposition', (e) => console.log(e.code, e.lead.external_id))\n</script>` },
      { t: 'h', id: 'origins', text: 'Allowed origins' },
      { t: 'p', text: 'The miniplayer only loads inside origins listed under Miniplayer in the console. Add every domain your app runs on, including staging.' },
      { t: 'h', id: 'events', text: 'Browser events' },
      { t: 'list', items: ['ready: the dialer is signed in and loaded', 'call: a call started, connected or ended', 'disposition: the agent picked an outcome', 'error: the session expired or a payment is needed'] },
    ],
  },
  {
    slug: 'billing',
    title: 'Billing and live dialing',
    group: 'Operate',
    summary: 'Free to build. Pay for live dialing, by the user or by the platform.',
    keywords: ['billing', 'pricing', 'price', 'invoice', 'payment', 'pay', 'cost', 'rates', 'negotiate', 'volume', 'revenue share', 'activate', 'live dialing', 'sales', 'weekly', 'tier', 'plan'],
    blocks: [
      { t: 'p', text: 'Building is free. You pay when calls are real.' },
      { t: 'h', id: 'models', text: 'Who pays' },
      { t: 'list', items: [
        'User-billed: each user pays DialerSeat inside the miniplayer, by the week. Your platform pays nothing and can earn a revenue share.',
        'Platform-billed: you pay one weekly invoice for every active seat and the dials they make, at your negotiated rate, and charge your users whatever you like.',
        'Mixed: you choose per seat.',
      ] },
      { t: 'h', id: 'rates', text: 'Rates' },
      { t: 'p', text: `Platform rates are negotiated on volume and leverage: a price per seat per week, dials included, and a price per dial beyond them. Rates are set with sales at ${SALES_EMAIL} and are subject to change.` },
    ],
  },
  {
    slug: 'errors',
    title: 'Errors and limits',
    group: 'Operate',
    summary: 'Status codes, error bodies, rate limits and idempotency.',
    keywords: ['error', '400', '401', '402', '403', '404', '409', '422', '429', 'rate limit', 'throttle', 'idempotency', 'retry', 'status code'],
    blocks: [
      { t: 'p', text: 'Errors return JSON: { "error": { "type", "code", "message", "param" } }. The message is written for a person.' },
      { t: 'list', items: [
        '400 invalid_request: a field is missing or malformed; param names it.',
        '401 unauthorized: no key, a malformed key, or a revoked key.',
        '402 live_dialing_inactive: a live key tried to dial before live dialing was activated.',
        '403 forbidden: the key\'s scope does not allow this, or the dial mode is not allowed by your policy.',
        '404 not_found: no such object in this environment (test and live are separate).',
        '409 conflict: an object with that external id already exists.',
        '429 rate_limited: slow down; Retry-After says for how long.',
      ] },
      { t: 'h', id: 'idempotency', text: 'Idempotency' },
      { t: 'p', text: 'Send an Idempotency-Key header on any POST. The same key within 24 hours returns the first response instead of doing the work twice.' },
    ],
  },
]

export function docBySlug(slug: string): DocPage | undefined {
  return DOCS.find(d => d.slug === slug)
}

/** Plain text of a block, for search. */
export function blockText(b: Block): string {
  switch (b.t) {
    case 'p': case 'h': case 'note': return b.text
    case 'list': return b.items.join(' ')
    case 'code': return b.code
  }
}
