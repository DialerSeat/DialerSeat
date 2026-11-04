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

// Figures from Ringover's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'ringover'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "Ringover Alternative: No 12-Month Commitment | DialerSeat",
  description:
    "The pros and cons of Ringover against DialerSeat. Ringover’s power dialer is on its Business plan, with a three-user minimum and a twelve-month commitment. DialerSeat is $35 a week per seat, one seat minimum, cancel any week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ringover',
  },
  openGraph: {
    title: 'DialerSeat vs Ringover',
    description: "A phone system with a year-long commitment, against a dialer billed a week at a time.",
    url: 'https://dialerseat.com/vs/ringover',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Ringover',
    description: "A phone system with a year-long commitment, against a dialer billed a week at a time.",
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
          { name: msg("DialerSeat vs Ringover"), url: '/vs/ringover' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
