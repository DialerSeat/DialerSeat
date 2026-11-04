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

// The slug drops the dot. A literal /vs/dialer.io puts what looks like a file
// extension at the end of a route segment, which is the one shape static
// hosts, crawlers and redirect rules all treat as an asset rather than a page.
// The brand keeps its dot everywhere it is READ — title, headline, rail — and
// loses it only in the URL.
const SLUG = 'dialer-io'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Dialer.io Alternative: Published Pricing, No 3-Month Commitment | DialerSeat',
  description:
    "Dialer.io quotes case by case and asks for an initial three-month commitment. DialerSeat publishes $35 per seat per week, bills weekly, and includes predictive and multi-line dialing that Dialer.io does not claim.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialer-io',
  },
  openGraph: {
    title: 'DialerSeat vs Dialer.io',
    description:
      'A quoted three-month commitment against a published weekly price, and four dialer modes against three.',
    url: 'https://dialerseat.com/vs/dialer-io',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Dialer.io',
    description:
      'A quoted three-month commitment against a published weekly price, and four dialer modes against three.',
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
          { name: msg("DialerSeat vs Dialer.io"), url: '/vs/dialer-io' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
