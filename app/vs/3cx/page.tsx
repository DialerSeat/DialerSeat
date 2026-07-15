import type { Metadata } from 'next'
import Vs3cxView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs 3CX — Sales Dialer vs Business Phone System',
  description:
    'DialerSeat and 3CX solve different problems. 3CX is a business PBX licensed by simultaneous call capacity; DialerSeat is a purpose-built outbound sales dialer at $35/seat/week — lead lists, dispositions, AMD, and TCPA compliance included, no capacity planning required.',
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
}

const FAQS = [
  {
    question: 'Is DialerSeat a replacement for 3CX?',
    answer:
      'Not necessarily. 3CX is a general business PBX \u2014 extensions, ring groups, video conferencing \u2014 licensed by simultaneous call capacity. DialerSeat is purpose-built for outbound sales campaigns: lead lists, dispositions, a predictive dialer, and TCPA compliance. Many teams run 3CX for company-wide phone infrastructure and DialerSeat specifically for the sales floor\u2019s outbound dialing.',
  },
  {
    question: 'How is DialerSeat priced compared to 3CX?',
    answer:
      'DialerSeat is $35 per seat per week, billed weekly, with carrier lines, hosting, and support included. 3CX licenses per system per year based on simultaneous call (SC) capacity rather than per seat, and typically requires separate SIP trunk, hosting, and support costs on top of the license itself.',
  },
  {
    question: 'Does 3CX have a predictive dialer for sales campaigns?',
    answer:
      '3CX is built around general business call routing \u2014 queues, ring groups, IVR \u2014 not a dialer purpose-built for cold outbound sales campaigns. It has no lead list management, no disposition tracking, and no answering-machine detection. DialerSeat includes preview, power, progressive, and multi-line predictive dialing modes built specifically for outbound sales.',
  },
  {
    question: 'Does DialerSeat require capacity planning like 3CX\u2019s simultaneous call licensing?',
    answer:
      'No. DialerSeat is priced per seat, not per simultaneous call capacity, so there\u2019s no need to estimate concurrent call volume ahead of time or size a license tier. Sign up, add seats as needed, and start dialing.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs 3CX', url: '/vs/3cx' },
        ])}
      />
      <Vs3cxView />
    </>
  )
}
