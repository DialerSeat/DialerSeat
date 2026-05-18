import type { Metadata } from 'next'
import VsMojoView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Mojo Dialer — Triple-Line Speed for Every Industry',
  description:
    'DialerSeat is the modern alternative to Mojo Dialer. Triple-line speed plus real multi-line predictive, multiple scripts per campaign, public API for any CRM — at flat $35/week per seat. No $10/mo Agent Access fee, no $25–$49 data add-ons, every industry welcome.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/mojo',
  },
  openGraph: {
    title: 'DialerSeat vs Mojo Dialer',
    description:
      'Same triple-line speed across every industry, not just real estate. No $10/mo Agent Access fee. No $25–$49 data add-ons stacking. $35/week per seat.',
    url: 'https://dialerseat.com/vs/mojo',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to Mojo Dialer on price?',
    answer:
      'DialerSeat is $35 per seat per week (about $140/month equivalent) with everything included. Mojo Dialer advertises $139/month for Triple Line, but real customer bills land at $250–$350 once the $10/mo Agent Access fee and $25–$49 data add-ons (FSBO, Pre-Foreclosure, Neighborhood, Skip Tracer) are stacked. DialerSeat has no required access fee and no per-dataset subscriptions.',
  },
  {
    question: 'Is DialerSeat only for real estate?',
    answer:
      'No. DialerSeat is industry-agnostic from day one — insurance (life, health, IUL, veterans), real estate, financial services, B2B SaaS, fundraising, debt resolution, mortgage, solar, recruiting, and more. Mojo is built around FSBO, expired, and neighborhood data which works well for real estate but limits other industries.',
  },
  {
    question: 'Does DialerSeat have triple-line dialing like Mojo?',
    answer:
      'Yes — and also real predictive dialing with proper pacing and abandon-rate caps. Mojo offers triple-line but no true predictive mode. DialerSeat supports four modes (Preview, Power, Progressive, Predictive) configurable per campaign.',
  },
  {
    question: 'Can I use my preferred real estate data with DialerSeat?',
    answer:
      'Yes. DialerSeat integrates with the same FSBO, expired, and skip-tracing data providers Mojo resells, via our public API. You keep your preferred data source without paying Mojo a markup.',
  },
  {
    question: 'Does DialerSeat work on mobile?',
    answer:
      'Yes. DialerSeat installs as a Progressive Web App on iPhone, iPad, Android, macOS, and Windows. Field agents can dial from an iPad, solo agents can close from their phone between meetings. Mojo offers mobile web only.',
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
          { name: 'DialerSeat vs Mojo Dialer', url: '/vs/mojo' },
        ])}
      />
      <VsMojoView />
    </>
  )
}