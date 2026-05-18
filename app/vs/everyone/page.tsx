import type { Metadata } from 'next'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import VsEveryoneView from './view'

export const metadata: Metadata = {
  title: 'DialerSeat vs Every Legacy Dialer — ReadyMode, Mojo, PhoneBurner, Five9, Convoso',
  description:
    'Every legacy dialer shares the same flaws: opaque pricing, annual contracts, dated UI, add-on stacking, desktop-only, compliance shortcuts. DialerSeat fixes every one at $35/week per seat. Solo or team. Every industry. Every device.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/everyone',
  },
  openGraph: {
    title: 'DialerSeat vs Every Legacy Dialer',
    description:
      'Side-by-side feature matrix vs ReadyMode, Mojo, PhoneBurner, Five9, Convoso. $35/week per seat. No annual contract. Modern UI. Every device.',
    url: 'https://dialerseat.com/vs/everyone',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to ReadyMode, Mojo, PhoneBurner, Five9, and Convoso?',
    answer:
      'DialerSeat offers the core features each of these legacy dialers provides — multi-line predictive dialing, AMD voicemail detection, local presence, STIR/SHAKEN — at $35/week per seat with no annual contract, no setup fee, and a modern UI built this year. The legacy dialers share common flaws: opaque pricing requiring a sales call, 12-month contract lock-in, add-on stacking that doubles the headline price, and desktop-only software.',
  },
  {
    question: 'What does DialerSeat actually cost?',
    answer:
      '$35 per seat per week — flat. No setup fee, no annual contract, no per-feature add-ons. Equivalent to about $140/month per seat. Solo agents pay $35/week for one seat; teams pay $35/week per seat with no minimum. Cancel anytime.',
  },
  {
    question: 'Why is weekly billing better than monthly?',
    answer:
      'Weekly billing means you can cancel at any point and only owe through the current week. Every other dialer in the category bills monthly minimum, most prefer annual contracts. DialerSeat is the only outbound dialer billing weekly at this price point.',
  },
  {
    question: 'Does DialerSeat work on mobile devices?',
    answer:
      'Yes. DialerSeat installs as a Progressive Web App on iPhone, iPad, Android, macOS, and Windows. Once installed it behaves like a native app — full-screen, dock icon, push-style behavior. Most legacy dialers are desktop-only or have minimal mobile experiences.',
  },
  {
    question: 'Is DialerSeat compliant with TCPA?',
    answer:
      'DialerSeat enforces TCPA calling windows server-side per lead state, runs all outbound traffic with full STIR/SHAKEN A-attestation, and registers every outbound number with the carrier registry (CNAM, FCR). The predictive dialer enforces the FTC Telemarketing Sales Rule 3% abandon-rate cap automatically. Consent record-keeping and DNC scrubbing remain the responsibility of the campaign owner.',
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
          { name: 'DialerSeat vs Every Legacy Dialer', url: '/vs/everyone' },
        ])}
      />
      <VsEveryoneView />
    </>
  )
}