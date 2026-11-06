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

const SLUG = 'dialedin'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialedIn (ChaseData) Alternative: Pricing, Pros & Cons | DialerSeat',
  description: "DialedIn, formerly ChaseData, is reported to start around $89 per user per month with outbound features arriving further up the tiers. DialerSeat includes predictive, power, progressive and preview at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialedin',
  },
  openGraph: {
    title: 'DialerSeat vs DialedIn',
    description: "A published starting price is a good start. What matters is which tier the dialing actually lives in.",
    url: 'https://dialerseat.com/vs/dialedin',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs DialedIn',
    description: "A published starting price is a good start. What matters is which tier the dialing actually lives in.",
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
          { name: msg("DialerSeat vs DialedIn"), url: '/vs/dialedin' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
