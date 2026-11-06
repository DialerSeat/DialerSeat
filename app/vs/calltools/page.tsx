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

const SLUG = 'calltools'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'CallTools Alternative: Pricing With No Setup Fee | DialerSeat',
  description: "CallTools doesn't publish a price: you get it from a specialist, and setup fees have been reported at $500-$1,500. DialerSeat is $35 per seat per week, self-serve, every dialer mode included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/calltools',
  },
  openGraph: {
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
    url: 'https://dialerseat.com/vs/calltools',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
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
          { name: msg("DialerSeat vs CallTools"), url: '/vs/calltools' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
