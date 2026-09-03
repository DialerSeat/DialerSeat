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

const SLUG = 'smrtphone'

export const metadata: Metadata = {
  title: "DialerSeat vs smrtPhone \u2014 Flat Weekly, Not Subscription Plus Credits",
  description: "smrtPhone stacks three charges: a $62\u2013$104/month subscription, a $42\u2013$75/seat/month dialer add-on, then per-minute credits. DialerSeat is $35 per seat per week with call time included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/smrtphone',
  },
  openGraph: {
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
    url: 'https://dialerseat.com/vs/smrtphone',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
  },
}

const FAQS = [
  {
    question: "How does smrtPhone pricing work?",
    answer:
      "Three charges stack. The smrtPhone subscription is $62/month Standard or $104/month Pro billed monthly. smrtDialer is an add-on on top at about $42 per seat per month single-line or $75 multi-line. Then call time is deducted from a pre-paid credit balance from around $0.02 per minute. A heavy dialing day costs more than a light one.",
  },
  {
    question: "Is smrtPhone better for real-estate investors?",
    answer:
      "If you run Podio or an REI CRM, quite possibly yes. smrtPhone is built for that world and the integration depth is real \u2014 it is a phone system wired into how investors already work, not a generic dialer with a connector bolted on. That is a genuine reason to choose it.",
  },
  {
    question: "Does smrtPhone have predictive dialing?",
    answer:
      "No. smrtDialer is single-line or multi-line power dialing up to four lines, which is a different thing \u2014 there is no pacing engine adjusting to your team's answer rate. DialerSeat includes predictive alongside power, progressive and preview.",
  },
  {
    question: "What does DialerSeat charge for call time?",
    answer:
      "Nothing extra. $35 per seat per week covers the dialing; there is no per-minute credit balance to top up and no bill that grows on a good day.",
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
          { name: 'DialerSeat vs smrtPhone', url: '/vs/smrtphone' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
