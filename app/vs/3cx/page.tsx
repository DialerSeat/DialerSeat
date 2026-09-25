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

const SLUG = '3cx'

export const metadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialerSeat vs 3CX: Sales Dialer vs Business Phone System',
  description:
    'DialerSeat and 3CX solve different problems. 3CX is a business PBX licensed by simultaneous call capacity; DialerSeat is a purpose-built outbound sales dialer at $35/seat/week: lead lists, dispositions, AMD, and TCPA compliance included, no capacity planning required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/3cx',
  },
  openGraph: {
    title: 'DialerSeat vs 3CX',
    description:
      '3CX runs your phones. DialerSeat runs your outbound sales. $35 a week per seat, everything included, no capacity planning or SIP trunk shopping required.',
    url: 'https://dialerseat.com/vs/3cx',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs 3CX',
    description: '3CX runs your phones. DialerSeat runs your outbound sales. $35 a week per seat, everything included, no capacity planning or SIP trunk shopping required.',
  },
}

const FAQS = [
  {
    question: msg("Is DialerSeat a replacement for 3CX?"),
    answer:
      msg("Not necessarily. 3CX is a general business PBX, extensions, ring groups, video conferencing, licensed by simultaneous call capacity. DialerSeat is purpose-built for outbound sales campaigns: lead lists, dispositions, a predictive dialer, and TCPA compliance. Many teams run 3CX for company-wide phone infrastructure and DialerSeat specifically for the sales floor’s outbound dialing."),
  },
  {
    question: msg("How is DialerSeat priced compared to 3CX?"),
    answer:
      msg("DialerSeat is $35 per seat per week, billed weekly, with carrier lines, hosting, and support included. 3CX licenses per system per year based on simultaneous call (SC) capacity rather than per seat, and typically requires separate SIP trunk, hosting, and support costs on top of the license itself."),
  },
  {
    question: msg("Does 3CX have a predictive dialer for sales campaigns?"),
    answer:
      msg("3CX is built around general business call routing, queues, ring groups, IVR, not a dialer purpose-built for cold outbound sales campaigns. It has no lead list management, no disposition tracking, and no answering-machine detection. DialerSeat includes preview, power, progressive, and multi-line predictive dialing modes built specifically for outbound sales."),
  },
  {
    question: msg("Does DialerSeat require capacity planning like 3CX’s simultaneous call licensing?"),
    answer:
      msg("No. DialerSeat is priced per seat, not per simultaneous call capacity, so there’s no need to estimate concurrent call volume ahead of time or size a license tier. Sign up, add seats as needed, and start dialing."),
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
          { name: msg("DialerSeat vs 3CX"), url: '/vs/3cx' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
