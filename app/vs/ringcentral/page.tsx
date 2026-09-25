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

const SLUG = 'ringcentral'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs RingCentral: A Dialer, Not a Phone System",
  description: "RingCentral is an excellent business phone system, but outbound dialing lives in RingCX, its contact-centre product, from around $65 per user per month. DialerSeat is a dialer at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ringcentral',
  },
  openGraph: {
    title: 'DialerSeat vs RingCentral',
    description: "RingCentral plans start at $20. The dialer is not in them, it is in a different product line.",
    url: 'https://dialerseat.com/vs/ringcentral',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs RingCentral',
    description: "RingCentral plans start at $20. The dialer is not in them, it is in a different product line.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: "Does RingCentral include an auto dialer?",
    answer:
      msg("Not in the plans most people quote. Core, Advanced and Ultra are business phone plans, even Ultra requires an add-on for dialing. Predictive and progressive dialing come with RingCX, RingCentral's contact-centre product, which starts around $65 per user per month. Outbound dialer minutes can also be metered separately."),
  },
  {
    question: msg("Is RingCentral better than DialerSeat?"),
    answer:
      msg("At being a phone system, comfortably, and that is what it is. Global carrier infrastructure, enterprise compliance certifications, an enormous integration catalogue, and a company that will still be here in ten years. If you need a business phone system with outbound as a secondary requirement, RingCentral is the sensible answer."),
  },
  {
    question: msg("When does DialerSeat make more sense?"),
    answer:
      msg("When dialing is the job rather than a feature. If your team's day is a lead list and a headset, a contact-centre tier at roughly triple the price of a phone seat is a lot of platform for the part you actually use."),
  },
  {
    question: msg("Can I use both?"),
    answer:
      msg("Yes, and plenty of teams should. RingCentral for company telephony, DialerSeat for the outbound floor. They are not mutually exclusive."),
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
          { name: msg("DialerSeat vs RingCentral"), url: '/vs/ringcentral' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
