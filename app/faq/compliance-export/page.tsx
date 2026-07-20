import type { Metadata } from 'next'
import ComplianceExportFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Compliance Export — Proving It, Not Just Claiming It | DialerSeat',
  description:
    'How to pull a per-campaign compliance record from DialerSeat: AMD results, abandon flags, dispositions, and call duration by date range, with phone-number redaction on by default \u2014 the actual export tool behind the compliance claims.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/compliance-export',
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
    title: 'Compliance Export — DialerSeat',
    description:
      'Per-campaign, per-date-range export of AMD results, abandon flags, and dispositions \u2014 redacted by default. The receipts behind the compliance claims.',
    url: 'https://dialerseat.com/faq/compliance-export',
    type: 'article',
  },
}

export default function ComplianceExportFaqPage() {
  return <ComplianceExportFaqView />
}
