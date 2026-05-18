import type { Metadata } from 'next'
import VsReadyModeView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs ReadyMode — Modern Dialer Without the $2K Setup Fee',
  description:
    'DialerSeat is the modern alternative to ReadyMode. Multi-line predictive dialing, per-campaign mode, multiple scripts per campaign, server-side TCPA — at flat $35/week per seat. No $500–$2,000 setup fee, no annual contract, works on every device.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/readymode',
  },
  openGraph: {
    title: 'DialerSeat vs ReadyMode',
    description:
      'Same multi-line predictive at $35/week instead of $165–$249/month. No $2K setup fee. Modern UI built this year. Works on phones and tablets.',
    url: 'https://dialerseat.com/vs/readymode',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to ReadyMode on price?',
    answer:
      'DialerSeat is $35 per seat per week (about $140/month equivalent) with no setup fee and no annual contract. ReadyMode publishes a $165 starting price that lands at $200–$249 in practice once implementation fees, tier upgrades, and custom reports are added. ReadyMode also typically charges a $500–$2,000 setup fee. DialerSeat charges $0 for setup.',
  },
  {
    question: 'What does DialerSeat have that ReadyMode does not?',
    answer:
      'Weekly billing with one-click cancellation, per-campaign dialer mode (not account-wide), multiple scripts per campaign with live mid-call switching, server-side TCPA window enforcement per lead state, calendar-aligned analytics (Sunday + 1st-of-month resets), lapsed-user data preservation, and a Progressive Web App that installs on phones, tablets, and desktops. ReadyMode is desktop-only and forces one dialer mode account-wide.',
  },
  {
    question: 'Is DialerSeat compliant with TCPA?',
    answer:
      'DialerSeat enforces TCPA calling windows server-side per lead state, runs all outbound traffic with full STIR/SHAKEN A-attestation, and registers every outbound number with the carrier registry (CNAM, FCR). The predictive dialer enforces the FTC Telemarketing Sales Rule 3% abandon-rate cap automatically. Consent record-keeping and DNC scrubbing remain the responsibility of the campaign owner.',
  },
  {
    question: 'Can I migrate my data from ReadyMode to DialerSeat?',
    answer:
      'Yes. DialerSeat supports bulk import of leads, campaigns, and dispositions. Our team handles the conversion so you keep your call history and campaign structure intact.',
  },
  {
    question: 'Does DialerSeat work for solo agents or only teams?',
    answer:
      'Both. $35/week buys one seat. No minimum seat count, no team-only features locked away, no per-seat creep. Solo agents get the same product as 500-seat operations.',
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
          { name: 'DialerSeat vs ReadyMode', url: '/vs/readymode' },
        ])}
      />
      <VsReadyModeView />
    </>
  )
}