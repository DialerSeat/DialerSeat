import type { Metadata } from 'next'
import DataRecordingsFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Recordings & Your Data — Export, Delete, Retention | DialerSeat',
  description:
    'How call recordings work day to day, plus the full-account JSON export and permanent account deletion tools \u2014 what\u2019s actually included in each, and how account deletion is protected against accidental use.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/data-and-recordings',
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
    title: 'Recordings & Your Data — DialerSeat',
    description:
      'Play, download, and delete recordings on your own schedule. Export everything in your account as JSON. Delete your account for real, with a dry run first.',
    url: 'https://dialerseat.com/faq/data-and-recordings',
    type: 'article',
  },
}

export default function DataRecordingsFaqPage() {
  return <DataRecordingsFaqView />
}
