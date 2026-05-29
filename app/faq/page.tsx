import type { Metadata } from 'next'
import FaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | DialerSeat',
  description:
    'Answers to the questions buyers actually ask about DialerSeat — pricing, contracts, dialing modes, TCPA compliance, team setup, white-label, data hosting, and more.',
  alternates: {
    canonical: 'https://dialerseat.com/faq',
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
    title: 'Frequently Asked Questions — DialerSeat',
    description:
      'Pricing, contracts, compliance, team setup, and the bigger question of why we built DialerSeat in the first place.',
    url: 'https://dialerseat.com/faq',
    type: 'website',
  },
}

export default function FaqPage() {
  return <FaqView />
}