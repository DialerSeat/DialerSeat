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

const SLUG = 'batchdialer'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'BatchDialer Alternative: Pricing Without the Annual Prepay | DialerSeat',
  description:
    "BatchDialer's advertised $95/seat is the annual prepay rate; month to month it is $119-$249. DialerSeat is $35/week billed weekly with all four dialer modes, automatic number cycling on every plan, multiple scripts per campaign, and whitelabel at $75/week flat.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/batchdialer',
  },
  openGraph: {
    title: 'DialerSeat vs BatchDialer',
    description:
      'Automatic number replacement on every plan, not gated behind Pro. No per-number fees. No annual prepay to reach the real price. $35/week per seat.',
    url: 'https://dialerseat.com/vs/batchdialer',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs BatchDialer',
    description: 'Automatic number replacement on every plan, not gated behind Pro. No per-number fees. No annual prepay to reach the real price. $35/week per seat.',
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
          { name: msg("DialerSeat vs BatchDialer"), url: '/vs/batchdialer' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
