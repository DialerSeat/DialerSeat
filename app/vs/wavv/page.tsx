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

const SLUG = 'wavv'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'WAVV Alternative: Every Dialer Mode, One Flat Price | DialerSeat',
  description:
    'DialerSeat is $35 a week per seat: preview, power, and multi-line predictive dialing all included, no tier to unlock. WAVV starts at $99/month and requires its $149/month Multi Line plan for predictive dialing, plus $1/month per phone number.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/wavv',
  },
  openGraph: {
    title: 'DialerSeat vs WAVV',
    description:
      'WAVV charges more the harder you dial, $99 to $149/month depending on the mode. DialerSeat is $35 a week, flat, every mode included. Weekly billing, cancel any time.',
    url: 'https://dialerseat.com/vs/wavv',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs WAVV',
    description: 'WAVV charges more the harder you dial, $99 to $149/month depending on the mode. DialerSeat is $35 a week, flat, every mode included. Weekly billing, cancel any time.',
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
          { name: msg("DialerSeat vs WAVV"), url: '/vs/wavv' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
