import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

// The slug drops the dot. A literal /vs/dialer.io puts what looks like a file
// extension at the end of a route segment, which is the one shape static
// hosts, crawlers and redirect rules all treat as an asset rather than a page.
// The brand keeps its dot everywhere it is READ — title, headline, rail — and
// loses it only in the URL.
const SLUG = 'dialer-io'

export const metadata: Metadata = {
  title: 'DialerSeat vs Dialer.io: Published Pricing, No Three-Month Commitment',
  description:
    "Dialer.io quotes case by case and asks for an initial three-month commitment. DialerSeat publishes $35 per seat per week, bills weekly, and includes predictive and multi-line dialing that Dialer.io does not claim.",
  alternates: {
    canonical: 'https://dialerseat.com/vs/dialer-io',
  },
  openGraph: {
    title: 'DialerSeat vs Dialer.io',
    description:
      'A quoted three-month commitment against a published weekly price, and four dialer modes against three.',
    url: 'https://dialerseat.com/vs/dialer-io',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Dialer.io',
    description:
      'A quoted three-month commitment against a published weekly price, and four dialer modes against three.',
  },
}

// ── ANSWERED FROM DIALER.IO'S OWN FAQ ────────────────────────────────────
// These render as FAQ structured data, which is quoted directly into search
// results, so every claim about another company here is one they publish
// themselves. Where they publish nothing, the answer says so.
const FAQS = [
  {
    question: 'What does Dialer.io cost?',
    answer:
      'Dialer.io does not publish a price. Their site states that pricing is tailored on a case-by-case basis with no hidden charges, and the "See Pricing" link goes to a contact form, so the number arrives after you share your team size, dialing volume and current tools. DialerSeat publishes $35 per seat per week on the homepage: one seat for three months is $455, and you can stop after the first week.',
  },
  {
    question: 'Does Dialer.io require a contract?',
    answer:
      'Their FAQ states an initial three-month commitment, after which you can continue month to month. That is the part worth pricing: three months is roughly thirteen weeks, so you are committing to thirteen weeks of a rate you have not been able to compare against anyone else, before you know whether the tool works on your list. DialerSeat bills weekly with no contract and no minimum term. The smallest thing you can buy is one week at $35, and the same thirteen weeks is $455 per seat if you keep going.',
  },
  {
    question: 'What does a five-agent floor cost on each?',
    answer:
      'On DialerSeat, $175 per week in seats at $35 each, plus $75 per week for the Manager+ owner who holds the team. Over the thirteen weeks Dialer.io asks you to commit to, that is $2,275 in seats. Dialer.io does not publish a five-seat number: it arrives after a sales call, and it commits you for three months.',
  },
  {
    question: 'Which dialing modes does Dialer.io support?',
    answer:
      'Their FAQ names preview dialing as the core mode, with power and progressive also offered. Predictive and multi-line dialing are not claimed anywhere in their published material. DialerSeat includes preview, power, progressive and predictive at the base price, selectable per campaign.',
  },
  {
    question: 'What is Dialer.io genuinely better at?',
    answer:
      'Speed to lead and number health. Dialer.io queues a new lead for dialing the moment it arrives and runs cadences with cooldowns on the follow-ups, and their number-management system monitors caller-ID health, cools down flagged numbers and rotates them back in. They also sync natively with GoHighLevel and HubSpot, and enforce calling windows in Australia as well as the United States.',
  },
  {
    question: 'Who should pick DialerSeat instead?',
    answer:
      'Teams that want a published price, no commitment, and multi-line predictive dialing for working a list at volume. If your leads arrive from forms in GoHighLevel or HubSpot and speed to first dial is the whole game, Dialer.io is built for exactly that and is the more direct fit.',
  },
]

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs Dialer.io', url: '/vs/dialer-io' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
