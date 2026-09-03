import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import MobileFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'DialerSeat on Mobile: Install the PWA | DialerSeat',
  description:
    'DialerSeat runs as a full Progressive Web App on your phone \u2014 the same terminal, analytics, and teams tools as desktop, installed to your home screen in under a minute. Step-by-step install instructions for iPhone and Android, and why it\u2019s worth doing before you dial.',
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

export default function MobileFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'DialerSeat on Mobile', url: '/faq/mobile' },
      ])} />
      <MobileFaqView />
    </>
  )
}
