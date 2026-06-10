import type { Metadata } from 'next'
import DialerSeatTeamsFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'DialerSeat Teams — Sell Seats to Your Premium Lead Campaigns | DialerSeat',
  description:
    'The complete guide to DialerSeat Teams. How lead vendors rent seat-based dialer access to their premium campaigns instead of selling CSVs, how agency owners run multi-rep floors with per-rep attribution, and how shared lead pools work across multiple dialers without collisions.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/dialerseat-teams',
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
    title: 'DialerSeat Teams — The Deep Dive',
    description:
      'How lead vendors monetize their premium campaigns through seat-based access, agency owners run producer floors with full attribution, and shared pools dial the same list without stepping on each other. Plus all four billing modes including FREE.',
    url: 'https://dialerseat.com/faq/dialerseat-teams',
    type: 'article',
  },
}

export default function DialerSeatTeamsFaqPage() {
  return <DialerSeatTeamsFaqView />
}