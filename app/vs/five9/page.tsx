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

const SLUG = 'five9'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Five9 Alternative: Predictive Dialer Without the Enterprise Contract | DialerSeat',
  description:
    'DialerSeat is the modern alternative to Five9. Self-serve signup in minutes (not weeks of demos), public $35/week pricing (no custom quotes), no annual contract, no implementation fees. Multi-line predictive dialing with the same compliance posture.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/five9',
  },
  openGraph: {
    title: 'DialerSeat vs Five9',
    description:
      'Skip the demo cycle, the annual contract, and the $175+/seat pricing. Same compliance posture, public $35/week pricing, self-serve signup.',
    url: 'https://dialerseat.com/vs/five9',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Five9',
    description: 'Skip the demo cycle, the annual contract, and the $175+/seat pricing. Same compliance posture, public $35/week pricing, self-serve signup.',
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
          { name: msg("DialerSeat vs Five9"), url: '/vs/five9' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}