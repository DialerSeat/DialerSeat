import type { Metadata } from 'next'
import VsJustcallView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs JustCall — The Dialer Isn\u2019t a Pro-Tier Upsell',
  description:
    'JustCall advertises $29/user/month, but the power and predictive dialer sit behind the $49+/month Pro tier, with a 2-seat minimum on every standard plan. DialerSeat includes every dialer mode at $35/seat/week, billed weekly, one seat minimum.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/justcall',
  },
  openGraph: {
    title: 'DialerSeat vs JustCall',
    description:
      'Predictive and power dialing included at $35/week per seat \u2014 not gated behind a Pro-tier upgrade or a 2-seat minimum.',
    url: 'https://dialerseat.com/vs/justcall',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to JustCall on price?',
    answer:
      "DialerSeat is $35 per seat per week, billed weekly, one seat minimum. JustCall's Team plan is genuinely $29/user/month, but every standard plan (Team through Pro Plus) carries a 2-seat minimum, putting the real floor closer to $58/month. The power and predictive dialer aren't included until the Pro tier, $49/user/month and up.",
  },
  {
    question: 'Does JustCall\u2019s $29 plan include the sales dialer?',
    answer:
      "No. JustCall's entry Team plan covers unlimited calling, SMS, and CRM integrations, but the power dialer and predictive dialer require the Pro tier ($49/user/month) or higher. JustCall also runs its Sales Dialer as a separate mobile app from its general calling app \u2014 their own help center notes the two apps aren't interchangeable. DialerSeat includes all dialer modes in one app at $35/week per seat.",
  },
  {
    question: 'Does DialerSeat offer whitelabel like JustCall?',
    answer:
      'Yes \u2014 Manager+ is $75/month flat and includes full whitelabel, with no seat minimum. We found no whitelabel or reseller program anywhere on JustCall\u2019s site. JustCall\u2019s Business tier, which includes HIPAA compliance, requires a 10-seat minimum.',
  },
  {
    question: 'Does DialerSeat work on mobile like JustCall?',
    answer:
      'Yes, and it\u2019s one app for the full dialer experience. JustCall does have real, well-built iOS and Android apps, but runs the Sales Dialer as a separate app from its general JustCall calling app \u2014 reps need to know which one to use for which task. DialerSeat installs as a single Progressive Web App with the same dialer modes as desktop.',
  },
  {
    question: 'Is JustCall\u2019s unlimited calling really unlimited?',
    answer:
      "JustCall's plans advertise unlimited calling and AI transcription, but these are subject to an unpublished Fair Usage Policy. High-volume dialing patterns, the kind a power or predictive dialer produces, can trigger per-minute overage billing faster than normal call patterns. DialerSeat's $35/week covers your calling with no separate usage policy to account for.",
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
          { name: 'DialerSeat vs JustCall', url: '/vs/justcall' },
        ])}
      />
      <VsJustcallView />
    </>
  )
}
