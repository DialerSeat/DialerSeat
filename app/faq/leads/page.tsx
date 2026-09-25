import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import LeadsFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'Uploading & Managing Leads: CSV Format, Fields, Retries | DialerSeat',
  description:
    'How to get leads into a DialerSeat campaign: accepted file formats, which column headers get auto-detected, optional consent fields, what happens to bad rows, and how the 3-attempt retry cycle actually works.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/leads',
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
    title: 'Uploading & Managing Leads: DialerSeat',
    description:
      'Column auto-detection, consent fields, retry logic, and what happens to leads that fail to import, the real mechanics of getting a list into a campaign.',
    url: 'https://dialerseat.com/faq/leads',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Uploading & Managing Leads: DialerSeat',
    description: 'Column auto-detection, consent fields, retry logic, and what happens to leads that fail to import, the real mechanics of getting a list into a campaign.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function LeadsFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Uploading & Managing Leads"), url: '/faq/leads' },
      ])} />
      <LeadsFaqView />
    </>
  )
}
