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

const SLUG = 'kixie'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Kixie Alternative: Every Dialer Mode at One Price | DialerSeat',
  description:
    'Kixie PowerCall is well-reviewed but tiers dialing power by price, multi-line dialing runs $95+/seat/month. DialerSeat includes predictive, power, progressive, and preview dialing at $35/seat/week, billed weekly, no tier to climb.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/kixie',
  },
  openGraph: {
    title: 'DialerSeat vs Kixie',
    description:
      'Predictive, power, progressive, and preview dialing at one flat $35/week per seat, not gated behind a $95+/month multi-line tier.',
    url: 'https://dialerseat.com/vs/kixie',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Kixie',
    description: 'Predictive, power, progressive, and preview dialing at one flat $35/week per seat, not gated behind a $95+/month multi-line tier.',
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
          { name: msg("DialerSeat vs Kixie"), url: '/vs/kixie' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
