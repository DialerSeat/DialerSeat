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

const SLUG = 'orum'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialerSeat vs Orum: $35/week vs $250+/month, Annual Contract',
  description:
    'DialerSeat is the transparent, self-serve alternative to Orum. Orum starts around $250/user/month billed annually with a 3-seat minimum and no public pricing. DialerSeat is $35 per seat per week, cancel anytime, one seat minimum, sign up in minutes.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/orum',
  },
  openGraph: {
    title: 'DialerSeat vs Orum',
    description:
      'No demo required, no annual contract, no 3-seat minimum. $35/week per seat vs Orum\'s widely-reported $250+/user/month starting price.',
    url: 'https://dialerseat.com/vs/orum',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Orum',
    description: 'No demo required, no annual contract, no 3-seat minimum. $35/week per seat vs Orum\'s widely-reported $250+/user/month starting price.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does DialerSeat compare to Orum on price?"),
    answer:
      msg("Orum doesn't publish pricing, you have to request a demo and get a custom quote. Third-party pricing research consistently reports a starting price around $250 per user per month on the Launch plan, billed annually, with a 3-seat minimum (roughly $9,000/year minimum commitment). Higher tiers are reported to reach $800/user/month. AI Coaching is a separate add-on reported at $50-200/user/month. DialerSeat is $35 per seat per week, billed weekly, cancel anytime, with a one-seat minimum and every dialer mode included."),
  },
  {
    question: msg("Does Orum require an annual contract?"),
    answer:
      msg("Based on consistent third-party reporting, yes: Orum's plans are billed annually only, with no monthly billing option. DialerSeat bills weekly with no annual commitment, so you can cancel before the next billing cycle with nothing owed after."),
  },
  {
    question: msg("Can I sign up for Orum without a sales call?"),
    answer:
      msg("No. Orum does not publish pricing on its website and requires a demo with a sales rep before you can subscribe: even the limited free trial reportedly requires going through sales to activate, with a 1-2 week process before dialing. DialerSeat is self-serve: you can sign up and place your first dial in minutes."),
  },
  {
    question: msg("Does DialerSeat offer the same parallel dialing as Orum?"),
    answer:
      msg("Not exactly the same. Orum's core feature is AI-driven parallel dialing across 5-10 lines simultaneously, aimed at maximizing raw call volume for high-volume SDR teams. DialerSeat offers multi-line dialing (triple-line) plus a true predictive mode with pacing and abandon-rate caps, alongside Preview, Power, and Progressive modes, strong connect-rate-focused dialing without Orum's reported 1-2 second connection lag or the spam-flagging complaints tied to high-volume parallel dialing."),
  },
  {
    question: msg("Is Orum only for sales teams?"),
    answer:
      msg("Orum is positioned specifically for B2B SDR and sales teams doing high-volume outbound prospecting. DialerSeat is industry-agnostic: insurance, real estate, financial services, B2B SaaS, fundraising, debt resolution, mortgage, solar, recruiting, and more, at the same flat price regardless of vertical."),
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
          { name: msg("Comparisons"), url: '/vs/everyone' },
          { name: msg("DialerSeat vs Orum"), url: '/vs/orum' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
