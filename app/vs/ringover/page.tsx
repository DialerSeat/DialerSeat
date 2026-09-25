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

// Figures from Ringover's own published pricing, read 24 Sept 2026. See the
// entry in lib/competitors for what was and was not stated by the vendor.
const SLUG = 'ringover'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs Ringover: Pros, Cons and the 12-Month Commitment",
  description:
    "The pros and cons of Ringover against DialerSeat. Ringover’s power dialer is on its Business plan, with a three-user minimum and a twelve-month commitment. DialerSeat is $35 a week per seat, one seat minimum, cancel any week.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/ringover',
  },
  openGraph: {
    title: 'DialerSeat vs Ringover',
    description: "A phone system with a year-long commitment, against a dialer billed a week at a time.",
    url: 'https://dialerseat.com/vs/ringover',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Ringover',
    description: "A phone system with a year-long commitment, against a dialer billed a week at a time.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does Ringover cost?"),
    answer:
      msg("Talk is $15 to $24 per user per month and Business, which includes the power dialer, is $47 to $57, depending on how you are billed. Both published plans require at least three users and a twelve-month commitment."),
  },
  {
    question: msg("Does Ringover require a contract?"),
    answer:
      msg("Yes. Both of Ringover’s published plans carry a twelve-month commitment and a three-user minimum. DialerSeat bills weekly with no contract and a one-seat minimum."),
  },
  {
    question: msg("What is the smallest Ringover plan with a power dialer?"),
    answer:
      msg("Business with three users, at $141 to $171 a month depending on billing, committed for twelve months: $1,692 to $2,052 over the year. The smallest DialerSeat purchase with every dialer mode is one seat for one week at $35."),
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
          { name: msg("DialerSeat vs Ringover"), url: '/vs/ringover' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
