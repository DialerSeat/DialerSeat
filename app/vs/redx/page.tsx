import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import { prosConsKeywords } from '@/lib/vsSeo'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// Figures from REDX's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'redx'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'REDX Dialer Alternative: Pros, Cons & Pricing | DialerSeat',
  description:
    "The pros and cons of REDX against DialerSeat. REDX sells real estate leads with a dialer attached: single-line on its $299 bundle, triple-line on $349. DialerSeat is $35 a week for a dialer with every mode, and you bring your own leads.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/redx',
  },
  openGraph: {
    title: 'DialerSeat vs REDX',
    description: "Leads with a dialer attached, against a dialer you bring your own leads to.",
    url: 'https://dialerseat.com/vs/redx',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs REDX',
    description: "Leads with a dialer attached, against a dialer you bring your own leads to.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Comparisons"), url: '/vs' },
          { name: msg("DialerSeat vs REDX"), url: '/vs/redx' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
