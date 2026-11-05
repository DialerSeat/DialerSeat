import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import MobileFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'DialerSeat on Mobile: Install the PWA | DialerSeat',
  description:
    'DialerSeat runs as a full Progressive Web App on your phone: the same terminal, analytics, and teams tools as desktop, installed to your home screen in under a minute. Step-by-step install instructions for iPhone and Android, what the rest of the category publishes about mobile in its own requirements, and what is honestly worse on a handset.',
  keywords: [
    'dialer app for iphone',
    'mobile predictive dialer',
    'can you run a dialer from your phone',
    'call center software on mobile',
    'dial leads from phone',
    'power dialer android',
  ],
  alternates: {
    canonical: 'https://dialerseat.com/faq/mobile',
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
    title: 'DialerSeat on Mobile: Install the PWA',
    description:
      'The full dialer terminal and analytics dashboard, installed to your home screen. No App Store, no separate app to keep updated.',
    url: 'https://dialerseat.com/faq/mobile',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat on Mobile: Install the PWA',
    description: 'The full dialer terminal and analytics dashboard, installed to your home screen. No App Store, no separate app to keep updated.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function MobileFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("DialerSeat on Mobile"), url: '/faq/mobile' },
      ])} />
      <MobileFaqView />
    </>
  )
}
