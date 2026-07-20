import type { Metadata } from 'next'
import CampaignsFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Setting Up a Campaign — Mode, AMD, Voicemail Drop | DialerSeat',
  description:
    'What a DialerSeat campaign actually is: dialer mode selection, AMD toggle and defaults, the predictive lines-per-agent setting, voicemail drop, and how leads and scripts attach to it.',
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
    title: 'Setting Up a Campaign — DialerSeat',
    description:
      'Mode, AMD, predictive pacing, voicemail drop — the settings a campaign actually has, and what each one does.',
    url: 'https://dialerseat.com/faq/campaigns',
    type: 'article',
  },
}

export default function CampaignsFaqPage() {
  return <CampaignsFaqView />
}
