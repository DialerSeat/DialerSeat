import type { Competitor } from '@/lib/competitors'

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
//   - English only for now: these are English search phrases and have no
//     translations. components/RelatedLinks shows nothing on a translated page.
// =============================================================================

export interface RelatedLink {
  href: string
  label: string
}

const SEGMENT: Record<Competitor['segment'], RelatedLink[]> = {
  call_center: [
    { href: '/faq/is-a-predictive-dialer-legal', label: 'Is a predictive dialer legal?' },
    { href: '/faq/how-does-amd-work', label: 'Answering machine detection' },
    { href: '/tools/abandon-rate-calculator', label: 'Abandon rate formula' },
    { href: '/tools/erlang-c-calculator', label: 'Call center staffing calculator' },
    { href: '/faq/why-we-charge', label: 'Predictive dialer pricing' },
  ],
  real_estate: [
    { href: '/faq/dialer-for-real-estate', label: 'Power dialer for real estate' },
    { href: '/faq/local-presence-dialing', label: 'Local presence dialing' },
    { href: '/faq/how-to-remove-spam-likely', label: 'How to remove Spam Likely' },
    { href: '/tools/lead-list-cleaner', label: 'Lead list cleaner' },
    { href: '/faq/why-we-charge', label: 'Power dialer pricing' },
  ],
  sales_crm: [
    { href: '/dialing-modes/power', label: 'Power dialer vs predictive dialer' },
    { href: '/faq/what-is-a-parallel-dialer', label: 'Parallel dialer vs power dialer' },
    { href: '/faq/send-leads-from-your-crm', label: 'Send leads from your CRM' },
    { href: '/faq/why-we-charge', label: 'Power dialer pricing' },
  ],
  phone_system: [
    { href: '/faq/what-is-an-auto-dialer', label: 'What is an auto dialer?' },
    { href: '/faq/why-calls-show-spam-likely', label: 'Why calls show Spam Likely' },
    { href: '/faq/how-many-numbers-do-i-need', label: 'How many numbers do you need?' },
    { href: '/faq/why-we-charge', label: 'Auto dialer pricing' },
  ],
}

/** On top of the segment's links, for pages with a more specific question. */
const COMPETITOR_EXTRA: Record<string, RelatedLink[]> = {
  gohighlevel: [
    { href: '/faq/send-leads-from-your-crm', label: 'Power dialer for GoHighLevel' },
    { href: '/faq/local-presence-dialing', label: 'Local presence dialing' },
  ],
  hubspot: [{ href: '/faq/send-leads-from-your-crm', label: 'Dialer for HubSpot' }],
  ringcentral: [{ href: '/faq/local-presence-dialing', label: 'Local presence dialing' }],
  'dialer-io': [{ href: '/faq/why-dialerseat', label: 'Why DialerSeat' }],
}

const COMPETITOR_ALL: RelatedLink[] = [
  { href: '/tools/dialer-cost-calculator', label: 'Dialer cost calculator' },
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

const COMPARE_ALL: RelatedLink = { href: '/vs/everyone', label: 'DialerSeat vs every other dialer' }
const PRICING_INDEX: RelatedLink = { href: '/data/dialer-pricing', label: 'Dialer pricing index' }

/** Links for an FAQ or explainer page, keyed by its route. */
export const RELATED_BY_ROUTE: Record<string, RelatedLink[]> = {
  '/dialing-modes/power': [
    { href: '/vs/phoneburner', label: 'PhoneBurner alternative' },
    { href: '/vs/kixie', label: 'Kixie alternative' },
    { href: '/vs/mojo', label: 'Mojo Dialer alternative' },
  ],
  '/dialing-modes/predictive': [
    { href: '/vs/readymode', label: 'ReadyMode alternative' },
    { href: '/vs/convoso', label: 'Convoso alternative' },
    { href: '/faq/is-a-predictive-dialer-legal', label: 'Is a predictive dialer legal?' },
  ],
  '/faq/what-is-a-parallel-dialer': [
    { href: '/vs/orum', label: 'Orum alternative' },
    { href: '/dialing-modes/power', label: 'Power dialer vs predictive dialer' },
  ],
  '/faq/what-is-an-auto-dialer': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-insurance-agents': [
    { href: '/vs/readymode', label: 'ReadyMode alternative' },
    { href: '/vs/convoso', label: 'Convoso alternative' },
    { href: '/vs/calltools', label: 'CallTools alternative' },
  ],
  '/faq/dialer-for-call-centers': [
    { href: '/vs/five9', label: 'Five9 alternative' },
    { href: '/vs/vicidial', label: 'VICIdial alternative' },
    { href: '/vs/talkdesk', label: 'Talkdesk alternative' },
  ],
  '/faq/dialer-for-real-estate': [{ href: '/vs/wavv', label: 'WAVV alternative' }],
  '/faq/dialer-for-offshore-agents': [COMPARE_ALL],
  '/faq/dialer-for-mortgage': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-solar': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-debt-collection': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-recruiters': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-fundraising': [COMPARE_ALL, PRICING_INDEX],
  '/faq/dialer-for-b2b-sales': [
    { href: '/vs/orum', label: 'Orum alternative' },
    { href: '/vs/kixie', label: 'Kixie alternative' },
    PRICING_INDEX,
  ],
  '/faq/send-leads-from-your-crm': [
    { href: '/vs/gohighlevel', label: 'GoHighLevel alternative' },
    { href: '/vs/hubspot', label: 'HubSpot calling alternative' },
  ],
  '/faq/local-presence-dialing': [
    { href: '/vs/gohighlevel', label: 'GoHighLevel alternative' },
    { href: '/vs/ringcentral', label: 'RingCentral alternative' },
  ],
  '/faq/why-we-charge': [
    { href: '/vs/readymode', label: 'ReadyMode alternative' },
    { href: '/vs/mojo', label: 'Mojo Dialer alternative' },
    PRICING_INDEX,
  ],
  '/faq/why-dialerseat': [COMPARE_ALL, PRICING_INDEX],
  '/faq/how-to-remove-spam-likely': [
    { href: '/faq/why-we-dont-rest-flagged-numbers', label: 'Why resting a flagged number backfires' },
    { href: '/faq/how-we-keep-numbers-clean', label: 'Number reputation and A-level attestation' },
  ],
  '/faq/10dlc-and-outbound-calling': [
    { href: '/faq/how-to-remove-spam-likely', label: 'Free Caller Registry and Spam Likely' },
  ],
  '/faq/how-we-keep-compliance': [
    { href: '/tools/state-do-not-call-lists', label: 'State do not call lists' },
  ],
  '/faq/calling-hours': [
    { href: '/tools/state-do-not-call-lists', label: 'State do not call lists' },
  ],
  '/vs/manual-dialing': [
    { href: '/tools/calls-per-hour-calculator', label: 'Calls per hour calculator' },
    { href: '/faq/what-is-an-auto-dialer', label: 'What is an auto dialer?' },
    { href: '/dialing-modes/power', label: 'Power dialer vs predictive dialer' },
  ],
}
