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

const SLUG = 'wavv'

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
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs WAVV',
    description: 'WAVV charges more the harder you dial — $59 to $149/month depending on the mode. DialerSeat is $35 a week, flat, every mode included. Weekly billing, cancel any time.',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to WAVV on price?',
    answer:
      'DialerSeat is free for 7 days, then $35 per seat per week, billed weekly, cancel any time, with preview, power, and multi-line predictive dialing all included at that one price. WAVV publishes three separate tiers — $59/month for manual preview dialing, $99/month for single-line auto-dial, and $149/month for multi-line predictive dialing across up to three lines — plus a $1/month fee per phone number on top of whichever plan you choose.',
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
      'Yes. DialerSeat is free for 7 days, the same length as WAVV’s trial. A card is required to start it, nothing is charged until it ends, and there is one trial per customer. After that it is $35 per seat per week, billed weekly with no annual contract, so you can stop any week.',
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
          { name: 'DialerSeat vs WAVV', url: '/vs/wavv' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
