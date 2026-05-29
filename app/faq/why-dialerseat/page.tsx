import type { Metadata } from 'next'
import WhyDialerSeatView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Why DialerSeat? — The Thesis, The Team, The Comparison | DialerSeat',
  description:
    'Why we built DialerSeat, who builds it, how we ship, and why we don\'t really see other dialers as competition. Plus the honest takedowns of ReadyMode, Mojo, and PhoneBurner.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/why-dialerseat',
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
    title: 'Why DialerSeat? — The Thesis',
    description:
      'Why we built it, who builds it, how we work, what makes us different from the entrenched names, and where we\'re going next.',
    url: 'https://dialerseat.com/faq/why-dialerseat',
    type: 'article',
  },
}

export default function WhyDialerSeatPage() {
  return <WhyDialerSeatView />
}