import type { Metadata } from 'next'
import BillingFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Billing & Cancellation — How Weekly Billing Actually Works | DialerSeat',
  description:
    'What actually happens when you cancel, when a payment fails, when you add or remove a seat mid-week, and how weekly billing through Stripe works in practice \u2014 not just the marketing line.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/billing',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Billing & Cancellation — DialerSeat',
    description:
      'Cancel and keep dialing through what you already paid for. What a failed payment actually does. How seats bill mid-week.',
    url: 'https://dialerseat.com/faq/billing',
    type: 'article',
  },
}

export default function BillingFaqPage() {
  return <BillingFaqView />
}
