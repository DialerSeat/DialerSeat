import type { Metadata } from 'next'
import ManagerPlusFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Manager+ — DialerSeat\u2019s Team & White-Label Tier | DialerSeat',
  description:
    'What Manager+ actually is: $75/week, replaces Pro, unlocks team ownership and full white-labeling. How seats stack, owner-pays vs. agent-pays, real examples for lead vendors and agency owners, advanced analytics, and priority support — with real product screenshots.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/manager-plus',
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
    title: 'Manager+ — The Tier Above Pro',
    description:
      '$75/week. Team ownership, full white-labeling, advanced analytics, and priority support. See it running on desktop and as a mobile PWA.',
    url: 'https://dialerseat.com/faq/manager-plus',
    type: 'article',
  },
}

export default function ManagerPlusFaqPage() {
  return <ManagerPlusFaqView />
}
