import type { Metadata } from 'next'
import VsPhoneBurnerView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs PhoneBurner — Multi-Line Without the Tier Upgrades',
  description:
    'DialerSeat is the modern alternative to PhoneBurner. Multi-line predictive included (PhoneBurner is single-line only), everything in one tier (no Premium upgrades), flexible list sizes, weekly billing — flat $35/week per seat, no annual contract.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/phoneburner',
  },
  openGraph: {
    title: 'DialerSeat vs PhoneBurner',
    description:
      'Multi-line predictive (PhoneBurner is single-line only). Everything in one tier. Weekly billing, no annual contract. $35/week per seat.',
    url: 'https://dialerseat.com/vs/phoneburner',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to PhoneBurner on price?',
    answer:
      'DialerSeat is $35 per seat per week (about $140/month equivalent) with everything in one tier — no upgrades needed for inbound numbers, advanced reporting, or public API access. PhoneBurner advertises $140/seat/month at the Professional tier but real bills land at $200–$250 once Premium-tier features (inbound numbers, advanced reporting) and annual-contract assumptions are factored in.',
  },
  {
    question: 'Does PhoneBurner have multi-line dialing?',
    answer:
      'No. PhoneBurner is single-line only — one call per agent at a time. That is the most-cited complaint in PhoneBurner reviews on G2 and Reddit. DialerSeat supports four dialer modes (Preview, Power, Progressive, Predictive) configurable per campaign, including multi-line predictive with proper pacing.',
  },
  {
    question: 'Can I use single-line on DialerSeat if I prefer it?',
    answer:
      'Yes. Use Preview or Power mode for single-line dialing — same approach PhoneBurner uses. DialerSeat does not force multi-line on anyone; it makes multi-line available when you want it.',
  },
  {
    question: 'Does DialerSeat support flexible dial-list sizes?',
    answer:
      'Yes. Any list size — 1 contact, 17 contacts, 4,000 contacts. No forced 10/25/50 increments. Plus single-contact calling for one-off calls. Both are commonly-cited PhoneBurner frustrations.',
  },
  {
    question: 'Is DialerSeat compliant with TCPA?',
    answer:
      'DialerSeat enforces TCPA calling windows server-side per lead state, runs all outbound traffic with full STIR/SHAKEN A-attestation, and registers every outbound number with the carrier registry (CNAM, FCR). The predictive dialer enforces the FTC Telemarketing Sales Rule 3% abandon-rate cap automatically.',
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
          { name: 'Comparisons', url: '/vs/everyone' },
          { name: 'DialerSeat vs PhoneBurner', url: '/vs/phoneburner' },
        ])}
      />
      <VsPhoneBurnerView />
    </>
  )
}