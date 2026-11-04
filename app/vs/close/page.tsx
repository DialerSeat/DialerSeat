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

// Figures from Close's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'close'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Close Dialer Alternative: Pros, Cons & What the Dialer Costs | DialerSeat',
  description:
    "The pros and cons of Close against DialerSeat. Close is a CRM with a power dialer from $109 per user and predictive on Scale at $149, with calling billed on top. DialerSeat is $35 a week with every mode and calling included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/close',
  },
  openGraph: {
    title: 'DialerSeat vs Close',
    description: "A CRM with the dialer on its upper plans, against a dialer with every mode included.",
    url: 'https://dialerseat.com/vs/close',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Close',
    description: "A CRM with the dialer on its upper plans, against a dialer with every mode included.",
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
          { name: msg("DialerSeat vs Close"), url: '/vs/close' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
