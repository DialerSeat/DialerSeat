import type { Metadata } from 'next'
import VsMojoView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Mojo Dialer — Modern Dialer for Every Industry',
  description:
    'DialerSeat is the modern alternative to Mojo Dialer. Multi-line predictive, AI transcription, full CRM integrations — at flat $35/week. No $25–$49 add-ons, no real-estate-only lock-in, every industry welcome.',
}

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'DialerSeat vs Mojo Dialer', url: '/vs/mojo' },
        ])}
      />
      <VsMojoView />
    </>
  )
}