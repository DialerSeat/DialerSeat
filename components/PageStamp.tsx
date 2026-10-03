'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { t } from '@/lib/i18n/client'

// =============================================================================
// PAGE STAMP — when the page changed, and who stands behind it
// =============================================================================
// Google's helpful-content guidance asks of every page "who created the
// content", and Bing's webmaster guidelines list transparent authorship under
// quality. The site names no person, by the owner's choice, so the answer is
// the company, linked to the part of /about a reader can actually check: how
// the research is done and how corrections are made.
//
// The date stays first and comes from lib/pageDates, the same source as the
// sitemap's <lastmod> and each page's dateModified. Google compares the dates
// a page shows with the dates its markup and sitemap give, so all three read
// from one place.
// =============================================================================

export default function PageStamp({ children }: { children: ReactNode }) {
  return (
    <div className="guts-stamp">
      {children} · {t('Published by DialerSeat')} ·{' '}
      <Link href="/about#method" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        {t('How we research')}
      </Link>
    </div>
  )
}
