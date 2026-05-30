import type { Metadata } from 'next'
import View from './view'

export const metadata: Metadata = {
  title: 'For Managers — Agency Owners & Lead Vendors | DialerSeat',
  description:
    'Run a sales floor or sell leads? DialerSeat is built for you. Create teams, upload your leads, set your own prices for agents. $35/week per seat. No contracts.',
  alternates: { canonical: 'https://dialerseat.com/managers' },
  openGraph: {
    title: 'For Managers — DialerSeat',
    description:
      'For agency owners and lead vendors. Resell seats at your price. Keep your margins. One view across every agent.',
    url: 'https://dialerseat.com/managers',
    type: 'article',
  },
}

export default function Page() {
  return <View />
}