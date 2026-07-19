import type { Metadata } from 'next'
import VsCloudtalkView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs CloudTalk — The Dialer Isn\u2019t a Paid Add-On',
  description:
    'CloudTalk\u2019s $19/seat headline doesn\u2019t include a dialer \u2014 Power Dialer is +$15/seat/month, Parallel Dialer is +$39/seat/month. DialerSeat includes every dialer mode at $35/seat/week, billed weekly, no add-on required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/cloudtalk',
  },
  openGraph: {
    title: 'DialerSeat vs CloudTalk',
    description:
      'Every dialer mode included at a flat $35/week per seat \u2014 not a $15 or $39 add-on stacked on top of a cheap phone-system seat.',
    url: 'https://dialerseat.com/vs/cloudtalk',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to CloudTalk on price?',
    answer:
      "DialerSeat is $35 per seat per week, billed weekly, with every dialer mode included. CloudTalk's cheapest published tier (Lite) runs about $19/user/month on annual billing, but that's a phone-system seat, not a dialer. Power Dialer is a separate $15/user/month add-on, and Parallel Dialer (multi-line) is a separate $39/user/month add-on, both stacked on top of the base seat.",
  },
  {
    question: 'Does CloudTalk\u2019s advertised price include a power dialer?',
    answer:
      "No. Power Dialer and Parallel Dialer are listed as separate paid add-ons on CloudTalk's own pricing page, on top of whichever base tier (Lite, Starter, Essential, or Expert) you're subscribed to. A seat with Power Dialer realistically runs $34+/user/month; with Parallel/multi-line dialing, $58+/user/month. DialerSeat includes every dialer mode \u2014 predictive, power, progressive, and preview \u2014 in the one $35/week price.",
  },
  {
    question: 'Why does CloudTalk\u2019s pricing page show prices in euros?',
    answer:
      'CloudTalk\u2019s pricing page renders in euros by default for every visitor, including US buyers, based on multiple independent reports checking the page directly. This makes straightforward dollar comparison harder than it should be for US-based teams. DialerSeat publishes pricing in US dollars on the homepage.',
  },
  {
    question: 'Does DialerSeat offer whitelabel like CloudTalk?',
    answer:
      'Yes \u2014 Manager+ is $75/month flat and includes full whitelabel. We found no whitelabel or reseller program anywhere on CloudTalk\u2019s site. CloudTalk does offer volume discounts for larger teams and call monitoring on its Expert tier, but the dialer add-on costs still apply regardless of tier.',
  },
  {
    question: 'Does DialerSeat work on mobile like CloudTalk?',
    answer:
      'Yes \u2014 the full dialer experience, not a companion app. DialerSeat installs as a Progressive Web App on iPhone, iPad, Android, macOS, and Windows with the same dialer modes as desktop. CloudTalk does have a mobile app, but the same Power Dialer and Parallel Dialer add-on costs apply there as well \u2014 the mobile app doesn\u2019t change what\u2019s included in the base seat price.',
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
          { name: 'DialerSeat vs CloudTalk', url: '/vs/cloudtalk' },
        ])}
      />
      <VsCloudtalkView />
    </>
  )
}
