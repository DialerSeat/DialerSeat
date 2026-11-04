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

const SLUG = 'readymode'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'ReadyMode Alternative: Pricing Without the $2K Setup Fee | DialerSeat',
  description:
    'DialerSeat is the modern alternative to ReadyMode. Multi-line predictive dialing, per-campaign mode, multiple scripts per campaign, server-side TCPA, at flat $35/week per seat. No $500-$2,000 setup fee, no annual contract, works on every device.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/readymode',
  },
  openGraph: {
    title: 'DialerSeat vs ReadyMode',
    description:
      'Same multi-line predictive at $35/week instead of $165-$249/month. No $2K setup fee. Modern UI built this year. Works on phones and tablets.',
    url: 'https://dialerseat.com/vs/readymode',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs ReadyMode',
    description: 'Same multi-line predictive at $35/week instead of $165-$249/month. No $2K setup fee. Modern UI built this year. Works on phones and tablets.',
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
          { name: msg("DialerSeat vs ReadyMode"), url: '/vs/readymode' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}