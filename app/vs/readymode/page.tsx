import type { Metadata } from 'next'
import VsReadyModeView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs ReadyMode — Modern Dialer for High-Volume Teams',
  description:
    'DialerSeat is the modern alternative to ReadyMode. Multi-line predictive, live coaching, AI transcription, CRM integrations — at flat $35/week. No $2K setup fee, no annual contract, works on every device.',
}

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'DialerSeat vs ReadyMode', url: '/vs/readymode' },
        ])}
      />
      <VsReadyModeView />
    </>
  )
}