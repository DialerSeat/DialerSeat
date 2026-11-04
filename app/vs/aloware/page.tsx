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

const SLUG = 'aloware'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Aloware Alternative: Pricing, Pros & Cons | DialerSeat',
  description: "Aloware starts around $30 per user per month, with dialing capability tiered above it and ad-hoc charges outside the seat price. DialerSeat includes every dialer mode at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/aloware',
  },
  openGraph: {
    title: 'DialerSeat vs Aloware',
    description: "A low entry price is real. So is which tier the outbound features sit in.",
    url: 'https://dialerseat.com/vs/aloware',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Aloware',
    description: "A low entry price is real. So is which tier the outbound features sit in.",
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
          { name: msg("DialerSeat vs Aloware"), url: '/vs/aloware' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
