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

const SLUG = 'ytel'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Ytel Alternative: A Published Price, $35 a Week | DialerSeat',
  description: "Ytel no longer publishes prices, so the number takes a demo. DialerSeat is $35 per seat per week, published on the homepage.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ytel',
  },
  openGraph: {
    title: 'DialerSeat vs Ytel',
    description: "A price you get after a demo, against $35 a week per seat, published.",
    url: 'https://dialerseat.com/vs/ytel',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Ytel',
    description: "A price you get after a demo, against $35 a week per seat, published.",
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
          { name: msg("DialerSeat vs Ytel"), url: '/vs/ytel' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
