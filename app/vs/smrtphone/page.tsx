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

const SLUG = 'smrtphone'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: "DialerSeat vs smrtPhone, Flat Weekly, Not Subscription Plus Credits",
  description: "smrtPhone stacks three charges: a $62-$104/month subscription, a $42-$75/seat/month dialer add-on, then per-minute credits. DialerSeat is $35 per seat per week with call time included.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/smrtphone',
  },
  openGraph: {
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
    url: 'https://dialerseat.com/vs/smrtphone',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs smrtPhone',
    description: "Subscription, plus dialer seat, plus per-minute credits. Versus one weekly number.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does smrtPhone pricing work?"),
    answer:
      msg("Three charges stack. The smrtPhone subscription is $62/month Standard or $104/month Pro billed monthly. smrtDialer is an add-on on top at about $42 per seat per month single-line or $75 multi-line. Then call time is deducted from a pre-paid credit balance from around $0.02 per minute. A heavy dialing day costs more than a light one."),
  },
  {
    question: msg("Is smrtPhone better for real-estate investors?"),
    answer:
      msg("If you run Podio or an REI CRM, quite possibly yes. smrtPhone is built for that world and the integration depth is real, it is a phone system wired into how investors already work, not a generic dialer with a connector bolted on. That is a genuine reason to choose it."),
  },
  {
    question: msg("Does smrtPhone have predictive dialing?"),
    answer:
      msg("No. smrtDialer is single-line or multi-line power dialing up to four lines, which is a different thing, there is no pacing engine adjusting to your team's answer rate. DialerSeat includes predictive alongside power, progressive and preview."),
  },
  {
    question: msg("What does DialerSeat charge for call time?"),
    answer:
      "Nothing extra. $35 per seat per week covers the dialing; there is no per-minute credit balance to top up and no bill that grows on a good day.",
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
          { name: msg("DialerSeat vs smrtPhone"), url: '/vs/smrtphone' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
