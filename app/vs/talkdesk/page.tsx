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

// Seat prices from Talkdesk's own pricing page, read 25 Sept 2026. The dialer
// sits in the Proactive Outbound Engagement add-on, which Talkdesk names on its
// own product page and does not price. This page was held back from the first
// batch for exactly that reason; it ships now saying the dialer price is not
// published, which is the finding rather than a gap.
const SLUG = 'talkdesk'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialerSeat vs Talkdesk: Pros, Cons and the Unpriced Dialer Add-On',
  description:
    'The pros and cons of Talkdesk against DialerSeat. Talkdesk publishes seats at $85 to $225 a user a month, but the outbound dialer is an add-on it does not price. DialerSeat is $35 a week per seat with every dialing mode included.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/talkdesk',
  },
  openGraph: {
    title: 'DialerSeat vs Talkdesk',
    description: 'An enterprise contact center that prices the seat but not the dialer, against a dialer billed a week at a time.',
    url: 'https://dialerseat.com/vs/talkdesk',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Talkdesk',
    description: 'An enterprise contact center that prices the seat but not the dialer, against a dialer billed a week at a time.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does Talkdesk cost?"),
    answer:
      msg("Talkdesk publishes four seat prices: Digital Essentials at $85 per user per month, Voice Essentials at $105, Elite at $165 and Industry Experience Clouds at $225. Those are the seats. The outbound dialer is part of the Proactive Outbound Engagement add-on, and its price is not published."),
  },
  {
    question: msg("Does Talkdesk include a predictive dialer?"),
    answer:
      msg("Not in the seat price. Talkdesk Dialer, which covers preview and predictive dialing, is sold inside the Proactive Outbound Engagement add-on. You will need a quote to know what outbound actually costs."),
  },
  {
    question: msg("Is Talkdesk or DialerSeat cheaper for an outbound team?"),
    answer:
      msg("DialerSeat, and by enough that the add-on price does not change the answer. Five DialerSeat seats are $175 a week, about $758 a month, with all four dialing modes included. Five Talkdesk Voice Essentials seats are $525 a month before the dialer add-on is priced at all."),
  },
  {
    question: msg("When is Talkdesk the right choice?"),
    answer:
      'When you are running a contact center rather than a dialing floor: inbound queues across several channels, workforce management, quality management and industry compliance tooling. DialerSeat does none of that. It dials.',
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
          { name: msg("DialerSeat vs Talkdesk"), url: '/vs/talkdesk' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
