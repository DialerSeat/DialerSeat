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
import { localizeMetadata } from '@/lib/i18n/metadata'

// Figures from REDX's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'redx'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs REDX: Pros, Cons and What the Dialer Costs",
  description:
    "The pros and cons of REDX against DialerSeat. REDX sells real estate leads with a dialer attached: single-line on its $299 bundle, triple-line on $349. DialerSeat is $35 a week for a dialer with every mode, and you bring your own leads.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/redx',
  },
  openGraph: {
    title: 'DialerSeat vs REDX',
    description: "Leads with a dialer attached, against a dialer you bring your own leads to.",
    url: 'https://dialerseat.com/vs/redx',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs REDX',
    description: "Leads with a dialer attached, against a dialer you bring your own leads to.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does REDX cost?"),
    answer:
      msg("Each lead list (expired, FSBO, FRBO, pre-foreclosure or GeoLeads) is $60 a month or $600 a year. Bundles are Core at $199 a month, Connect at $299 with a single-line power dialer, and Pro at $349 with a triple-line dialer. Extra users are $75 a month on Core and Connect and $99 on Pro."),
  },
  {
    question: msg("Is the REDX dialer single-line or multi-line?"),
    answer:
      msg("Both, depending on the bundle: single-line on Connect at $299 a month and triple-line on Pro at $349. The Core bundle does not include the dialer."),
  },
  {
    question: msg("Can I buy the REDX dialer without leads?"),
    answer:
      msg("REDX’s pricing page lists the dialer only as part of its Connect and Pro lead bundles, with no standalone dialer price. DialerSeat is the reverse: a dialer at $35 a week with no leads included, for agents who already have a source."),
  },
  {
    question: msg("Does DialerSeat come with real estate leads?"),
    answer:
      msg("No. DialerSeat is a dialer only, so you bring your own list, whether that is expireds and FSBOs from a data provider or leads from your own marketing. If you want leads and a dialer from one vendor, REDX is built for exactly that."),
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
          { name: msg("DialerSeat vs REDX"), url: '/vs/redx' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
