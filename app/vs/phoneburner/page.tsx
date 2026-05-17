import type { Metadata } from 'next'
import VsPhoneBurnerView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs PhoneBurner — Multi-Line Dialer Without the Add-Ons',
  description:
    'DialerSeat is the modern alternative to PhoneBurner. Multi-line predictive (not single-line only), spam protection included (not a $35/seat add-on), flat $35/week — not annual contracts.',
}

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'DialerSeat vs PhoneBurner', url: '/vs/phoneburner' },
        ])}
      />
      <VsPhoneBurnerView />
    </>
  )
}