import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import DataRecordingsFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'Recordings & Your Data: Export, Delete, Retention | DialerSeat',
  description:
    'How call recordings work day to day, plus the full-account JSON export and permanent account deletion tools: what\u2019s actually included in each, and how account deletion is protected against accidental use.',
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
    title: 'Recordings & Your Data: DialerSeat',
    description:
      'Play, download, and delete recordings on your own schedule. Export everything in your account as JSON. Delete your account for real, with a dry run first.',
    url: 'https://dialerseat.com/faq/data-and-recordings',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Recordings & Your Data: DialerSeat',
    description: 'Play, download, and delete recordings on your own schedule. Export everything in your account as JSON. Delete your account for real, with a dry run first.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function DataRecordingsFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Recordings & Your Data"), url: '/faq/data-and-recordings' },
      ])} />
      <DataRecordingsFaqView />
    </>
  )
}
