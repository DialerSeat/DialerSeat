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

// Figures from GoHighLevel's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'gohighlevel'

export const metadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs GoHighLevel Dialer: Pros, Cons and Pricing",
  description:
    "The pros and cons of GoHighLevel’s dialer against DialerSeat. HighLevel plans run $97 to $497 a month with calling billed per minute from a wallet. DialerSeat is a dedicated dialer at $35 a week with every mode and calling included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/gohighlevel',
  },
  openGraph: {
    title: 'DialerSeat vs GoHighLevel',
    description: "A power dialer inside an agency platform, against a dialer that is the whole product.",
    url: 'https://dialerseat.com/vs/gohighlevel',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs GoHighLevel',
    description: "A power dialer inside an agency platform, against a dialer that is the whole product.",
  },
}

const FAQS = [
  {
    question: "What does GoHighLevel cost?",
    answer:
      "Starter is $97 a month, Unlimited $297 and Agency Pro $497, month to month with a 14-day trial. Calling runs through its LC Phone system and is billed per minute from a prepaid wallet: US outbound calls are about $0.018 a minute and local numbers $1.15 a month. An agency rebilling usage to clients can add its own markup on top.",
  },
  {
    question: "Does GoHighLevel have a power dialer?",
    answer:
      "Yes. HighLevel’s phone system includes a power dialer that works through a call list automatically. Its own announcement of the feature does not say whether it dials more than one line at a time or which plans include it. DialerSeat includes multi-line predictive dialing alongside preview, power and progressive on every seat.",
  },
  {
    question: "Should an agency use GoHighLevel’s dialer or DialerSeat?",
    answer:
      "If your clients already run on HighLevel and dialing is an occasional task, its built-in dialer keeps everything in one account. If dialing is the job, a dedicated dialer gives you predictive and multi-line dialing, calling with no per-minute wallet, and white-labeling on Manager+ for $75 a week. You can also run both: keep leads in HighLevel and push them into DialerSeat by webhook.",
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
          { name: 'DialerSeat vs GoHighLevel', url: '/vs/gohighlevel' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
