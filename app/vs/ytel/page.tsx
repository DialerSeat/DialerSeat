import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

const SLUG = 'ytel'

export const metadata: Metadata = {
  title: "DialerSeat vs Ytel \u2014 No Platform Fee on Top of Seats",
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

const FAQS = [
  {
    question: "What does Ytel cost?",
    answer:
      "A Contact Centre Seat is around $99 per month, with the Engagement Platform around $399 and Trust Center around $499. Seats are priced per agent on top of a platform fee, which means a small team pays a disproportionate share of fixed cost.",
  },
  {
    question: "Does Ytel offer APIs?",
    answer:
      "Yes, and it is a real differentiator. Ytel provides communications APIs alongside the dialer, so if you are building your own tooling on top of voice and SMS it is a genuinely different proposition from a finished dialer.",
  },
  {
    question: "Who is DialerSeat better for?",
    answer:
      "Teams under about twenty agents who want to dial rather than build. There is no platform fee, no minimum, and every dialer mode is included at $35 per seat per week.",
  },
]

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs Ytel', url: '/vs/ytel' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
