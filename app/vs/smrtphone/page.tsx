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

const SLUG = 'smrtphone'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'smrtPhone Alternative: Flat Weekly Pricing, No Credits | DialerSeat',
  description: "smrtPhone stacks three charges: a $62-$104/month subscription, a $42-$75/seat/month dialer add-on, then per-minute credits. DialerSeat is $35 per seat per week with call time included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/smrtphone',
  },
  openGraph: {
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
    url: 'https://dialerseat.com/vs/smrtphone',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
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
          { name: msg("DialerSeat vs smrtPhone"), url: '/vs/smrtphone' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
