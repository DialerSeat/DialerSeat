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
// `englishOnly`: the page has not been translated yet. It is served at its
// English address only, with no hreflang, so a search engine is never told a
// Spanish page exists when it would show English. Clear it once the strings
// are translated and the page switches to localizeMetadata.
// =============================================================================

export type ToolGroup = 'lists' | 'compliance' | 'callcenter' | 'sales'

export interface ToolEntry {
  slug: string
  name: string
  /** One line for the hub card: what the tool does, in the user's words. */
  blurb: string
  group: ToolGroup
  englishOnly: boolean
}

export const TOOL_GROUPS: { key: ToolGroup; label: string }[] = [
  { key: 'lists', label: msg("Phone numbers and lead lists") },
  { key: 'compliance', label: msg("Calling rules and compliance") },
  { key: 'callcenter', label: msg("Call center math") },
  { key: 'sales', label: msg("Cold calling and sales") },
]

export const TOOLS: ToolEntry[] = [
  { slug: 'lead-list-cleaner', name: msg("Lead list cleaner"), blurb: msg("Fix any lead sheet so it imports cleanly: headers, phones, states, names, duplicates."), group: 'lists', englishOnly: true },
  { slug: 'phone-number-formatter', name: msg("Phone number formatter"), blurb: msg("Clean a list into E.164 or (555) 555-0100, drop duplicates, flag numbers that can't be dialed."), group: 'lists', englishOnly: true },
  { slug: 'phone-number-extractor', name: msg("Phone number extractor"), blurb: msg("Pull every US and Canadian phone number out of pasted text, emails or a web page."), group: 'lists', englishOnly: true },
  { slug: 'area-code-lookup', name: msg("Area code lookup"), blurb: msg("Any area code or number: the state, the time zone, the local time there now."), group: 'lists', englishOnly: true },
  { slug: 'telemarketing-calling-hours', name: msg("Telemarketing calling hours"), blurb: msg("Can you call this state right now? The federal window in every lead's local time."), group: 'compliance', englishOnly: true },
  { slug: 'tcpa-compliance-checklist', name: msg("TCPA compliance checklist"), blurb: msg("The rules an outbound campaign has to meet, with the regulation behind each one."), group: 'compliance', englishOnly: true },
  { slug: 'dnc-registry-cost-calculator', name: msg("Do Not Call registry cost"), blurb: msg("What the National Do Not Call Registry will charge for the area codes you call."), group: 'compliance', englishOnly: true },
  { slug: 'abandon-rate-calculator', name: msg("Abandon rate calculator"), blurb: msg("Is a predictive campaign inside the US, UK or Canadian abandoned-call limit?"), group: 'compliance', englishOnly: false },
  { slug: 'erlang-c-calculator', name: msg("Erlang C staffing calculator"), blurb: msg("How many agents a queue needs to hit its service level, with occupancy and wait time."), group: 'callcenter', englishOnly: true },
  { slug: 'average-handle-time-calculator', name: msg("Average handle time calculator"), blurb: msg("Talk, hold and wrap-up time into AHT, and what each part costs you."), group: 'callcenter', englishOnly: true },
  { slug: 'calls-per-hour-calculator', name: msg("Calls per hour calculator"), blurb: msg("Your real dials per hour, and what more lines would do to it."), group: 'callcenter', englishOnly: true },
  { slug: 'contact-rate-calculator', name: msg("Answer, connect and contact rate"), blurb: msg("The three rates a dialer reports, each over the right denominator."), group: 'callcenter', englishOnly: true },
  { slug: 'cold-calls-per-day-calculator', name: msg("How many cold calls per day"), blurb: msg("Work back from a sales goal to the dials you need each day."), group: 'sales', englishOnly: true },
  { slug: 'cost-per-lead-calculator', name: msg("Cost per lead calculator"), blurb: msg("Cost per lead, per appointment and per sale, from one spend figure."), group: 'sales', englishOnly: true },
  { slug: 'cold-call-script-generator', name: msg("Cold call script generator"), blurb: msg("An opener, questions, a close and objection rebuttals for your industry."), group: 'sales', englishOnly: true },
  { slug: 'sales-voicemail-script-generator', name: msg("Sales voicemail scripts"), blurb: msg("Three voicemails under 30 seconds: first touch, follow-up and the last one."), group: 'sales', englishOnly: true },
  { slug: 'cold-calling-tracker', name: msg("Cold calling tracker"), blurb: msg("Log calls and outcomes in your browser and export the sheet. Nothing is uploaded."), group: 'sales', englishOnly: true },
  { slug: 'dialer-cost-calculator', name: msg("Dialer cost calculator"), blurb: msg("What eight dialers would bill for your team and the weeks you need."), group: 'sales', englishOnly: false },
]

export const toolPath = (slug: string) => `/tools/${slug}`

/** Tool pages served in English only (see `englishOnly` above). */
export const ENGLISH_ONLY_PATHS = new Set<string>([
  '/tools',
  ...TOOLS.filter((t) => t.englishOnly).map((t) => toolPath(t.slug)),
])
