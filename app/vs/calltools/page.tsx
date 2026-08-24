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

const SLUG = 'calltools'

export const metadata: Metadata = {
  title: "DialerSeat vs CallTools \u2014 No Setup Fee, No Sales Call",
  description: "CallTools runs about $119.99 per user per month with setup fees commonly $500\u2013$1,500 and integration quoted separately. DialerSeat is free for 7 days, then $35 per seat per week, self-serve, every dialer mode included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/calltools',
  },
  openGraph: {
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
    url: 'https://dialerseat.com/vs/calltools',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
  },
}

const FAQS = [
  {
    question: "How much does CallTools cost?",
    answer:
      "Roughly $119.99 per user per month month-to-month, or about $101.99 on an annual commitment. Those are starting figures \u2014 CallTools prices by quote, and reported setup fees run $500\u2013$1,500 before the first call, with complex CRM integrations quoted separately at $2,000\u2013$5,000. SMS is billed per message on top.",
  },
  {
    question: "Does DialerSeat charge a setup fee?",
    answer:
      "No. $35 per seat per week is the whole bill for the software, charged weekly, cancellable any week. There is no onboarding fee, no implementation project and no minimum term.",
  },
  {
    question: "Is CallTools better for large contact centres?",
    answer:
      "It is a mature contact-centre platform with reporting depth built for supervisors managing large floors, and if that is what you need it is a reasonable choice. DialerSeat is built for teams that want the dialing without the platform around it.",
  },
  {
    question: "Can I try either without talking to sales?",
    answer:
      "DialerSeat, yes \u2014 sign up and dial. CallTools is quote-based, so the real number requires a sales conversation.",
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
          { name: 'DialerSeat vs CallTools', url: '/vs/calltools' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
