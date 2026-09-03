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

const SLUG = 'vicidial'

export const metadata: Metadata = {
  title: "DialerSeat vs VICIdial \u2014 Free Software Is Not a Free Dialer",
  description: "VICIdial is free and open source, and published total cost of ownership still lands at $130\u2013$400+ per agent per month once servers, SIP trunking and an administrator are counted. DialerSeat is $35 per seat per week with nothing to run.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/vicidial',
  },
  openGraph: {
    title: 'DialerSeat vs VICIdial',
    description: "The software is free. The server, the trunking and the administrator are not. A costed comparison.",
    url: 'https://dialerseat.com/vs/vicidial',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs VICIdial',
    description: "The software is free. The server, the trunking and the administrator are not. A costed comparison.",
  },
}

const FAQS = [
  {
    question: "Is VICIdial really free?",
    answer:
      "The software genuinely is \u2014 it is open source under the AGPL with no per-seat licence, and that is not a trick. What is not free is everything required to run it: a server, SIP trunking, and someone who knows Asterisk. Published total-cost-of-ownership analyses put realistic VICIdial cost at $130\u2013$400+ per agent per month, rising toward $195\u2013$728 once administration labour is counted. Industry salary data puts a dedicated VICIdial administrator near $97,000 a year.",
  },
  {
    question: "At what size does VICIdial become the cheaper option?",
    answer:
      "Roughly 30 agents is the commonly cited floor, and the economics get genuinely compelling past 100. Below about 30 agents the fixed overhead \u2014 the server, the trunk minimums, and above all the person maintaining it \u2014 is spread over too few seats to beat a per-seat hosted product. Above 100 agents almost nothing beats it on cost.",
  },
  {
    question: "What does DialerSeat do that VICIdial does not?",
    answer:
      "Nothing you could not build in VICIdial given enough configuration time \u2014 that is the honest answer, and it is why VICIdial has the install base it has. The difference is what arrives already done: per-lead TCPA calling windows enforced server-side, a 3% abandon-rate cap, STIR/SHAKEN attestation, number rotation with answer-rate monitoring, and someone else on call when it breaks at 9am.",
  },
  {
    question: "Can I move from VICIdial to DialerSeat?",
    answer:
      "Lead lists export from VICIdial as CSV and import directly. What does not transfer is your configuration \u2014 campaigns, dispositions and pacing are set up again, which for most floors is an afternoon rather than a project. Recordings stay where they are; we do not import call history.",
  },
  {
    question: "Is DialerSeat open source?",
    answer:
      "No. If not being able to read and modify the source is a dealbreaker, VICIdial is the answer and no comparison page should pretend otherwise. That is a real requirement for some operations and we do not meet it.",
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
          { name: 'DialerSeat vs VICIdial', url: '/vs/vicidial' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
