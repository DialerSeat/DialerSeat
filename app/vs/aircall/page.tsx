import type { Metadata } from 'next'
import VsAircallView from './view'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'

export const metadata: Metadata = {
  title: 'DialerSeat vs Aircall — The Power Dialer Isn\u2019t on the Basic Plan',
  description:
    'Aircall\u2019s advertised $30/seat Essentials plan doesn\u2019t include the Power Dialer, Salesforce integration, or call monitoring \u2014 all three require the $50/seat Professional tier, plus a 3-license minimum. DialerSeat includes every dialer mode at $35/seat/week.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/aircall',
  },
  openGraph: {
    title: 'DialerSeat vs Aircall',
    description:
      'The power dialer, included at $35/week per seat \u2014 not a $50/month Professional-tier unlock with a 3-license minimum.',
    url: 'https://dialerseat.com/vs/aircall',
    type: 'article',
  },
}

const FAQS = [
  {
    question: 'How does DialerSeat compare to Aircall on price?',
    answer:
      "DialerSeat is $35 per seat per week, billed weekly, with the dialer included from the first seat. Aircall's Essentials plan is advertised from $30/user/month, but doesn't include the Power Dialer, Salesforce integration, or live call monitoring \u2014 those require the Professional plan at $50/user/month, and every Aircall plan carries a 3-license minimum. Independently reported transaction data (Vendr) shows real mid-size team costs commonly landing between $2,500 and $4,000/month once add-ons are included.",
  },
  {
    question: 'Does Aircall\u2019s $30 plan include a power dialer?',
    answer:
      "No. Multiple independent sources, sourced from Aircall's own blog and pricing breakdowns, confirm the Power Dialer sits on the Professional tier ($50/user/month), not the Essentials entry plan ($30/user/month). One G2 reviewer described signing up specifically for the power dialer and finding the product \"unusable\" once they realized it wasn't included on the basic plan. DialerSeat includes predictive, power, progressive, and preview dialing in the one $35/week price, with no tier to unlock.",
  },
  {
    question: 'Why doesn\u2019t Aircall\u2019s own pricing page show dollar amounts?',
    answer:
      'Multiple independent pricing analyses report that Aircall\u2019s pricing page renders key figures as blank or "null" client-side, with the citable numbers instead coming from Aircall\u2019s own blog posts. DialerSeat publishes $35/week directly on its pricing page.',
  },
  {
    question: 'Does DialerSeat offer whitelabel like Aircall?',
    answer:
      'Yes \u2014 Manager+ is $75/month flat and includes full whitelabel, with no license minimum. We found no whitelabel or reseller program anywhere on Aircall\u2019s site. Aircall\u2019s Custom tier, typically requiring 25+ licenses, is quote-based rather than published.',
  },
  {
    question: 'Is Aircall\u2019s list price the real price?',
    answer:
      "Not necessarily. Vendr's transaction data, drawn from actual purchases, shows the median Aircall buyer negotiates roughly 23% off list price. That means comparing DialerSeat's published $35/week against Aircall's list price likely understates the real gap for buyers who don't negotiate, and makes Aircall's true cost harder to predict upfront than a flat, published rate.",
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
          { name: 'DialerSeat vs Aircall', url: '/vs/aircall' },
        ])}
      />
      <VsAircallView />
    </>
  )
}
