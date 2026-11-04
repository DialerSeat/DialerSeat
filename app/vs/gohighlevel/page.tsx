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

// Figures from GoHighLevel's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'gohighlevel'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'GoHighLevel Dialer Alternative: Pros, Cons & Pricing | DialerSeat',
  description:
    "The pros and cons of GoHighLevel’s dialer against DialerSeat. HighLevel plans run $97 to $497 a month with calling billed per minute from a wallet. DialerSeat is a dedicated dialer at $35 a week with every mode and calling included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/gohighlevel',
  },
  openGraph: {
    title: 'DialerSeat vs GoHighLevel',
    description: "A power dialer inside an agency platform, against a dialer that is the whole product.",
    url: 'https://dialerseat.com/vs/gohighlevel',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs GoHighLevel',
    description: "A power dialer inside an agency platform, against a dialer that is the whole product.",
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
          { name: msg("DialerSeat vs GoHighLevel"), url: '/vs/gohighlevel' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
