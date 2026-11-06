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

const SLUG = 'justcall'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'JustCall Alternative: Dialer Pricing Without the Pro-Tier Upsell | DialerSeat',
  description:
    'JustCall advertises $29/user/month, but the power dialer sits behind the Pro tier ($69/month, or $49 billed annually) and predictive behind SalesPro, by quote, with a 2-seat minimum. DialerSeat includes every dialer mode at $35/seat/week, billed weekly, one seat minimum.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/justcall',
  },
  openGraph: {
    title: 'DialerSeat vs JustCall',
    description:
      'Predictive and power dialing included at $35/week per seat, not gated behind a Pro-tier upgrade or a 2-seat minimum.',
    url: 'https://dialerseat.com/vs/justcall',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs JustCall',
    description: 'Predictive and power dialing included at $35/week per seat, not gated behind a Pro-tier upgrade or a 2-seat minimum.',
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
          { name: msg("DialerSeat vs JustCall"), url: '/vs/justcall' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
