import type { Metadata } from 'next'
import VsFive9View from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Five9 — Enterprise Features Without the Enterprise Sales Cycle',
  description:
    'DialerSeat is the modern alternative to Five9. Self-serve signup in minutes (not weeks of demos), public $35/week pricing (no custom quotes), no annual contract, no implementation fees. Multi-line predictive dialing with the same compliance posture.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/five9',
  },
  openGraph: {
    title: 'DialerSeat vs Five9',
    description:
      'Skip the demo cycle, the annual contract, and the $175+/seat pricing. Same compliance posture, public $35/week pricing, self-serve signup.',
    url: 'https://dialerseat.com/vs/five9',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to Five9 on price?',
    answer:
      "DialerSeat is $35 per seat per week (about $140/month equivalent) with public pricing and self-serve signup. Five9 doesn't publish pricing — most quotes land at $175+ per seat per month, often with a multi-year contract and implementation fees on top. DialerSeat has no setup fee, no contract, and you can sign up and start dialing in under 10 minutes.",
  },
  {
    question: 'Why does Five9 require a sales call?',
    answer:
      'Five9 is enterprise-focused — their sales motion is built around 50-500 seat call centers with procurement teams and custom requirements. The demo cycle takes 1-4 weeks, custom quotes are normal, and annual commitments are typical. DialerSeat is the opposite — self-serve signup, flat $35/week, no demo required. Both approaches are valid; we just match different buyer profiles.',
  },
  {
    question: 'Does DialerSeat have the same compliance as Five9?',
    answer:
      "DialerSeat enforces TCPA calling windows server-side per lead state, provisions outbound traffic through a carrier providing STIR/SHAKEN A-attestation where supported, and registers every outbound number with the carrier registry (CNAM, FCR). The predictive dialer enforces the FTC Telemarketing Sales Rule 3% abandon-rate cap automatically. Five9 offers similar compliance posture at the enterprise level. The technical infrastructure is comparable; the difference is delivery model and price.",
  },
  {
    question: 'Can DialerSeat handle high-volume teams like Five9?',
    answer:
      'Yes. DialerSeat is designed for solo agents through 500+ seat operations. Same product, same $35/week per seat. Per-campaign dialer mode (Preview, Power, Progressive, Predictive), multiple scripts per campaign with live mid-call switching, calendar-aligned analytics, and lapsed-user data preservation. Public API and webhooks integrate with any CRM.',
  },
  {
    question: 'What does Five9 have that DialerSeat does not?',
    answer:
      "Five9 has a longer enterprise feature surface — workforce management, dedicated implementation teams, white-glove migration services, and a much larger third-party integration ecosystem built over 20+ years. If you need workforce scheduling, dedicated CSMs, or pre-built integrations with niche enterprise tools, Five9 may be a better fit. If you want the core outbound dialer at a fraction of the price with self-serve setup, DialerSeat is the better fit.",
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
          { name: 'DialerSeat vs Five9', url: '/vs/five9' },
        ])}
      />
      <VsFive9View />
    </>
  )
}