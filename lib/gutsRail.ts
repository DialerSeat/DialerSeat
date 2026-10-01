import type { RailGroup } from '@/components/GutsShell'
import { COMPETITORS } from '@/lib/competitors'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// THE RAIL, ONCE
// =============================================================================
// Every /vs and /faq article carries the same navigation rail. Building it per
// page is how you end up with eleven pages that list Dialing Modes and ten
// that do not, so the shape lives here and each page passes its own slug.
//
// These are the RAIL lists, deliberately short. app/faq/view.tsx and
// app/vs/view.tsx keep their own fuller indexes with descriptions, dates and
// search aliases, because a directory column and a sidebar are answering
// different questions: "what is everything you have" against "where else
// would I go from here".
// =============================================================================

/** Shown on every article, /vs and /faq alike. */
const SITE_INFO: RailGroup = {
  label: msg("SITE INFO"),
  items: [
    { href: '/privacy', label: msg("Privacy Policy") },
    { href: '/terms', label: msg("Terms of Use") },
  ],
}

/**
 * The data pages and tools, on every article.
 *
 * These are the pages built to be cited and linked to from other sites, and a
 * page only collects links if people can find it. Putting them on the rail
 * means every /vs and /faq article, over a hundred pages, links to each one,
 * which is also what tells a crawler they matter.
 */
const RESOURCES: RailGroup = {
  label: msg("RESOURCES"),
  items: [
    { href: '/pricing', label: msg("Pricing: a week costs a week") },
    { href: '/data/dialer-pricing', label: msg("Dialer pricing index") },
    { href: '/data/calling-rules-by-country', label: msg("Calling rules by country") },
    { href: '/data/connect-rates', label: msg("Connect rates by state & hour") },
    { href: '/tools/dialer-cost-calculator', label: msg("Dialer cost calculator") },
    { href: '/tools/abandon-rate-calculator', label: msg("Abandon rate calculator") },
    { href: '/resources', label: msg("All resources") },
  ],
}

/**
 * One page per industry, on every /faq article.
 *
 * The industry pages are what a buyer searching "dialer for <their trade>"
 * lands on, and each is only as strong as the links into it.
 */
const INDUSTRIES: RailGroup = {
  label: msg("BY INDUSTRY"),
  items: [
    { href: '/faq/dialer-for-insurance-agents', label: msg("Insurance") },
    { href: '/faq/dialer-for-real-estate', label: msg("Real estate") },
    { href: '/faq/dialer-for-mortgage', label: msg("Mortgage") },
    { href: '/faq/dialer-for-solar', label: msg("Solar") },
    { href: '/faq/dialer-for-debt-collection', label: msg("Debt collection") },
    { href: '/faq/dialer-for-call-centers', label: msg("Call centers") },
    { href: '/faq/dialer-for-b2b-sales', label: msg("B2B sales & SDRs") },
    { href: '/faq/dialer-for-recruiters', label: msg("Recruiting") },
    { href: '/faq/dialer-for-fundraising', label: msg("Fundraising") },
    { href: '/faq/dialer-for-offshore-agents', label: msg("Offshore agents") },
  ],
}

/** The rail for a /data, /tools or /pricing page. */
export function resourcesRail(activePath?: string): RailGroup[] {
  return [
    {
      label: msg("MAIN MENU"),
      items: [
        { href: '/?view=landing', label: msg("Home") },
        { href: '/faq', label: msg("FAQ") },
        { href: '/vs', label: msg("Comparisons") },
      ],
    },
    { ...INDUSTRIES, items: INDUSTRIES.items.filter((i) => i.href !== activePath) },
    { ...RESOURCES, items: RESOURCES.items.filter((i) => i.href !== activePath) },
    SITE_INFO,
  ]
}

/** The competitors worth putting one click away, most cross-shopped first. */
const RAIL_COMPETITORS = [
  'readymode',
  'mojo',
  'phoneburner',
  'batchdialer',
  'five9',
  'convoso',
  'vicidial',
  'kixie',
]

/** Canonical display name for a competitor slug, read from the same source
 *  the pages themselves render from so the rail can never drift from them. */
function competitorName(slug: string): string | null {
  return COMPETITORS.find((c) => c.slug === slug)?.name ?? null
}

/**
 * The rail for a /vs article.
 *
 * `activeSlug` is dropped from OTHER VS PAGES — a sidebar that offers you the
 * page you are already on wastes one of eight slots and reads as a mistake.
 */
export function vsRail(activeSlug?: string): RailGroup[] {
  const others = RAIL_COMPETITORS.filter((slug) => slug !== activeSlug)
    .map((slug) => {
      const name = competitorName(slug)
      return name ? { href: `/vs/${slug}`, label: `DialerSeat vs ${name}` } : null
    })
    .filter((x): x is { href: string; label: string } => x !== null)
    .slice(0, 7)

  return [
    {
      label: msg("MAIN MENU"),
      items: [
        { href: '/?view=landing', label: msg("Home") },
        { href: '/vs', label: msg("All Comparisons") },
        { href: '/faq', label: msg("FAQ") },
      ],
    },
    {
      label: msg("OTHER VS PAGES"),
      items: [
        ...others,
        { href: '/vs/everyone', label: msg("Every legacy dialer") },
        { href: '/vs/teams', label: msg("Dialer pricing for teams") },
        { href: '/vs', label: msg("All dialer comparisons") },
      ],
    },
    RESOURCES,
    SITE_INFO,
  ]
}

/**
 * The rail for /privacy and /terms.
 *
 * MAIN MENU and SITE INFO only. Somebody reading the privacy policy is not
 * part-way through the FAQ, so offering them seven other answers is noise —
 * and SITE INFO already holds the other legal page, which is the one link
 * that actually follows from being on this one.
 */
export function legalRail(): RailGroup[] {
  return [
    {
      label: msg("MAIN MENU"),
      items: [
        { href: '/?view=landing', label: msg("Home") },
        { href: '/faq', label: msg("FAQ") },
        { href: '/vs', label: msg("Comparisons") },
      ],
    },
    SITE_INFO,
  ]
}

/** The questions worth putting one click away from any answer page. */
const RAIL_ANSWERS: { href: string; label: string }[] = [
  { href: '/faq/why-dialerseat', label: msg("Why DialerSeat?") },
  { href: '/faq/why-we-charge', label: msg("Why we charge what we charge") },
  { href: '/faq/billing', label: msg("Billing & cancellation") },
  { href: '/faq/dialer-modes', label: 'Dialer modes (TL;DR)' },
  { href: '/faq/how-we-keep-compliance', label: msg("How we keep compliance") },
  { href: '/faq/numbers', label: msg("Phone numbers & caller ID") },
  { href: '/faq/leads', label: msg("Uploading & managing leads") },
  { href: '/faq/manager-plus', label: msg("What Manager+ adds") },
]

/**
 * The rail for a /faq article. `activePath` is the page's own route, dropped
 * from the list for the same reason as above.
 */
export function faqRail(activePath?: string): RailGroup[] {
  const others = RAIL_ANSWERS.filter((a) => a.href !== activePath).slice(0, 7)

  return [
    {
      label: msg("MAIN MENU"),
      items: [
        { href: '/?view=landing', label: msg("Home") },
        { href: '/faq', label: msg("FAQ") },
        { href: '/vs', label: msg("Comparisons") },
      ],
    },
    {
      label: msg("OTHER FAQ PAGES"),
      items: [...others, { href: '/faq', label: msg("All questions") }],
    },
    { ...RESOURCES, items: RESOURCES.items.filter((i) => i.href !== activePath) },
    SITE_INFO,
  ]
}
