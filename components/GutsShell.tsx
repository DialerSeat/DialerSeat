'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Classic, { GutsSection as ClassicSection, GUTS_FONT } from '@/components/GutsShellClassic'
import SecondLook, { GutsSection as SecondLookSection } from '@/components/GutsShellV2'
import type { GutsIcon, RailGroup, RailLink } from '@/components/GutsShellClassic'

// =============================================================================
// THE ARTICLE SHELL — one import, two looks, chosen by where the page lives
// =============================================================================
// The owner approved a second look for the article pages on 12 Nov 2026
// (components/GutsShellV2) and asked for it on /faq, /vs and /tools. Pricing,
// features, the legal pages and the data pages stay on the original
// (components/GutsShellClassic) until he says otherwise.
//
// WHY THE ADDRESS DECIDES AND NOT THE IMPORT. The obvious way to do this is to
// point a hundred article pages at a different file. But lib/pageDates.ts takes
// each page's "Updated" date, and its sitemap lastmod, from the last commit
// that touched the page's file. A one-line import change on a hundred pages
// would stamp every article as changed on the same day, which is exactly the
// always-"now" lastmod that scripts/gen-page-dates.mjs exists to prevent.
// Choosing here means no page file changes at all.
//
// /dialing-modes is included because its four explainers are the canonical
// copies of /faq/what-is-a-*-dialer and share their stylesheet.
//
// The pattern allows a language prefix (/es/faq/..., /pt-br/vs/...) so the
// server and the browser agree whichever form of the address each one sees.
// =============================================================================

export type { GutsIcon, RailGroup, RailLink }
export { GUTS_FONT }

export interface GutsShellProps {
  rail: RailGroup[]
  /** The rail entry for the page you are on. Marked, never linked away from. */
  activeHref?: string
  /** Second look only: the closing sign-up band. On unless a page turns it off. */
  cta?: boolean
  children: ReactNode
}

const ARTICLE = /^(?:\/[a-z]{2,3}(?:-[a-z]{2})?)?\/(?:faq|vs|tools|dialing-modes)(?:\/|$)/i

function useSecondLook(): boolean {
  return ARTICLE.test(usePathname() || '')
}

export function GutsSection(props: {
  icon?: GutsIcon
  title?: string
  id?: string
  children: ReactNode
}) {
  return useSecondLook() ? <SecondLookSection {...props} /> : <ClassicSection {...props} />
}

export default function GutsShell({ cta, ...props }: GutsShellProps) {
  return useSecondLook() ? <SecondLook cta={cta} {...props} /> : <Classic {...props} />
}
