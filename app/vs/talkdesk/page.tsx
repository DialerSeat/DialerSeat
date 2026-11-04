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

// Seat prices from Talkdesk's own pricing page, read 25 Sept 2026. The dialer
// sits in the Proactive Outbound Engagement add-on, which Talkdesk names on its
// own product page and does not price. This page was held back from the first
// batch for exactly that reason; it ships now saying the dialer price is not
// published, which is the finding rather than a gap.
const SLUG = 'talkdesk'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Talkdesk Alternative: Dialer Pricing, Pros & Cons | DialerSeat',
  description:
    'The pros and cons of Talkdesk against DialerSeat. Talkdesk publishes seats at $85 to $225 a user a month, but the outbound dialer is an add-on it does not price. DialerSeat is $35 a week per seat with every dialing mode included.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/talkdesk',
  },
  openGraph: {
    title: 'DialerSeat vs Talkdesk',
    description: 'An enterprise contact center that prices the seat but not the dialer, against a dialer billed a week at a time.',
    url: 'https://dialerseat.com/vs/talkdesk',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Talkdesk',
    description: 'An enterprise contact center that prices the seat but not the dialer, against a dialer billed a week at a time.',
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
          { name: msg("DialerSeat vs Talkdesk"), url: '/vs/talkdesk' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
