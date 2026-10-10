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

const SLUG = 'dialpad'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'Dialpad Power Dialer Alternative: Pricing, Pros & Cons | DialerSeat',
  description:
    'Dialpad Connect, the $15-$35/user/month phone system, has no power dialer at any tier: the dialer lives in a separate product, Dialpad Sell, starting around $39/user/month. DialerSeat includes every dialer mode at $35/seat/week, one product.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialpad',
  },
  openGraph: {
    title: 'DialerSeat vs Dialpad',
    description:
      'The dialer, included at $35/week per seat, not a separate $39+/month product you have to discover and buy on top.',
    url: 'https://dialerseat.com/vs/dialpad',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Dialpad',
    description: 'The dialer, included at $35/week per seat, not a separate $39+/month product you have to discover and buy on top.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("Does Dialpad include a power dialer?"),
    answer:
      msg("Not in Dialpad Connect, the core phone system most people mean when they say \"Dialpad\" ($15/user/month Standard, $25 Pro, $35 Enterprise). Multiple independent pricing breakdowns confirm the power dialer is exclusive to a separate product line, Dialpad Sell, starting around $39/user/month. DialerSeat includes predictive, power, progressive, and preview dialing in the one $35/week price, no second product required."),
  },
  {
    question: msg("How does DialerSeat compare to Dialpad on price?"),
    answer:
      msg("DialerSeat is $35 per seat per week, billed weekly, one product, dialer included. Dialpad Connect's Pro tier ($25/user/month), the one with CRM integrations, carries a 3-user minimum, one detailed breakdown documents a 2-person team paying roughly $46.75/month per active user once the seat minimum and a reported mandatory administrative fee are factored in, against the $25 headline. That's before adding Dialpad Sell for the dialer itself."),
  },
  {
    question: msg("Is Dialpad’s \"unlimited calling\" really unlimited?"),
    answer:
      msg("Multiple independent reports note that Dialpad’s advertised \"unlimited calling\" applies only to the US and Canada, and that SMS usage beyond 250 messages can incur per-message overage charges. DialerSeat’s $35/week covers your calling with no separate usage policy to track."),
  },
  {
    question: msg("Does DialerSeat offer whitelabel like Dialpad?"),
    answer:
      msg("Yes: Manager+ is $75/week flat and includes full whitelabel, on the same product that already includes the dialer. We found no whitelabel or reseller program anywhere on Dialpad’s site, across either Dialpad Connect or Dialpad Sell."),
  },
  {
    question: msg("Why do \"best dialer\" lists recommend Dialpad?"),
    answer:
      "Dialpad's AI transcription, real-time coaching, and call summaries are genuinely well-regarded, and that's usually what these roundups are praising. It's worth knowing that recommendation is about Dialpad's AI and phone-system features, not about an included power dialer, Dialpad Connect's phone plans don't have one at any tier; it's a separate product purchase.",
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
          { name: msg("DialerSeat vs Dialpad"), url: '/vs/dialpad' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
