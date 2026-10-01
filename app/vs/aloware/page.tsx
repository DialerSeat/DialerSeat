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

const SLUG = 'aloware'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Aloware Alternative: Pricing, Pros & Cons | DialerSeat',
  description: "Aloware starts around $30 per user per month, with dialing capability tiered above it and ad-hoc charges outside the seat price. DialerSeat includes every dialer mode at $35 per seat per week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/aloware',
  },
  openGraph: {
    title: 'DialerSeat vs Aloware',
    description: "A low entry price is real. So is which tier the outbound features sit in.",
    url: 'https://dialerseat.com/vs/aloware',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Aloware',
    description: "A low entry price is real. So is which tier the outbound features sit in.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How much is Aloware?"),
    answer:
      msg("iPro + AI is around $30 per user per month, uPro + AI around $60, and xPro + AI around $85. Aloware also documents ad-hoc charges that sit outside the seat price, so the plan rate is not the whole bill."),
  },
  {
    question: msg("Is Aloware good for CRM-based sales teams?"),
    answer:
      msg("Yes: that is what it is built for, and the HubSpot and Pipedrive integration is a genuine strength. If your team works leads inside a CRM and wants calling and texting attached to that workflow, Aloware fits the shape of the job better than a list dialer does."),
  },
  {
    question: msg("Which is better for high-volume list dialing?"),
    answer:
      "DialerSeat. Aloware is built around CRM workflows; DialerSeat is built around getting through a list, with predictive pacing, per-campaign modes and server-side calling-window enforcement.",
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
          { name: msg("DialerSeat vs Aloware"), url: '/vs/aloware' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
