import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import NumbersFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Phone Numbers & Caller ID: Avoiding Spam Likely | DialerSeat',
  description:
    'How DialerSeat handles outbound numbers: STIR/SHAKEN A-attestation, CNAM and Free Caller Registry registration, local presence dialing, and pool rotation \u2014 the real mechanics behind not getting flagged Spam Likely or Scam Likely.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/numbers',
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
    title: 'Phone Numbers & Caller ID: DialerSeat',
    description:
      'STIR/SHAKEN A-attestation, CNAM registration, local presence, and pool rotation \u2014 how DialerSeat keeps your outbound numbers from getting flagged.',
    url: 'https://dialerseat.com/faq/numbers',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phone Numbers & Caller ID: DialerSeat',
    description: 'STIR/SHAKEN A-attestation, CNAM registration, local presence, and pool rotation \u2014 how DialerSeat keeps your outbound numbers from getting flagged.',
  },
}

export default function NumbersFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'Phone Numbers & Caller ID', url: '/faq/numbers' },
      ])} />
      <NumbersFaqView />
    </>
  )
}
