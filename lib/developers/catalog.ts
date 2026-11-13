// =============================================================================
// THE DEVELOPER PRODUCT, AS DATA
// =============================================================================
// The landing page, the docs, the console and the search index all read from
// here, so an endpoint or event named in one place is named the same in all of
// them. Nothing here is a price or a measurement: rates are negotiated and
// shown per platform once sales sets them.
// =============================================================================

export const API_BASE = 'https://api.dialerseat.com/v1'
export const SALES_EMAIL = 'sales@dialerseat.com'
export const EMBED_SRC = 'https://dev.dialerseat.com/embed/v1.js'

export type DialMode = 'preview' | 'progressive' | 'power' | 'predictive'

/** The same four modes, in the words dialerseat.com/dialing-modes already uses. */
export const DIAL_MODES: { id: DialMode; name: string; summary: string }[] = [
  { id: 'preview', name: 'Preview', summary: 'The agent sees the lead first and places the call.' },
  { id: 'progressive', name: 'Progressive', summary: 'One line per agent with pre-screen voicemail detection.' },
  { id: 'power', name: 'Power', summary: 'One line per agent, queue-driven, auto-advancing.' },
  { id: 'predictive', name: 'Predictive', summary: 'Several lines per agent, paced by the engine.' },
]

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  title: string
  summary: string
  group: 'Account' | 'Seats' | 'Sessions' | 'Campaigns' | 'Leads' | 'Calls' | 'Dispositions' | 'Compliance' | 'Usage'
  /** Words a developer might search for that do not appear in the title. */
  keywords?: string[]
}

export const ENDPOINTS: ApiEndpoint[] = [
  { method: 'GET', path: '/me', group: 'Account', title: 'Check your key', summary: 'Which platform and environment a key belongs to, and whether it can dial. The first call to make.', keywords: ['whoami', 'test key', 'ping', 'health', 'verify key', 'platform'] },
  { method: 'POST', path: '/seats', group: 'Seats', title: 'Create a seat', summary: 'Create or update the DialerSeat seat for one of your users, keyed on your own user id.', keywords: ['user', 'agent', 'provision', 'upsert', 'external_user_id', 'onboard'] },
  { method: 'GET', path: '/seats', group: 'Seats', title: 'List seats', summary: 'Every seat on the platform with its status and who pays for it.', keywords: ['users', 'agents'] },
  { method: 'GET', path: '/seats/{id}', group: 'Seats', title: 'Retrieve a seat', summary: 'One seat, including its dial-mode exception if it has one.' },
  { method: 'PATCH', path: '/seats/{id}', group: 'Seats', title: 'Update a seat', summary: 'Change a seat\'s name, billing (user or platform) or dial mode.', keywords: ['exception', 'upgrade', 'billed_to'] },
  { method: 'DELETE', path: '/seats/{id}', group: 'Seats', title: 'Disable a seat', summary: 'Stop a seat dialing. Its call history is kept.', keywords: ['remove', 'deactivate', 'offboard'] },
  { method: 'POST', path: '/seats/{id}/sessions', group: 'Sessions', title: 'Create a miniplayer session', summary: 'A 15-minute token that signs the seat into the embedded dialer with no second login.', keywords: ['token', 'embed', 'sso', 'login', 'iframe', 'widget', 'auth'] },
  { method: 'POST', path: '/campaigns', group: 'Campaigns', title: 'Create a campaign', summary: 'Tie one of your CRM campaigns to a DialerSeat campaign: dial mode, AMD, voicemail drop, calling hours, dispositions.', keywords: ['list', 'external_id', 'amd', 'voicemail', 'script'] },
  { method: 'GET', path: '/campaigns', group: 'Campaigns', title: 'List campaigns', summary: 'Every campaign with lead counts and progress.' },
  { method: 'PATCH', path: '/campaigns/{id}', group: 'Campaigns', title: 'Update a campaign', summary: 'Pause, resume, or change its dial mode and settings.', keywords: ['pause', 'resume', 'stop'] },
  { method: 'POST', path: '/campaigns/{id}/leads', group: 'Leads', title: 'Add leads', summary: 'Push up to 500 leads per request. Each keeps your external id so results map back to your record.', keywords: ['contacts', 'import', 'upload', 'bulk', 'batch', 'records', 'phone numbers'] },
  { method: 'DELETE', path: '/campaigns/{id}/leads/{external_id}', group: 'Leads', title: 'Remove a lead', summary: 'Take a lead out of the queue before it is dialled.', keywords: ['contact', 'delete'] },
  { method: 'GET', path: '/calls', group: 'Calls', title: 'List calls', summary: 'Calls since a timestamp, with outcome, talk time, AMD result and disposition.', keywords: ['history', 'cdr', 'call log', 'report', 'talk time'] },
  { method: 'GET', path: '/calls/{id}', group: 'Calls', title: 'Retrieve a call', summary: 'One call, including a short-lived recording link when the campaign records.', keywords: ['recording', 'audio'] },
  { method: 'GET', path: '/dispositions', group: 'Dispositions', title: 'List dispositions', summary: 'Your disposition codes and the outcome each one maps to.', keywords: ['outcomes', 'results', 'status codes', 'wrap up'] },
  { method: 'POST', path: '/dispositions', group: 'Dispositions', title: 'Create a disposition', summary: 'Add one of your CRM\'s outcomes so agents pick it in the miniplayer.', keywords: ['outcome', 'wrap up', 'custom'] },
  { method: 'POST', path: '/dnc', group: 'Compliance', title: 'Add to do-not-call', summary: 'Suppress a number across every campaign on the platform.', keywords: ['suppression', 'dnc', 'opt out', 'compliance', 'tcpa'] },
  { method: 'GET', path: '/usage', group: 'Usage', title: 'Retrieve usage', summary: 'Seat-weeks and dials for a period, per seat and in total.', keywords: ['billing', 'invoice', 'metering', 'dials'] },
]

export interface WebhookEvent { type: string; summary: string; keywords?: string[] }

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  { type: 'seat.activated', summary: 'A seat can dial: payment went through, or the platform covers it.', keywords: ['paid', 'subscription'] },
  { type: 'seat.payment_failed', summary: 'A user-billed seat\'s weekly charge failed. Dialing stops at the end of the paid days.', keywords: ['billing', 'declined', 'card'] },
  { type: 'seat.disabled', summary: 'A seat stopped: cancelled, or disabled through the API.', keywords: ['cancelled'] },
  { type: 'call.started', summary: 'A line started ringing.', keywords: ['dialing', 'ringing'] },
  { type: 'call.answered', summary: 'Somebody or something answered. Includes the AMD result when AMD is on.', keywords: ['amd', 'machine', 'human', 'connected'] },
  { type: 'call.ended', summary: 'The call ended. Includes duration, talk seconds and who hung up.', keywords: ['hangup', 'completed', 'duration'] },
  { type: 'call.dispositioned', summary: 'The agent picked a disposition. Your code, your label, our outcome class.', keywords: ['outcome', 'result', 'wrap up', 'status'] },
  { type: 'recording.ready', summary: 'A recording is stored and can be fetched.', keywords: ['audio', 'mp3'] },
  { type: 'lead.exhausted', summary: 'A lead used every attempt the campaign allows.', keywords: ['max attempts', 'retries'] },
  { type: 'campaign.completed', summary: 'Every lead in a campaign is dialled or exhausted.', keywords: ['finished', 'done'] },
]

export const OUTCOME_CLASSES = [
  { id: 'contact', label: 'Contact' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'callback', label: 'Callback' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'bad_number', label: 'Bad number' },
  { id: 'dnc', label: 'Do not call' },
  { id: 'other', label: 'Other' },
] as const

/**
 * What agents see before a platform adds its own dispositions, and the set the
 * console offers as a starting point. Codes are stable: they come back in
 * webhooks.
 */
export const DEFAULT_DISPOSITIONS: { code: string; label: string; outcome: string }[] = [
  { code: 'APPT_SET', label: 'Appointment set', outcome: 'conversion' },
  { code: 'CALLBACK', label: 'Call back', outcome: 'callback' },
  { code: 'NOT_INTERESTED', label: 'Not interested', outcome: 'not_interested' },
  { code: 'LEFT_VM', label: 'Left voicemail', outcome: 'voicemail' },
  { code: 'NO_ANSWER', label: 'No answer', outcome: 'no_answer' },
  { code: 'WRONG_NUMBER', label: 'Wrong number', outcome: 'bad_number' },
  { code: 'DNC', label: 'Do not call', outcome: 'dnc' },
]

/**
 * Test-mode call outcomes, decided by the last digit of the number, so a
 * developer can make every path happen on purpose, the way test card numbers
 * work at a payment provider.
 */
export const TEST_NUMBERS: { ending: string; outcome: 'human' | 'machine' | 'no_answer' | 'busy'; label: string }[] = [
  { ending: '0–6', outcome: 'human', label: 'A person answers' },
  { ending: '7', outcome: 'machine', label: 'Voicemail answers (AMD: machine)' },
  { ending: '8', outcome: 'no_answer', label: 'Rings out, no answer' },
  { ending: '9', outcome: 'busy', label: 'Busy' },
]

export function testOutcomeFor(phone: string): 'human' | 'machine' | 'no_answer' | 'busy' {
  const last = phone.replace(/\D/g, '').slice(-1)
  return last === '7' ? 'machine' : last === '8' ? 'no_answer' : last === '9' ? 'busy' : 'human'
}

export interface Tier {
  id: 'sandbox' | 'launch' | 'scale' | 'partner'
  name: string
  price: string
  priceNote: string
  who: string
  features: string[]
  cta: 'start' | 'sales'
}

export const TIERS: Tier[] = [
  {
    id: 'sandbox', name: 'Sandbox', price: 'Free', priceNote: 'No card',
    who: 'Anyone building an integration.',
    features: ['Test keys and the full API', 'Webhooks with real payloads', 'The miniplayer in test mode', 'Every setting in the console', 'Nothing dials until you activate'],
    cta: 'start',
  },
  {
    id: 'launch', name: 'Launch', price: '$35', priceNote: 'per seat, per week, billed to the user',
    who: 'Platforms going live with user-paid seats.',
    features: ['Live keys', 'Each user pays inside the miniplayer', 'Preview, progressive, power and predictive', 'Revenue share to the platform', 'Weekly billing, cancel any week'],
    cta: 'start',
  },
  {
    id: 'scale', name: 'Scale', price: 'Negotiated', priceNote: 'volume and leverage based',
    who: 'Platforms paying for their users\' seats.',
    features: ['One weekly invoice for every seat', 'Seat-week, included dials and overage set to your volume', 'Platform-wide dial-mode policy with exceptions', 'Mixed billing: you cover some seats, users pay for others', 'Priority support'],
    cta: 'sales',
  },
  {
    id: 'partner', name: 'Partner', price: 'Custom', priceNote: 'by agreement',
    who: 'Large CRMs embedding at scale.',
    features: ['White-label miniplayer', 'Dedicated number pool', 'Custom terms and SLA', 'Co-marketing', 'A named contact at DialerSeat'],
    cta: 'sales',
  },
]
