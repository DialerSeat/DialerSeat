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

const SLUG = 'vicidial'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'VICIdial Alternative: Hosted Predictive Dialer, No Server | DialerSeat',
  description: "VICIdial is free and open source, and published total cost of ownership still lands at $130-$400+ per agent per month once servers, SIP trunking and an administrator are counted. DialerSeat is $35 per seat per week with nothing to run.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/vicidial',
  },
  openGraph: {
    title: 'DialerSeat vs VICIdial',
    description: "The software is free. The server, the trunking and the administrator are not. A costed comparison.",
    url: 'https://dialerseat.com/vs/vicidial',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs VICIdial',
    description: "The software is free. The server, the trunking and the administrator are not. A costed comparison.",
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
          { name: msg("DialerSeat vs VICIdial"), url: '/vs/vicidial' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
