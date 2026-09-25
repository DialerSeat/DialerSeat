import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import { prosConsKeywords, prosConsFaqs } from '@/lib/vsSeo'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

// Figures from HubSpot's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'hubspot'

export const metadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs HubSpot Calling: Pros, Cons and Pricing",
  description:
    "The pros and cons of calling from HubSpot against a dedicated dialer. Sales Hub calling minutes are capped by plan, the power dialer is in beta, and Professional adds a $1,500 onboarding fee. DialerSeat is $35 a week with every mode included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/hubspot',
  },
  openGraph: {
    title: 'DialerSeat vs HubSpot',
    description: "Calling inside your CRM, against a dialer built for a full day on the phones.",
    url: 'https://dialerseat.com/vs/hubspot',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs HubSpot',
    description: "Calling inside your CRM, against a dialer built for a full day on the phones.",
  },
}

const FAQS = [
  {
    question: "What does HubSpot Sales Hub cost for calling?",
    answer:
      "Per seat per month: Starter $20 ($7 billed annually), Professional $100 ($90 annually) and Enterprise $150. Professional adds a one-time onboarding fee of $1,500 and Enterprise $3,500. There is a free plan for up to two users.",
  },
  {
    question: "How many calling minutes does HubSpot include?",
    answer:
      "It depends on the plan: 500 minutes on Starter, 3,000 on Professional and 12,000 on Enterprise. DialerSeat does not meter calling minutes.",
  },
  {
    question: "Does HubSpot have a power dialer?",
    answer:
      "HubSpot has a power dialer in beta that queues calls from the CRM and can drop a voicemail in one click. Which plans include it is not stated, and predictive or multi-line dialing is not claimed. DialerSeat includes preview, power, progressive and multi-line predictive dialing on every seat.",
  },
  {
    question: "Can I use DialerSeat with HubSpot?",
    answer:
      "Yes. DialerSeat accepts leads pushed from HubSpot by webhook and reads the fields HubSpot nests under properties, so contacts can flow from the CRM into a dialing campaign without reformatting.",
  },
]

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema([...FAQS, ...prosConsFaqs(SLUG)])} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs HubSpot', url: '/vs/hubspot' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
