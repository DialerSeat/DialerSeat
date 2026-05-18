import type { Metadata } from 'next'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
  DIALING_MODES_FAQS,
} from '@/lib/schema'
import DialingModesView from './view'

export const metadata: Metadata = {
  title: 'Dialing Modes — Preview, Power, Progressive, Predictive | DialerSeat',
  description:
    'How DialerSeat dials — and how we stay compliant doing it. Plain-English explanation of preview, power, progressive, and predictive dialing modes, the TCPA and FTC TSR safe harbor, and what our software enforces in code.',
  alternates: {
    canonical: 'https://dialerseat.com/dialing-modes',
  },
  openGraph: {
    title: 'Dialing Modes — Preview, Power, Progressive, Predictive',
    description:
      'Four dialing modes explained, with the TCPA and FTC TSR rules each one operates under. What DialerSeat enforces in software vs. what falls on the campaign owner.',
    url: 'https://dialerseat.com/dialing-modes',
    type: 'article',
  },
}

export default function DialingModesPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(DIALING_MODES_FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Dialing Modes', url: '/dialing-modes' },
        ])}
      />
      <DialingModesView />
    </>
  )
}