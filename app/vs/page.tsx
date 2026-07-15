import type { Metadata } from 'next'
import VsHubView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'









export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'DialerSeat Comparisons — vs ReadyMode, Mojo, PhoneBurner, Five9, WAVV, 3CX, and More',
  description:
    'Honest side-by-side comparisons of DialerSeat against every major outbound dialer and business phone system. Pricing, features, what each tool wins at, who should switch.',
  alternates: {
    canonical: 'https://dialerseat.com/vs',
  },
  openGraph: {
    title: 'DialerSeat Comparisons — Pick Your Competitor',
    description:
      'Side-by-side breakdowns vs ReadyMode, Mojo Dialer, PhoneBurner, Five9, WAVV, 3CX, and the wider industry. $35/week, weekly billing, modern UI.',
    url: 'https://dialerseat.com/vs',
    type: 'website',
  },
}

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
        ])}
      />
      <VsHubView />
    </>
  )
}