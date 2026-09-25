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
import { msg } from '@/lib/i18n/msg'

// Figures from Close's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'close'

export const metadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs Close: Pros, Cons and What the Dialer Costs",
  description:
    "The pros and cons of Close against DialerSeat. Close is a CRM with a power dialer from $109 per user and predictive on Scale at $149, with calling billed on top. DialerSeat is $35 a week with every mode and calling included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/close',
  },
  openGraph: {
    title: 'DialerSeat vs Close',
    description: "A CRM with the dialer on its upper plans, against a dialer with every mode included.",
    url: 'https://dialerseat.com/vs/close',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Close',
    description: "A CRM with the dialer on its upper plans, against a dialer with every mode included.",
  },
}

const FAQS = [
  {
    question: msg("What does Close cost?"),
    answer:
      msg("Per user per month: Solo $19 ($9 billed annually, limited to one user), Essentials $49 ($35), Growth $109 ($99) and Scale $149 ($139). Calling is billed on top at cost: Close says most outbound calls are around $0.02 a minute and numbers start at about $1 a month."),
  },
  {
    question: msg("Does Close have a power dialer or a predictive dialer?"),
    answer:
      msg("Both, on its upper plans. The power dialer starts on Growth at $109 per user per month, and predictive dialing, which dials several numbers at once, is only on Scale at $149. Solo and Essentials have no power dialer. DialerSeat includes preview, power, progressive and predictive dialing on every seat at $35 a week."),
  },
  {
    question: msg("Is Close cheaper than DialerSeat?"),
    answer:
      msg("Per seat, Close Growth is: $109 a month against DialerSeat at about $152 a month ($35 a week). What Growth does not include is predictive dialing, which needs Scale at $149, or calling, which Close bills per minute on top. DialerSeat includes both. For a team that only needs power dialing and a CRM, Close Growth is a genuinely good deal."),
  },
  {
    question: msg("What does a five-person team cost on Close?"),
    answer:
      msg("About $545 a month on Growth billed monthly, or $745 on Scale for predictive dialing, in both cases plus per-minute calling usage. On DialerSeat, five seats are $175 a week with calling included, plus $75 a week for a Manager+ owner if you want team management and white-labeling."),
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
          { name: msg("Home"), url: '/' },
          { name: msg("Comparisons"), url: '/vs' },
          { name: msg("DialerSeat vs Close"), url: '/vs/close' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
