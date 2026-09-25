import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import ManagerPlusFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'Manager+: DialerSeat\u2019s Team & White-Label Tier | DialerSeat',
  description:
    'What Manager+ actually is: $75/week, replaces Pro, unlocks team ownership and full white-labeling. How seats stack, owner-pays vs. agent-pays, real examples for lead vendors and agency owners, advanced analytics, and priority support, with real product screenshots.',
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
    title: 'Manager+: The Tier Above Pro',
    description:
      '$75/week. Team ownership, full white-labeling, advanced analytics, and priority support. See it running on desktop and as a mobile PWA.',
    url: 'https://dialerseat.com/faq/manager-plus',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manager+: The Tier Above Pro',
    description: '$75/week. Team ownership, full white-labeling, advanced analytics, and priority support. See it running on desktop and as a mobile PWA.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function ManagerPlusFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: 'Manager+', url: '/faq/manager-plus' },
      ])} />
      <ManagerPlusFaqView />
    </>
  )
}
