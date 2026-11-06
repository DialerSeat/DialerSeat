import { msg } from '@/lib/i18n/msg'

// =============================================================================
// THE FREE TOOLS, ONE ENTRY EACH
// =============================================================================
// One list feeds the /tools hub, the sitemap and the resources rail, so a tool
// that exists is always listed and a listed tool always exists.
//
// Every tool here answers a query that Google autocomplete returned on
// 2026-11-04 (docs/seo/baseline-2026-11-04/autocomplete.json): a suggestion
// exists only because people type it. Each one is free, needs no account, and
// runs in the browser; the ones that read a list never send it anywhere.
//
// =============================================================================

export type ToolGroup = 'lists' | 'compliance' | 'callcenter' | 'sales'

export interface ToolEntry {
  slug: string
  name: string
  /** One line for the hub card: what the tool does, in the user's words. */
  blurb: string
  group: ToolGroup
}

export const TOOL_GROUPS: { key: ToolGroup; label: string }[] = [
  { key: 'lists', label: msg("Phone numbers and lead lists") },
  { key: 'compliance', label: msg("Calling rules and compliance") },
  { key: 'callcenter', label: msg("Call center math") },
  { key: 'sales', label: msg("Cold calling and sales") },
]

export const TOOLS: ToolEntry[] = [
  { slug: 'lead-list-cleaner', name: msg("Lead list cleaner"), blurb: msg("Fix any lead sheet so it imports cleanly: headers, phones, states, names, duplicates."), group: 'lists' },
  { slug: 'phone-number-formatter', name: msg("Phone number formatter"), blurb: msg("Clean a list into E.164 or (555) 555-0100, drop duplicates, flag numbers that can't be dialed."), group: 'lists' },
  { slug: 'phone-number-extractor', name: msg("Phone number extractor"), blurb: msg("Pull every US and Canadian phone number out of pasted text, emails or a web page."), group: 'lists' },
  { slug: 'area-code-lookup', name: msg("Area code lookup"), blurb: msg("Any area code or number: the state, the time zone, the local time there now."), group: 'lists' },
  { slug: 'telemarketing-calling-hours', name: msg("Telemarketing calling hours"), blurb: msg("Can you call this state right now? The federal window in every lead's local time."), group: 'compliance' },
  { slug: 'tcpa-compliance-checklist', name: msg("TCPA compliance checklist"), blurb: msg("The rules an outbound campaign has to meet, with the regulation behind each one."), group: 'compliance' },
  { slug: 'dnc-registry-cost-calculator', name: msg("Do Not Call registry cost"), blurb: msg("What the National Do Not Call Registry will charge for the area codes you call."), group: 'compliance' },
  { slug: 'state-do-not-call-lists', name: msg("State Do Not Call lists"), blurb: msg("Eleven states' own rules, read from each state's site: who runs the list, what it costs, how often it changes."), group: 'compliance' },
  { slug: 'abandon-rate-calculator', name: msg("Abandon rate calculator"), blurb: msg("Is a predictive campaign inside the US, UK or Canadian abandoned-call limit?"), group: 'compliance' },
  { slug: 'erlang-c-calculator', name: msg("Erlang C staffing calculator"), blurb: msg("How many agents a queue needs to hit its service level, with occupancy and wait time."), group: 'callcenter' },
  { slug: 'average-handle-time-calculator', name: msg("Average handle time calculator"), blurb: msg("Talk, hold and wrap-up time into AHT, and what each part costs you."), group: 'callcenter' },
  { slug: 'calls-per-hour-calculator', name: msg("Calls per hour calculator"), blurb: msg("Your real dials per hour, and what more lines would do to it."), group: 'callcenter' },
  { slug: 'contact-rate-calculator', name: msg("Answer, connect and contact rate"), blurb: msg("The three rates a dialer reports, each over the right denominator."), group: 'callcenter' },
  { slug: 'cold-calls-per-day-calculator', name: msg("How many cold calls per day"), blurb: msg("Work back from a sales goal to the dials you need each day."), group: 'sales' },
  { slug: 'cost-per-lead-calculator', name: msg("Cost per lead calculator"), blurb: msg("Cost per lead, per appointment and per sale, from one spend figure."), group: 'sales' },
  { slug: 'cold-call-script-generator', name: msg("Cold call script generator"), blurb: msg("An opener, questions, a close and objection rebuttals for your industry."), group: 'sales' },
  { slug: 'sales-voicemail-script-generator', name: msg("Sales voicemail scripts"), blurb: msg("Three voicemails under 30 seconds: first touch, follow-up and the last one."), group: 'sales' },
  { slug: 'cold-calling-tracker', name: msg("Cold calling tracker"), blurb: msg("Log calls and outcomes in your browser and export the sheet. Nothing is uploaded."), group: 'sales' },
  { slug: 'dialer-cost-calculator', name: msg("Dialer cost calculator"), blurb: msg("What eight dialers would bill for your team and the weeks you need."), group: 'sales' },
]

export const toolPath = (slug: string) => `/tools/${slug}`
