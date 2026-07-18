import type { Metadata } from 'next'
import WhiteLabelMobileFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'White-Label on Mobile — How the PWA Works | DialerSeat',
  description:
    'How DialerSeat\u2019s white-label branding carries onto mobile through a Progressive Web App (PWA) \u2014 your logo, your colors, your theme, installed to the home screen with no App Store approval needed. Real side-by-side screenshots of two different white-label themes on the same codebase.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/white-label-mobile',
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
    title: 'White-Label on Mobile — DialerSeat',
    description:
      'Your branded dialer, installed to the home screen like a native app \u2014 no App Store review, no native app store fees, no separate codebase to maintain.',
    url: 'https://dialerseat.com/faq/white-label-mobile',
    type: 'article',
  },
}

export default function WhiteLabelMobileFaqPage() {
  return <WhiteLabelMobileFaqView />
}
