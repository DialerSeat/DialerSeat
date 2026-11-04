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

const SLUG = 'convoso'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Convoso Alternative: Same Dialer Modes, No Seat Minimum | DialerSeat',
  description:
    'Convoso is a strong predictive dialer built for 20+ seat operations with custom, usage-billed quotes. DialerSeat matches predictive, power, progressive, and preview dialing at $35/seat/week, billed weekly, no seat minimum, no demo required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/convoso',
  },
  openGraph: {
    title: 'DialerSeat vs Convoso',
    description:
      'The same four dialer modes at a published $35/week per seat: no 20-seat minimum, no custom quote, no carrier fees billed separately.',
    url: 'https://dialerseat.com/vs/convoso',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Convoso',
    description: 'The same four dialer modes at a published $35/week per seat: no 20-seat minimum, no custom quote, no carrier fees billed separately.',
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
          { name: msg("DialerSeat vs Convoso"), url: '/vs/convoso' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
