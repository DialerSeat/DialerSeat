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

// Figures from Nextiva's own pricing page, read 25 Sept 2026: Core $23/$15,
// Engage $50/$25, Scale $75 annual, contact center Essential from $75 an agent,
// and "Progressive, Predictive" listed in the Professional tier, which is
// Contact Sales. Held back from the first batch because the DIALING price was
// unknown; the answer is that the published prices are not dialing prices.
const SLUG = 'nextiva'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Nextiva Dialer Alternative: Pros, Cons & Pricing | DialerSeat',
  description:
    'The pros and cons of Nextiva against DialerSeat. Nextiva publishes $15 to $75 a user a month, but none of those plans dial; progressive and predictive sit in a contact center tier quoted by sales. DialerSeat is $35 a week with every mode included.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/nextiva',
  },
  openGraph: {
    title: 'DialerSeat vs Nextiva',
    description: 'A phone system whose published plans do not dial, against a dialer billed a week at a time.',
    url: 'https://dialerseat.com/vs/nextiva',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Nextiva',
    description: 'A phone system whose published plans do not dial, against a dialer billed a week at a time.',
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
          { name: msg("DialerSeat vs Nextiva"), url: '/vs/nextiva' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
