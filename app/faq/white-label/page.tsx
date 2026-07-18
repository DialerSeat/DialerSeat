import type { Metadata } from 'next'
import View from './view'

export const metadata: Metadata = {
  title: 'White-Label Your Dialer — Your Brand, Your Domain | DialerSeat',
  description:
    'Run DialerSeat as your own product. Your logo, your colors, your custom domain. Your agents never see DialerSeat. $75/week, all-inclusive.',
  alternates: { canonical: 'https://dialerseat.com/faq/white-label' },
  openGraph: {
    title: 'White-Label DialerSeat',
    description:
      'Your brand. Your domain. Your dialer. $75/week, no setup fees, no contracts.',
    url: 'https://dialerseat.com/faq/white-label',
    type: 'article',
  },
}

export default function Page() {
  return <View />
}