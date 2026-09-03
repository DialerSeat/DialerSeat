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

const SLUG = 'batchdialer'

export const metadata: Metadata = {
  title: 'DialerSeat vs BatchDialer: Their Annual Rate Without the Annual Contract',
  description:
    "BatchDialer's advertised $95/seat is the annual prepay rate; month to month it is $119–$249. DialerSeat is $35/week billed weekly with all four dialer modes, automatic number cycling on every plan, multiple scripts per campaign, and whitelabel at $75/mo flat.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/batchdialer',
  },
  openGraph: {
    title: 'DialerSeat vs BatchDialer',
    description:
      'Automatic number replacement on every plan, not gated behind Pro. No per-number fees. No annual prepay to reach the real price. $35/week per seat.',
    url: 'https://dialerseat.com/vs/batchdialer',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs BatchDialer',
    description: 'Automatic number replacement on every plan, not gated behind Pro. No per-number fees. No annual prepay to reach the real price. $35/week per seat.',
  },
}

// Answers are written to be defensible against BatchDialer's own published
// pricing rather than maximally flattering — a comparison page that overstates
// is one screenshot away from being worthless, and these are indexed.
const FAQS = [
  {
    question: 'How does DialerSeat compare to BatchDialer on price?',
    answer:
      "BatchDialer publishes $95, $151 and $199 per agent per month, but those are annual prepay rates: their own pricing reaches $95 by billing Starter at roughly $1,142 per agent per year. Month to month the same tiers are $119, $189 and $249. DialerSeat is $35 per seat per week, billed weekly, with no commitment and nothing prepaid, you can cancel any week rather than committing to a year to reach a headline rate.",
  },
  {
    question: 'Does BatchDialer include automatic number replacement?',
    answer:
      'Only on Pro and Enterprise. BatchDialer Starter includes phone reputation monitoring, which tells you a number has been flagged, but replacing it is manual and numbers beyond your included allotment are billed per number. DialerSeat cycles numbers automatically on every plan and grows the pool as seats are added, because deliverability decay is the main thing that degrades an outbound operation over time.',
  },
  {
    question: 'How many simultaneous lines does each dialer support?',
    answer:
      'BatchDialer allows 3 simultaneous lines on Starter and 5 on Pro and Enterprise. DialerSeat paces predictive dialing against real agent availability rather than selling line count as a tier upgrade, and supports four modes: Preview, Power, Progressive and Predictive, configurable per campaign at one price.',
  },
  {
    question: 'Is DialerSeat only for real estate?',
    answer:
      'No. DialerSeat is industry-agnostic: insurance, financial services, mortgage, solar, recruiting, B2B and agency floors. BatchDialer is built around the BatchLeads and PropStream ecosystem for real estate investors and wholesalers. If your workflow starts with skip-traced property lists, that integration is a genuine advantage of theirs; if it does not, you are paying for an ecosystem you will not open.',
  },
  {
    question: 'Does either product offer whitelabel?',
    answer:
      'DialerSeat does, through Manager+ at $75 per month flat: your brand and your subdomain, at any team size. BatchDialer does not publish a whitelabel tier, so an agency reselling seats on BatchDialer is always reselling a branded third-party product.',
  },
  {
    question: 'When is BatchDialer the better choice?',
    answer:
      'Two cases. If you work inside BatchLeads or PropStream and want property data and dialing from one vendor, that consolidation has real value. And BatchDialer bundles DNC and litigator scrubbing on every tier: DialerSeat honors DNC and enforces calling windows per lead in the lead’s own timezone, but if you want litigator screening built into the dialer itself, that is a point in their favor.',
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
          { name: 'Comparisons', url: '/vs/everyone' },
          { name: 'DialerSeat vs BatchDialer', url: '/vs/batchdialer' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
