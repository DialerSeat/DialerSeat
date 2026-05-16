import type { Metadata } from 'next'
import VsPhoneBurnerView from './view'

export const metadata: Metadata = {
  title: 'DialerSeat vs PhoneBurner — Multi-Line Dialer Without the Add-Ons',
  description:
    'DialerSeat is the modern alternative to PhoneBurner. Multi-line predictive (not single-line only), spam protection included (not a $35/seat add-on), flat $140 monthly billing — not annual contracts.',
}

export default function Page() {
  return <VsPhoneBurnerView />
}