'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useLocale } from '@/lib/i18n/client'
import { localeHref } from '@/lib/i18n/locales'

// =============================================================================
// LOCALE LINK — next/link that keeps the reader in their language
// =============================================================================
// Pages under /es/, /fr/ … linked to the English addresses (/pricing, not
// /es/pricing). Visitors never noticed, because the language cookie serves
// Spanish at either address, but crawlers carry no cookie: to them every
// link on a Spanish page led back to English, and no internal link pointed at
// a language page at all. hreflang tells a search engine which page is which
// language; it passes no link weight, so those pages were orphans.
//
// In English, and for any address with no language version (sign-up, the
// dashboard, /status), the href passes through untouched, so English pages
// render exactly as before. The language menus do not use this: their links
// point at other languages on purpose.
// =============================================================================

export default function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { locale } = useLocale()
  return <Link href={typeof href === 'string' ? localeHref(href, locale) : href} {...props} />
}
