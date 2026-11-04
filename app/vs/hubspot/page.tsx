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

// Figures from HubSpot's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'hubspot'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'HubSpot Calling Alternative: Pros, Cons & Pricing | DialerSeat',
  description:
    "The pros and cons of calling from HubSpot against a dedicated dialer. Sales Hub calling minutes are capped by plan, the power dialer is in beta, and Professional adds a $1,500 onboarding fee. DialerSeat is $35 a week with every mode included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/hubspot',
  },
  openGraph: {
    title: 'DialerSeat vs HubSpot',
    description: "Calling inside your CRM, against a dialer built for a full day on the phones.",
    url: 'https://dialerseat.com/vs/hubspot',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs HubSpot',
    description: "Calling inside your CRM, against a dialer built for a full day on the phones.",
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
          { name: msg("DialerSeat vs HubSpot"), url: '/vs/hubspot' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
