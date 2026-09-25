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

// Figures from Nextiva's own pricing page, read 25 Sept 2026: Core $23/$15,
// Engage $50/$25, Scale $75 annual, contact center Essential from $75 an agent,
// and "Progressive, Predictive" listed in the Professional tier, which is
// Contact Sales. Held back from the first batch because the DIALING price was
// unknown; the answer is that the published prices are not dialing prices.
const SLUG = 'nextiva'

export const metadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialerSeat vs Nextiva: Pros, Cons and Where the Dialer Actually Lives',
  description:
    'The pros and cons of Nextiva against DialerSeat. Nextiva publishes $15 to $75 a user a month, but none of those plans dial; progressive and predictive sit in a contact center tier quoted by sales. DialerSeat is $35 a week with every mode included.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/nextiva',
  },
  openGraph: {
    title: 'DialerSeat vs Nextiva',
    description: 'A phone system whose published plans do not dial, against a dialer billed a week at a time.',
    url: 'https://dialerseat.com/vs/nextiva',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Nextiva',
    description: 'A phone system whose published plans do not dial, against a dialer billed a week at a time.',
  },
}

const FAQS = [
  {
    question: 'What does Nextiva cost?',
    answer:
      'Nextiva publishes Core at $23 per user per month, or $15 billed annually; Engage at $50, or $25 annually; and Scale at $75 annually. Its contact center starts at $75 per agent per month. The lowest figure on every plan requires annual billing.',
  },
  {
    question: 'Does Nextiva have a predictive dialer?',
    answer:
      'Not on the business phone plans. Progressive and predictive dialing are listed in the contact center Professional tier, which Nextiva does not price publicly. So the plans you can see a price for are not the plans that dial.',
  },
  {
    question: 'Is Nextiva or DialerSeat better for outbound calling?',
    answer:
      'DialerSeat, if dialing is the job. All four dialing modes, answering machine detection, local presence and the compliance tooling are in the $35 weekly seat. Nextiva is a phone system first, and reaching predictive dialing means a contact center tier and a sales conversation.',
  },
  {
    question: 'When is Nextiva the better buy?',
    answer:
      'When you need a business phone system: extensions, an auto attendant, video meetings and SMS for a whole company that also makes some outbound calls. DialerSeat is not a phone system and does not try to be one.',
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
          { name: 'DialerSeat vs Nextiva', url: '/vs/nextiva' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
