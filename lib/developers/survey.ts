// The questions asked when a project is created, as data: the /new page draws
// them as bubble grids, the server checks answers against them, and the setup
// page reads the answers to choose what to show first.

import type { Approach, ProjectProfile } from './store'

export interface SurveyOption { id: string; label: string; hint?: string }
export interface SurveyQuestion {
  key: keyof ProjectProfile | 'integration_approach'
  title: string
  sub: string
  multi: boolean
  options: SurveyOption[]
}

export const APPROACHES: (SurveyOption & { id: Approach; best: string })[] = [
  { id: 'script', label: 'Script tag', hint: 'Paste one script and a div. The dialer mounts itself.', best: 'Most web apps. About ten minutes.' },
  { id: 'react', label: 'React component', hint: 'A small component that wraps the script, with typed events.', best: 'React, Next.js and similar front ends.' },
  { id: 'iframe', label: 'Plain iframe', hint: 'An iframe pointed at a session URL. No script on your page.', best: 'Strict CSP, older pages, page builders.' },
  { id: 'hosted', label: 'Hosted dialer link', hint: 'Open the dialer in its own tab or window from a button.', best: 'The fastest start. No front-end work.' },
  { id: 'headless', label: 'Headless (API and webhooks)', hint: 'Your own screens for leads and results; the dialer opens only to call.', best: 'Early access: calls still start from the dialer.' },
]

export const SURVEY: SurveyQuestion[] = [
  { key: 'kind', title: 'What are you building?', sub: 'Pick the one closest to your product.', multi: false, options: [
    { id: 'crm', label: 'A CRM' }, { id: 'lead_platform', label: 'A lead platform or marketplace' },
    { id: 'call_center', label: 'Call center software' }, { id: 'agency_tool', label: 'An agency or marketing tool' },
    { id: 'vertical_saas', label: 'Software for one industry' }, { id: 'internal_tool', label: 'An internal tool for my team' },
    { id: 'other', label: 'Something else' },
  ] },
  { key: 'audience', title: 'Who will be dialing?', sub: 'Choose every group that fits.', multi: true, options: [
    { id: 'insurance', label: 'Insurance agents' }, { id: 'real_estate', label: 'Real estate agents' },
    { id: 'mortgage', label: 'Mortgage and lending' }, { id: 'solar', label: 'Solar and home services' },
    { id: 'sdr', label: 'SDR and BDR teams' }, { id: 'recruiting', label: 'Recruiters' },
    { id: 'collections', label: 'Collections' }, { id: 'nonprofit', label: 'Nonprofits and campaigns' },
    { id: 'other', label: 'Others' },
  ] },
  { key: 'goals', title: 'What should DialerSeat do for you?', sub: 'Choose every goal that matters.', multi: true, options: [
    { id: 'add_calling', label: 'Add calling to my product' }, { id: 'resell_seats', label: 'Sell dialer seats to my users' },
    { id: 'replace_dialer', label: 'Replace the dialer we use now' }, { id: 'log_calls', label: 'Log every call in my CRM' },
    { id: 'own_dispositions', label: 'Use my own dispositions' }, { id: 'volume', label: 'Dial high volume' },
    { id: 'stay_in_app', label: 'Keep agents inside my app' }, { id: 'compliance', label: 'Calling hours and DNC handled' },
  ] },
  { key: 'modes', title: 'Which dial modes do your users need?', sub: 'You can change this any time in the console.', multi: true, options: [
    { id: 'preview', label: 'Preview', hint: 'The agent sees the lead, then dials' },
    { id: 'progressive', label: 'Progressive', hint: 'Dials the next lead when the agent is free' },
    { id: 'power', label: 'Power', hint: 'Several lines per agent' },
    { id: 'predictive', label: 'Predictive', hint: 'Paced by answer rates' },
    { id: 'unsure', label: 'Not sure yet' },
  ] },
  { key: 'billing', title: 'How do your users pay you?', sub: 'DialerSeat bills you, the owner. Your users never see a DialerSeat bill.', multi: false, options: [
    { id: 'stripe_subscription', label: 'A subscription on Stripe' }, { id: 'other_subscription', label: 'A subscription on another biller' },
    { id: 'per_seat', label: 'Per seat or per user' }, { id: 'included', label: 'Included in my plan' },
    { id: 'not_yet', label: 'Not charging yet' },
  ] },
  { key: 'size', title: 'How many people will dial in the first three months?', sub: 'A rough guess is fine.', multi: false, options: [
    { id: '1-10', label: '1 to 10' }, { id: '11-50', label: '11 to 50' }, { id: '51-250', label: '51 to 250' },
    { id: '251-1000', label: '251 to 1,000' }, { id: '1000+', label: 'More than 1,000' },
  ] },
  { key: 'integration_approach', title: 'How do you want to put the dialer in?', sub: 'Setup shows the code for this first. You can switch any time.', multi: false, options: APPROACHES },
]

/** Keep only answers that are real options, so a stored profile never holds free text from a request. */
export function cleanProfile(raw: unknown): { profile: ProjectProfile; approach: Approach | null } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const profile: ProjectProfile = {}
  let approach: Approach | null = null
  for (const q of SURVEY) {
    const ids = new Set(q.options.map(o => o.id))
    const v = r[q.key]
    if (q.key === 'integration_approach') { if (typeof v === 'string' && ids.has(v)) approach = v as Approach; continue }
    if (q.multi) {
      const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ids.has(x)) : []
      if (arr.length) (profile as Record<string, unknown>)[q.key] = [...new Set(arr)]
    } else if (typeof v === 'string' && ids.has(v)) {
      (profile as Record<string, unknown>)[q.key] = v
    }
  }
  return { profile, approach }
}

type Mode = 'preview' | 'progressive' | 'power' | 'predictive'

/** The dial modes a new project allows, from its answers: what they picked, or all four. */
export function modesFromProfile(p: ProjectProfile): Mode[] {
  const all: Mode[] = ['preview', 'progressive', 'power', 'predictive']
  const picked = all.filter(m => p.modes?.includes(m))
  return picked.length ? picked : all
}
