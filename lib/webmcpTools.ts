import { DIALERSEAT_WEEKLY } from '@/lib/weeklyBilling'
import type { WebMcpTool } from '@/lib/useWebMcpTool'

// =============================================================================
// WEBMCP TOOL DEFINITIONS — what an AI agent is told each calculator does
// =============================================================================
// Read by the agent, not shown on the page, so they stay in English in every
// language and live here rather than in the components (scripts/i18n/extract
// collects prose from components the public pages import; lib/ it leaves
// alone). The components add execute, which runs the same calculation the page
// shows. Facts here must match the calculators and lib/weeklyBilling.
// =============================================================================

type Definition = Omit<WebMcpTool, 'execute'>

export const ABANDON_RATE_RULES = ['us', 'uk', 'ca'] as const

export const ABANDON_RATE_TOOL: Definition = {
  name: 'check_abandoned_call_rate',
  title: 'Abandoned-call rate check',
  description:
    'Checks whether a predictive dialing campaign is inside the legal abandoned-call limit. US: FTC Telemarketing Sales Rule, 3% of calls answered by a person, per campaign, each 30-day period. UK: Ofcom, 3% of live calls, per campaign, each 24 hours. Canada: CRTC, 5% of calls answered, each calendar month. Returns the rate, the limit, the most abandoned calls the limit allows and the headroom left, and shows the result in the calculator on this page.',
  inputSchema: {
    type: 'object',
    properties: {
      rule: { type: 'string', enum: ABANDON_RATE_RULES, description: 'us (FTC TSR), uk (Ofcom) or ca (CRTC). Defaults to us.' },
      answered: { type: 'integer', minimum: 0, description: 'Calls answered by a person in the measurement window. Not dials.' },
      abandoned: { type: 'integer', minimum: 0, description: 'Answered calls with no agent connected within 2 seconds, in the same window.' },
    },
    required: ['answered', 'abandoned'],
  },
  annotations: { readOnlyHint: true },
}

export const DIALER_COST_TOOL: Definition = {
  name: 'compare_dialer_cost',
  title: 'Dialer cost comparison',
  description:
    `Totals what a number of agents dialing for a number of weeks costs on DialerSeat ($${DIALERSEAT_WEEKLY} per seat per week, billed weekly, no contract) and on multi-line and predictive dialers billed by the month or year, with each one's seat minimum and shortest term applied. Competitor figures are the lowest published price that includes multi-line or predictive dialing, before add-ons, setup fees and usage, as published September 2026; a tool sold only by quote returns null. Also shows the result in the calculator on this page.`,
  inputSchema: {
    type: 'object',
    properties: {
      weeks: { type: 'integer', minimum: 1, maximum: 104, description: 'Weeks of dialing.' },
      seats: { type: 'integer', minimum: 1, maximum: 500, description: 'Agents dialing at the same time.' },
    },
    required: ['weeks', 'seats'],
  },
  annotations: { readOnlyHint: true },
}
