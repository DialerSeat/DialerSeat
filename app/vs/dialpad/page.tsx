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

const SLUG = 'dialpad'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Dialpad Power Dialer Alternative: Pricing, Pros & Cons | DialerSeat',
  description:
    'Dialpad Connect, the $15-$35/user/month phone system, has no power dialer at any tier: the dialer lives in a separate product, Dialpad Sell, starting around $39/user/month. DialerSeat includes every dialer mode at $35/seat/week, one product.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialpad',
  },
  openGraph: {
    title: 'DialerSeat vs Dialpad',
    description:
      'The dialer, included at $35/week per seat, not a separate $39+/month product you have to discover and buy on top.',
    url: 'https://dialerseat.com/vs/dialpad',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Dialpad',
    description: 'The dialer, included at $35/week per seat, not a separate $39+/month product you have to discover and buy on top.',
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
          { name: msg("DialerSeat vs Dialpad"), url: '/vs/dialpad' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
