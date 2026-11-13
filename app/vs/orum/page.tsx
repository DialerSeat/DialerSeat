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

const SLUG = 'orum'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Orum Alternative: $35 a Week vs $250+ a Month, Nine-Seat Minimum | DialerSeat',
  description:
    'DialerSeat is the transparent, self-serve alternative to Orum. Orum publishes no price, states a nine-seat minimum and is reported at around $250/user/month. DialerSeat is $35 per seat per week, cancel anytime, one seat minimum, sign up in minutes.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/orum',
  },
  openGraph: {
    title: 'DialerSeat vs Orum',
    description:
      'No demo required, no contract, no nine-seat minimum. $35/week per seat vs Orum\'s widely-reported $250+/user/month starting price.',
    url: 'https://dialerseat.com/vs/orum',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Orum',
    description: 'No demo required, no contract, no nine-seat minimum. $35/week per seat vs Orum\'s widely-reported $250+/user/month starting price.',
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
          { name: msg("DialerSeat vs Orum"), url: '/vs/orum' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
