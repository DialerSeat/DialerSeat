import type { Metadata } from 'next'
import DialerSeatTeamsFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'DialerSeat Teams — Aged Leads, Agency Floors, Shared Pools | DialerSeat',
  description:
    'The complete guide to DialerSeat Teams. How aged-lead vendors rent seat access instead of selling CSVs, how agency owners run multi-rep floors with per-rep attribution, and how shared lead pools work across multiple dialers without collisions.',
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
      'How lead vendors monetize aged leads, agency owners run their producer floors, and shared pools dial the same list without stepping on each other. Plus all four billing modes including FREE.',
    url: 'https://dialerseat.com/faq/dialerseat-teams',
    type: 'article',
  },
}

export default function DialerSeatTeamsFaqPage() {
  return <DialerSeatTeamsFaqView />
}