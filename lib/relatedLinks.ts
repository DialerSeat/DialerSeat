import type { Competitor } from '@/lib/competitors'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// THE LINKS BETWEEN FAQ ANSWERS AND COMPARISON PAGES
// =============================================================================
// A crawl on 2026-11-05 found 42 of 46 FAQ pages had no link from any /vs/ page
// and 15 of 32 competitor pages had none from an FAQ page. Plan and reasoning:
// docs/seo/internal-link-map.md. One list, so a link is added or removed once.
//
// Rules for what goes here:
//   - Link text is the phrase people search (Google autocomplete, 4-5 Nov), and
//     only where the page it points to really answers it. No "best" and no
//     "cheapest" as bare claims: the phrase has to be true of the target.
//   - A href is the canonical address. /faq/what-is-a-power-dialer and
//     /faq/what-is-a-predictive-dialer declare /dialing-modes/* as canonical, so
//     links go there. tests/unit/relatedLinks.test.ts checks every target exists.
//   - Translated in all 12 languages, using each dictionary's existing words for
//     the same terms.
// =============================================================================

export interface RelatedLink {
  href: string
  label: string
  vars?: Record<string, string>
}

const ALT = msg("{name} alternative")

const SEGMENT: Record<Competitor['segment'], RelatedLink[]> = {
  call_center: [
    { href: '/faq/is-a-predictive-dialer-legal', label: msg("Is a predictive dialer legal?") },
    { href: '/faq/how-does-amd-work', label: msg("Answering machine detection") },
    { href: '/tools/abandon-rate-calculator', label: msg("Abandon rate formula") },
    { href: '/tools/erlang-c-calculator', label: msg("Call center staffing calculator") },
    { href: '/faq/dialer-for-call-centers', label: msg("Dialer for call centers") },
    { href: '/faq/why-we-charge', label: msg("Predictive dialer pricing") },
  ],
  real_estate: [
    { href: '/faq/dialer-for-real-estate', label: msg("Power dialer for real estate") },
    { href: '/faq/local-presence-dialing', label: msg("Local presence dialing") },
    { href: '/faq/how-to-remove-spam-likely', label: msg("How to remove Spam Likely") },
    { href: '/tools/lead-list-cleaner', label: msg("Lead list cleaner") },
    { href: '/faq/cheapest-power-dialer', label: msg("Cheapest power dialer") },
    { href: '/faq/why-we-charge', label: msg("Power dialer pricing") },
  ],
  sales_crm: [
    { href: '/dialing-modes/power', label: msg("Power dialer vs predictive dialer") },
    { href: '/faq/what-is-a-parallel-dialer', label: msg("Parallel dialer vs power dialer") },
    { href: '/faq/send-leads-from-your-crm', label: msg("Send leads from your CRM") },
    { href: '/faq/dialer-for-b2b-sales', label: msg("Dialer for B2B sales") },
    { href: '/faq/cheapest-power-dialer', label: msg("Cheapest power dialer") },
    { href: '/faq/why-we-charge', label: msg("Power dialer pricing") },
  ],
  phone_system: [
    { href: '/faq/what-is-an-auto-dialer', label: msg("What is an auto dialer?") },
    { href: '/faq/why-calls-show-spam-likely', label: msg("Why calls show Spam Likely") },
    { href: '/faq/how-many-numbers-do-i-need', label: msg("How many numbers do you need?") },
    { href: '/faq/why-we-charge', label: msg("Auto dialer pricing") },
  ],
}

/** On top of the segment's links, for pages with a more specific question. */
const COMPETITOR_EXTRA: Record<string, RelatedLink[]> = {
  gohighlevel: [
    { href: '/faq/send-leads-from-your-crm', label: msg("Power dialer for GoHighLevel") },
    { href: '/faq/local-presence-dialing', label: msg("Local presence dialing") },
  ],
  hubspot: [{ href: '/faq/send-leads-from-your-crm', label: msg("Dialer for HubSpot") }],
  ringcentral: [{ href: '/faq/local-presence-dialing', label: msg("Local presence dialing") }],
  'dialer-io': [{ href: '/faq/why-dialerseat', label: msg("Why DialerSeat?") }],
}

const COMPETITOR_ALL: RelatedLink[] = [
  { href: '/tools/dialer-cost-calculator', label: msg("Dialer cost calculator") },
]

/** Links for a /vs/<competitor> page, without repeating a target. */
export function relatedForCompetitor(c: Pick<Competitor, 'slug' | 'segment'>): RelatedLink[] {
  const seen = new Set<string>()
  // Specific first: a page's own phrase beats its segment's for the same target.
  return [...(COMPETITOR_EXTRA[c.slug] ?? []), ...SEGMENT[c.segment], ...COMPETITOR_ALL].filter((l) => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  })
}

const COMPARE_ALL: RelatedLink = { href: '/vs/everyone', label: msg("DialerSeat vs every other dialer") }
const PRICING_INDEX: RelatedLink = { href: '/data/dialer-pricing', label: msg("Dialer pricing index") }

/** Links for an FAQ or explainer page, keyed by its route. */
export const RELATED_BY_ROUTE: Record<string, RelatedLink[]> = {
  '/faq/cheapest-power-dialer': [
    { href: '/data/dialer-pricing', label: msg("Dialer pricing index") },
    { href: '/pricing', label: msg("DialerSeat pricing") },
    { href: '/vs/phoneburner', label: ALT, vars: { name: "PhoneBurner" } },
    { href: '/vs/mojo', label: ALT, vars: { name: "Mojo Dialer" } },
    { href: '/vs/cloudtalk', label: ALT, vars: { name: "CloudTalk" } },
  ],
  '/dialing-modes/power': [
    { href: '/vs/phoneburner', label: ALT, vars: { name: "PhoneBurner" } },
    { href: '/vs/kixie', label: ALT, vars: { name: "Kixie" } },
    { href: '/vs/mojo', label: ALT, vars: { name: "Mojo Dialer" } },
  ],
  '/dialing-modes/predictive': [
    { href: '/vs/readymode', label: ALT, vars: { name: "ReadyMode" } },
    { href: '/vs/convoso', label: ALT, vars: { name: "Convoso" } },
    { href: '/faq/is-a-predictive-dialer-legal', label: msg("Is a predictive dialer legal?") },
  ],
  '/faq/what-is-a-parallel-dialer': [
    { href: '/vs/orum', label: ALT, vars: { name: "Orum" } },
    { href: '/dialing-modes/power', label: msg("Power dialer vs predictive dialer") },
  ],
  '/faq/what-is-an-auto-dialer': [
    COMPARE_ALL,
    PRICING_INDEX,
    { href: '/vs/manual-dialing', label: msg("Dialer vs dialing by hand") },
    { href: '/vs/dialpad', label: ALT, vars: { name: "Dialpad" } },
    { href: '/vs/nextiva', label: ALT, vars: { name: "Nextiva" } },
    { href: '/vs/cloudtalk', label: ALT, vars: { name: "CloudTalk" } },
    { href: '/vs/ringover', label: ALT, vars: { name: "Ringover" } },
    { href: '/vs/3cx', label: ALT, vars: { name: "3CX" } },
  ],
  '/faq/dialer-for-insurance-agents': [
    { href: '/vs/readymode', label: ALT, vars: { name: "ReadyMode" } },
    { href: '/vs/convoso', label: ALT, vars: { name: "Convoso" } },
    { href: '/vs/calltools', label: ALT, vars: { name: "CallTools" } },
  ],
  '/faq/dialer-for-call-centers': [
    { href: '/vs/five9', label: ALT, vars: { name: "Five9" } },
    { href: '/vs/vicidial', label: ALT, vars: { name: "VICIdial" } },
    { href: '/vs/talkdesk', label: ALT, vars: { name: "Talkdesk" } },
    { href: '/vs/dialedin', label: ALT, vars: { name: "DialedIn" } },
    { href: '/vs/ytel', label: ALT, vars: { name: "Ytel" } },
  ],
  '/faq/dialer-for-real-estate': [
    { href: '/vs/wavv', label: ALT, vars: { name: "WAVV" } },
    { href: '/vs/smrtphone', label: ALT, vars: { name: "smrtPhone" } },
  ],
  '/faq/dialer-for-offshore-agents': [COMPARE_ALL],
  '/faq/dialer-for-mortgage': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-solar': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-debt-collection': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-recruiters': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-fundraising': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-b2b-sales': [
    { href: '/vs/orum', label: ALT, vars: { name: "Orum" } },
    { href: '/vs/kixie', label: ALT, vars: { name: "Kixie" } },
    { href: '/vs/aloware', label: ALT, vars: { name: "Aloware" } },
    PRICING_INDEX,
  ],
  '/faq/send-leads-from-your-crm': [
    { href: '/vs/gohighlevel', label: ALT, vars: { name: "GoHighLevel" } },
    { href: '/vs/hubspot', label: ALT, vars: { name: "HubSpot" } },
  ],
  '/faq/local-presence-dialing': [
    { href: '/vs/gohighlevel', label: ALT, vars: { name: "GoHighLevel" } },
    { href: '/vs/ringcentral', label: ALT, vars: { name: "RingCentral" } },
  ],
  '/faq/why-we-charge': [
    { href: '/vs/readymode', label: ALT, vars: { name: "ReadyMode" } },
    { href: '/vs/mojo', label: ALT, vars: { name: "Mojo Dialer" } },
    PRICING_INDEX,
  ],
  '/faq/why-dialerseat': [COMPARE_ALL, PRICING_INDEX, { href: '/vs/dialer-io', label: msg("DialerSeat vs Dialer.io") }],
  '/faq/how-to-remove-spam-likely': [
    { href: '/faq/why-we-dont-rest-flagged-numbers', label: msg("Why resting a flagged number backfires") },
    { href: '/faq/how-we-keep-numbers-clean', label: msg("Number reputation and A-level attestation") },
  ],
  '/faq/10dlc-and-outbound-calling': [
    { href: '/faq/how-to-remove-spam-likely', label: msg("Free Caller Registry and Spam Likely") },
  ],
  '/faq/how-we-keep-compliance': [
    { href: '/tools/state-do-not-call-lists', label: msg("State do not call lists") },
  ],
  '/faq/calling-hours': [
    { href: '/tools/state-do-not-call-lists', label: msg("State do not call lists") },
  ],
  '/vs/manual-dialing': [
    { href: '/tools/calls-per-hour-calculator', label: msg("Calls per hour calculator") },
    { href: '/faq/what-is-an-auto-dialer', label: msg("What is an auto dialer?") },
    { href: '/dialing-modes/power', label: msg("Power dialer vs predictive dialer") },
  ],
}
