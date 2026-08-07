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

const SLUG = 'dialedin'

export const metadata: Metadata = {
  title: "DialerSeat vs DialedIn (ChaseData) \u2014 Every Mode at One Price",
  description: "DialedIn, formerly ChaseData, starts around $89 per user per month with outbound features arriving further up the tiers. DialerSeat includes predictive, power, progressive and preview at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialedin',
  },
  openGraph: {
    title: 'DialerSeat vs DialedIn',
    description: "A published starting price is a good start. What matters is which tier the dialing actually lives in.",
    url: 'https://dialerseat.com/vs/dialedin',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs DialedIn',
    description: "A published starting price is a good start. What matters is which tier the dialing actually lives in.",
  },
}

const FAQS = [
  {
    question: "What does DialedIn cost?",
    answer:
      "The published starting price is around $89 per user per month. DialedIn is the product formerly sold as ChaseData. As with most tiered contact-centre products, the entry tier is not where the heavier outbound features live, so the relevant number depends on which plan covers what you actually need.",
  },
  {
    question: "Does DialedIn handle inbound as well?",
    answer:
      "Yes, and that is a genuine advantage over DialerSeat. DialedIn covers inbound and outbound in one platform. DialerSeat is outbound only \u2014 if you run a blended floor, that difference matters more than price.",
  },
  {
    question: "Which one includes predictive dialing?",
    answer:
      "Both offer predictive dialing. The difference is packaging: DialerSeat includes predictive, power, progressive and preview at the base price with no tier to climb, selectable per campaign.",
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
          { name: 'DialerSeat vs DialedIn', url: '/vs/dialedin' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
