import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import View from './view'

export const metadata: Metadata = {
  title: 'For Managers: Agency Owners & Lead Vendors | DialerSeat',
  description:
    'Run a sales floor or sell leads? DialerSeat is built for you. Create teams on Manager+ ($75/week), upload your leads, set your own prices for agents. $35/week per agent seat. No contracts.',
  alternates: { canonical: 'https://dialerseat.com/faq/managers' },
  openGraph: {
    title: 'For Managers: DialerSeat',
    description:
      'For agency owners and lead vendors. Resell seats at your price. Keep your margins. One view across every agent.',
    url: 'https://dialerseat.com/faq/managers',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'For Managers: DialerSeat',
    description: 'For agency owners and lead vendors. Resell seats at your price. Keep your margins. One view across every agent.',
  },
}

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'For Managers', url: '/faq/managers' },
      ])} />
      <View />
    </>
  )
}