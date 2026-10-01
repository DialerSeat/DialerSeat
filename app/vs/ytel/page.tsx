import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import { prosConsKeywords, prosConsFaqs } from '@/lib/vsSeo'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

const SLUG = 'ytel'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Ytel Alternative: No Platform Fee on Top of Seats | DialerSeat',
  description: "Ytel prices seats around $99 per month on top of a platform fee, which small teams absorb disproportionately. DialerSeat is $35 per seat per week with no platform charge.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ytel',
  },
  openGraph: {
    title: 'DialerSeat vs Ytel',
    description: "Per-seat pricing plus a platform fee versus per-seat pricing.",
    url: 'https://dialerseat.com/vs/ytel',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Ytel',
    description: "Per-seat pricing plus a platform fee versus per-seat pricing.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does Ytel cost?"),
    answer:
      msg("A Contact Centre Seat is around $99 per month, with the Engagement Platform around $399 and Trust Center around $499. Seats are priced per agent on top of a platform fee, which means a small team pays a disproportionate share of fixed cost."),
  },
  {
    question: msg("Does Ytel offer APIs?"),
    answer:
      msg("Yes, and it is a real differentiator. Ytel provides communications APIs alongside the dialer, so if you are building your own tooling on top of voice and SMS it is a genuinely different proposition from a finished dialer."),
  },
  {
    question: msg("Who is DialerSeat better for?"),
    answer:
      msg("Teams under about twenty agents who want to dial rather than build. There is no platform fee, no minimum, and every dialer mode is included at $35 per seat per week."),
  },
]

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema([...FAQS, ...prosConsFaqs(SLUG)])} />
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
