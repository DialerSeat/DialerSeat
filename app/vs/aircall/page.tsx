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

const SLUG = 'aircall'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Aircall Alternative: Power Dialer Pricing, Pros & Cons | DialerSeat',
  description:
    'Aircall\u2019s advertised $30/seat Essentials plan doesn\u2019t include the Power Dialer, Salesforce integration, or call monitoring: all three require the $50/seat Professional tier, plus a 3-license minimum. DialerSeat includes every dialer mode at $35/seat/week.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/aircall',
  },
  openGraph: {
    title: 'DialerSeat vs Aircall',
    description:
      'The power dialer, included at $35/week per seat, not a $50/month Professional-tier unlock with a 3-license minimum.',
    url: 'https://dialerseat.com/vs/aircall',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Aircall',
    description: 'The power dialer, included at $35/week per seat, not a $50/month Professional-tier unlock with a 3-license minimum.',
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
          { name: msg("DialerSeat vs Aircall"), url: '/vs/aircall' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
