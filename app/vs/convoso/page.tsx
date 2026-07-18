import type { Metadata } from 'next'
import VsConvosoView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Convoso — Same Dialer Modes, No Seat Minimum',
  description:
    'Convoso is a strong predictive dialer built for 20+ seat operations with custom, usage-billed quotes. DialerSeat matches predictive, power, progressive, and preview dialing at $35/seat/week, billed weekly, no seat minimum, no demo required.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/convoso',
  },
  openGraph: {
    title: 'DialerSeat vs Convoso',
    description:
      'The same four dialer modes at a published $35/week per seat — no 20-seat minimum, no custom quote, no carrier fees billed separately.',
    url: 'https://dialerseat.com/vs/convoso',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to Convoso on price?',
    answer:
      "DialerSeat is $35 per seat per week, billed weekly, published on the homepage. Convoso doesn't publish pricing \u2014 third-party sources consistently cite roughly $90/user/month as a floor, not a ceiling, since carrier fees and DID number management are billed separately from the base subscription. Convoso also typically requires a ~20-seat minimum and runs on annual contracts.",
  },
  {
    question: 'Does Convoso have the same dialer modes as DialerSeat?',
    answer:
      "Yes, structurally \u2014 Convoso offers predictive, power, progressive, and preview dialing, the same four modes DialerSeat includes. The difference is access and pricing: Convoso gates this behind a custom quote and a seat minimum typically around 20 agents, with free trials usually restricted to 40+ seats. DialerSeat includes all four modes at $35/week per seat with no minimum.",
  },
  {
    question: 'Is Convoso\u2019s answering machine detection better than DialerSeat\u2019s?',
    answer:
      "Convoso advertises 97% AMD accuracy; this is a vendor claim we could not independently verify. DialerSeat runs AMD voicemail filtering on every call as a standard feature, included at no extra cost.",
  },
  {
    question: 'Does DialerSeat offer whitelabel like Convoso?',
    answer:
      'Yes \u2014 Manager+ is $75/month flat and includes full whitelabel, with no seat minimum to access it. Convoso does offer real admin/agent permission management through its Admin Portal, but we found no whitelabel or reseller program anywhere on their site; their partner integrations page routes to a quote request, not a rebranding option.',
  },
  {
    question: 'Does DialerSeat work on mobile like Convoso?',
    answer:
      "Yes \u2014 the full dialer experience, not a companion app. DialerSeat installs as a Progressive Web App on iPhone, iPad, Android, macOS, and Windows with the same dialer modes as desktop. We found no native mobile app for Convoso; some reviewers report functionality issues using the platform on iOS devices.",
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs Convoso', url: '/vs/convoso' },
        ])}
      />
      <VsConvosoView />
    </>
  )
}
