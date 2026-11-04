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

const SLUG = 'ringcentral'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'RingCentral Dialer Alternative: Pros, Cons & Pricing | DialerSeat',
  description: "RingCentral is an excellent business phone system, but outbound dialing lives in RingCX, its contact-centre product, from around $65 per user per month. DialerSeat is a dialer at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ringcentral',
  },
  openGraph: {
    title: 'DialerSeat vs RingCentral',
    description: "RingCentral plans start at $20. The dialer is not in them, it is in a different product line.",
    url: 'https://dialerseat.com/vs/ringcentral',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs RingCentral',
    description: "RingCentral plans start at $20. The dialer is not in them, it is in a different product line.",
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
          { name: msg("DialerSeat vs RingCentral"), url: '/vs/ringcentral' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
