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

const SLUG = 'mojo'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Mojo Dialer Alternative: Pricing, Cost, Pros & Cons | DialerSeat',
  description:
    'DialerSeat is the modern alternative to Mojo Dialer. Triple-line speed plus real multi-line predictive, multiple scripts per campaign, and a lead webhook for any CRM, at a flat $35/week per seat. No $10/mo Agent Access fee, no $25-$49 data add-ons, every industry welcome.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/mojo',
  },
  openGraph: {
    title: 'DialerSeat vs Mojo Dialer',
    description:
      'Same triple-line speed across every industry, not just real estate. No $10/mo Agent Access fee. No $25-$49 data add-ons stacking. $35/week per seat.',
    url: 'https://dialerseat.com/vs/mojo',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Mojo Dialer',
    description: 'Same triple-line speed across every industry, not just real estate. No $10/mo Agent Access fee. No $25-$49 data add-ons stacking. $35/week per seat.',
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
          { name: msg("DialerSeat vs Mojo Dialer"), url: '/vs/mojo' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}