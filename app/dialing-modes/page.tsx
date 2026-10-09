import type { Metadata } from 'next'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import DialingModesView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

const baseMetadata: Metadata = {
  title: 'Dialing Modes: Preview, Power, Progressive, Predictive | DialerSeat',
  description:
    'How DialerSeat dials, and how we stay compliant doing it. Plain-English explanation of preview, power, progressive, and predictive dialing modes, the TCPA and FTC TSR safe harbor, and what our software enforces in code.',
  alternates: {
    canonical: 'https://dialerseat.com/dialing-modes',
  },
  openGraph: {
    title: 'Dialing Modes: Preview, Power, Progressive, Predictive',
    description:
      'Four dialing modes explained, with the TCPA and FTC TSR rules each one operates under. What DialerSeat enforces in software vs. what falls on the campaign owner.',
    url: 'https://dialerseat.com/dialing-modes',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialing Modes: Preview, Power, Progressive, Predictive',
    description: 'Four dialing modes explained, with the TCPA and FTC TSR rules each one operates under. What DialerSeat enforces in software vs. what falls on the campaign owner.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function DialingModesPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      {/* No FAQPage here: its answers were not on the page, which Google's
          FAQ markup rules forbid, and two of them had gone out of date. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Dialing Modes"), url: '/dialing-modes' },
        ])}
      />
      <DialingModesView />
    </>
  )
}