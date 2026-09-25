import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import CampaignsFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'Setting Up a Campaign: Mode, AMD, and Predictive Pacing | DialerSeat',
  description:
    'What a DialerSeat campaign actually is: dialer mode selection, AMD toggle and defaults, the predictive lines-per-agent setting, and how leads and scripts attach to it.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/campaigns',
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
    title: 'Setting Up a Campaign: DialerSeat',
    description:
      'Mode, AMD, predictive pacing: the settings a campaign actually has, and what each one does.',
    url: 'https://dialerseat.com/faq/campaigns',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Setting Up a Campaign: DialerSeat',
    description: 'Mode, AMD, predictive pacing: the settings a campaign actually has, and what each one does.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function CampaignsFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Setting Up a Campaign"), url: '/faq/campaigns' },
      ])} />
      <CampaignsFaqView />
    </>
  )
}
