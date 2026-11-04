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

const SLUG = 'phoneburner'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'PhoneBurner Alternative: Pricing, Pros & Cons | DialerSeat',
  description:
    'DialerSeat is the modern alternative to PhoneBurner. Multi-line predictive included (PhoneBurner is single-line only), everything in one tier (no Premium upgrades), flexible list sizes, weekly billing: flat $35/week per seat, no annual contract.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/phoneburner',
  },
  openGraph: {
    title: 'DialerSeat vs PhoneBurner',
    description:
      'Multi-line predictive (PhoneBurner is single-line only). Everything in one tier. Weekly billing, no annual contract. $35/week per seat.',
    url: 'https://dialerseat.com/vs/phoneburner',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs PhoneBurner',
    description: 'Multi-line predictive (PhoneBurner is single-line only). Everything in one tier. Weekly billing, no annual contract. $35/week per seat.',
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
          { name: msg("Comparisons"), url: '/vs/everyone' },
          { name: msg("DialerSeat vs PhoneBurner"), url: '/vs/phoneburner' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}