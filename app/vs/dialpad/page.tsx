import type { Metadata } from 'next'
import VsDialpadView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Dialpad — The Power Dialer Is a Separate Product',
  description:
    'Dialpad Connect, the $15\u2013$35/user/month phone system, has no power dialer at any tier \u2014 the dialer lives in a separate product, Dialpad Sell, starting around $39/user/month. DialerSeat includes every dialer mode at $35/seat/week, one product.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialpad',
  },
  openGraph: {
    title: 'DialerSeat vs Dialpad',
    description:
      'The dialer, included at $35/week per seat \u2014 not a separate $39+/month product you have to discover and buy on top.',
    url: 'https://dialerseat.com/vs/dialpad',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'Does Dialpad include a power dialer?',
    answer:
      "Not in Dialpad Connect, the core phone system most people mean when they say \"Dialpad\" ($15/user/month Standard, $25 Pro, $35 Enterprise). Multiple independent pricing breakdowns confirm the power dialer is exclusive to a separate product line, Dialpad Sell, starting around $39/user/month. DialerSeat includes predictive, power, progressive, and preview dialing in the one $35/week price \u2014 no second product required.",
  },
  {
    question: 'How does DialerSeat compare to Dialpad on price?',
    answer:
      "DialerSeat is $35 per seat per week, billed weekly, one product, dialer included. Dialpad Connect's Pro tier ($25/user/month), the one with CRM integrations, carries a 3-user minimum \u2014 one detailed breakdown documents a 2-person team paying roughly $46.75/month per active user once the seat minimum and a reported mandatory administrative fee are factored in, against the $25 headline. That's before adding Dialpad Sell for the dialer itself.",
  },
  {
    question: 'Is Dialpad\u2019s "unlimited calling" really unlimited?',
    answer:
      'Multiple independent reports note that Dialpad\u2019s advertised "unlimited calling" applies only to the US and Canada, and that SMS usage beyond 250 messages can incur per-message overage charges. DialerSeat\u2019s $35/week covers your calling with no separate usage policy to track.',
  },
  {
    question: 'Does DialerSeat offer whitelabel like Dialpad?',
    answer:
      'Yes \u2014 Manager+ is $75/month flat and includes full whitelabel, on the same product that already includes the dialer. We found no whitelabel or reseller program anywhere on Dialpad\u2019s site, across either Dialpad Connect or Dialpad Sell.',
  },
  {
    question: 'Why do "best dialer" lists recommend Dialpad?',
    answer:
      "Dialpad's AI transcription, real-time coaching, and call summaries are genuinely well-regarded, and that's usually what these roundups are praising. It's worth knowing that recommendation is about Dialpad's AI and phone-system features, not about an included power dialer \u2014 Dialpad Connect's phone plans don't have one at any tier; it's a separate product purchase.",
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
          { name: 'DialerSeat vs Dialpad', url: '/vs/dialpad' },
        ])}
      />
      <VsDialpadView />
    </>
  )
}
