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

const SLUG = 'cloudtalk'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'CloudTalk Alternative: Dialer Pricing Without the Add-Ons | DialerSeat',
  description:
    'CloudTalk\u2019s $34/seat headline doesn\u2019t include a dialer: Power Dialer is +$15/seat/month, Parallel Dialer is +$39/seat/month. DialerSeat includes every dialer mode at $35/seat/week, billed weekly, no add-on required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/cloudtalk',
  },
  openGraph: {
    title: 'DialerSeat vs CloudTalk',
    description:
      'Every dialer mode included at a flat $35/week per seat, not a $15 or $39 add-on stacked on top of a cheap phone-system seat.',
    url: 'https://dialerseat.com/vs/cloudtalk',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs CloudTalk',
    description: 'Every dialer mode included at a flat $35/week per seat, not a $15 or $39 add-on stacked on top of a cheap phone-system seat.',
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
          { name: msg("DialerSeat vs CloudTalk"), url: '/vs/cloudtalk' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
