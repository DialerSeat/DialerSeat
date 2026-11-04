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

const SLUG = '3cx'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: '3CX Alternative for Outbound Dialing: Pros, Cons & Pricing | DialerSeat',
  description:
    'DialerSeat and 3CX solve different problems. 3CX is a business PBX licensed by simultaneous call capacity; DialerSeat is a purpose-built outbound sales dialer at $35/seat/week: lead lists, dispositions, AMD, and TCPA compliance included, no capacity planning required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/3cx',
  },
  openGraph: {
    title: 'DialerSeat vs 3CX',
    description:
      '3CX runs your phones. DialerSeat runs your outbound sales. $35 a week per seat, everything included, no capacity planning or SIP trunk shopping required.',
    url: 'https://dialerseat.com/vs/3cx',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs 3CX',
    description: '3CX runs your phones. DialerSeat runs your outbound sales. $35 a week per seat, everything included, no capacity planning or SIP trunk shopping required.',
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
          { name: msg("DialerSeat vs 3CX"), url: '/vs/3cx' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
