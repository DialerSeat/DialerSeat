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

const SLUG = 'calltools'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs CallTools: No Setup Fee, No Sales Call",
  description: "CallTools runs about $119.99 per user per month with setup fees commonly $500-$1,500 and integration quoted separately. DialerSeat is $35 per seat per week, self-serve, every dialer mode included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/calltools',
  },
  openGraph: {
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
    url: 'https://dialerseat.com/vs/calltools',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs CallTools',
    description: "Published price, no setup fee, and no sales conversation required to start dialing.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How much does CallTools cost?"),
    answer:
      msg("Roughly $119.99 per user per month month-to-month, or about $101.99 on an annual commitment. Those are starting figures, CallTools prices by quote, and reported setup fees run $500-$1,500 before the first call, with complex CRM integrations quoted separately at $2,000-$5,000. SMS is billed per message on top."),
  },
  {
    question: msg("Does DialerSeat charge a setup fee?"),
    answer:
      msg("No. $35 per seat per week is the whole bill for the software, charged weekly, cancellable any week. There is no onboarding fee, no implementation project and no minimum term."),
  },
  {
    question: msg("Is CallTools better for large contact centres?"),
    answer:
      msg("It is a mature contact-centre platform with reporting depth built for supervisors managing large floors, and if that is what you need it is a reasonable choice. DialerSeat is built for teams that want the dialing without the platform around it."),
  },
  {
    question: msg("Can I try either without talking to sales?"),
    answer:
      msg("DialerSeat, yes, sign up and dial. CallTools is quote-based, so the real number requires a sales conversation."),
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
          { name: msg("DialerSeat vs CallTools"), url: '/vs/calltools' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
