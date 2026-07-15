import type { Metadata } from 'next'
import VsWavvView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs WAVV — Every Dialer Mode, One Flat Price',
  description:
    'DialerSeat is $35 a week per seat — preview, power, and multi-line predictive dialing all included, no tier to unlock. WAVV starts at $59/month and requires its $149/month Multi Line plan for predictive dialing, plus $1/month per phone number.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/wavv',
  },
  openGraph: {
    title: 'DialerSeat vs WAVV',
    description:
      'WAVV charges more the harder you dial — $59 to $149/month depending on the mode. DialerSeat is $35 a week, flat, every mode included. Weekly billing, cancel any time.',
    url: 'https://dialerseat.com/vs/wavv',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to WAVV on price?',
    answer:
      'DialerSeat is $35 per seat per week, billed weekly, cancel any time, with preview, power, and multi-line predictive dialing all included at that one price. WAVV publishes three separate tiers — $59/month for manual preview dialing, $99/month for single-line auto-dial, and $149/month for multi-line predictive dialing across up to three lines — plus a $1/month fee per phone number on top of whichever plan you choose.',
  },
  {
    question: 'Does DialerSeat include predictive dialing at every price point?',
    answer:
      'Yes. Every DialerSeat seat includes multi-line predictive dialing, along with preview and power dialing, at the same $35/week price. WAVV requires upgrading to its top Multi Line tier to get predictive dialing across multiple lines.',
  },
  {
    question: 'Does WAVV charge extra for phone numbers?',
    answer:
      'Yes, WAVV charges $1 per phone number per month on top of its plan pricing. DialerSeat includes unlimited dial-out numbers and multiple inbound numbers per seat at no additional cost.',
  },
  {
    question: 'Can I switch dialer modes per campaign in DialerSeat?',
    answer:
      'Yes. DialerSeat lets you set the dialer mode — preview, power, progressive, or predictive — per campaign, so a cold list can run predictive while hot follow-ups run preview, all in the same account at the same price. WAVV\u2019s dialer speed is tied to which priced tier the account is on.',
  },
  {
    question: 'Does DialerSeat offer a free trial like WAVV?',
    answer:
      'DialerSeat does not run a formal free-trial period the way WAVV\u2019s 7-day trial works. Signup is self-serve with weekly billing and no annual contract, so total risk is limited to a single week at $35 rather than a monthly commitment.',
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
          { name: 'DialerSeat vs WAVV', url: '/vs/wavv' },
        ])}
      />
      <VsWavvView />
    </>
  )
}
