import type { RailGroup } from '@/components/GutsShell'
import { COMPETITORS } from '@/lib/competitors'

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
  label: 'SITE INFO',
  items: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Use' },
  ],
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
      label: 'MAIN MENU',
      items: [
        { href: '/?view=landing', label: 'Home' },
        { href: '/vs', label: 'All Comparisons' },
        { href: '/faq', label: 'FAQ' },
      ],
    },
    {
      label: 'OTHER VS PAGES',
      items: [
        ...others,
        { href: '/vs/everyone', label: 'Every legacy dialer' },
        { href: '/vs/teams', label: 'Dialer pricing for teams' },
        { href: '/vs', label: 'All dialer comparisons' },
      ],
    },
    SITE_INFO,
  ]
}

/** The questions worth putting one click away from any answer page. */
const RAIL_ANSWERS: { href: string; label: string }[] = [
  { href: '/faq/why-dialerseat', label: 'Why DialerSeat?' },
  { href: '/faq/why-we-charge', label: 'Why we charge what we charge' },
  { href: '/faq/billing', label: 'Billing & cancellation' },
  { href: '/faq/dialer-modes', label: 'Dialer modes (TL;DR)' },
  { href: '/faq/how-we-keep-compliance', label: 'How we keep compliance' },
  { href: '/faq/numbers', label: 'Phone numbers & caller ID' },
  { href: '/faq/leads', label: 'Uploading & managing leads' },
  { href: '/faq/manager-plus', label: 'What Manager+ adds' },
]

/**
 * The rail for a /faq article. `activePath` is the page's own route, dropped
 * from the list for the same reason as above.
 */
export function faqRail(activePath?: string): RailGroup[] {
  const others = RAIL_ANSWERS.filter((a) => a.href !== activePath).slice(0, 7)

  return [
    {
      label: 'MAIN MENU',
      items: [
        { href: '/?view=landing', label: 'Home' },
        { href: '/faq', label: 'All Questions' },
        { href: '/vs', label: 'Comparisons' },
      ],
    },
    {
      label: 'OTHER FAQ PAGES',
      items: [...others, { href: '/faq', label: 'All questions' }],
    },
    SITE_INFO,
  ]
}
