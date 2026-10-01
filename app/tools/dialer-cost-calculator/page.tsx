import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import CiteThis from '@/components/CiteThis'
import DialerCostCalculator from '@/components/tools/DialerCostCalculator'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /tools/dialer-cost-calculator
// =============================================================================
// SEARCH INTENT: "dialer cost calculator", "auto dialer cost", "how much does
// a dialer cost per month", "call center software cost calculator". A working
// tool is the most linkable thing a vendor site can publish: trainers, agency
// blogs and forum answers link to a calculator where they would never link to
// a product page. /embed/dialer-cost-calculator lets them put it on their own
// page, with a credit link back here.
// =============================================================================

const ROUTE = '/tools/dialer-cost-calculator'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'Dialer Cost Calculator: Weekly vs Monthly Billing, Any Team Size | DialerSeat',
  description:
    'Enter how many weeks you need a dialer and how many agents. See what DialerSeat, ReadyMode, PhoneBurner, Mojo, BatchDialer, WAVV, Kixie and Orum would bill, with seat minimums and annual terms applied.',
  keywords: [
    'dialer cost calculator', 'auto dialer cost', 'predictive dialer cost', 'call center software cost',
    'dialer pricing calculator', 'cost per seat dialer',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Dialer cost calculator',
    description: 'What each dialer bills for the weeks and agents you actually need.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer cost calculator',
    description: 'What each dialer bills for the weeks and agents you actually need.',
  },
}

const FAQS = [
  {
    question: 'How is the cost worked out?',
    answer:
      'DialerSeat is $35 per seat per week, multiplied by weeks and seats. A monthly-billed dialer is charged for every month the weeks touch, so five weeks is two months. An annually billed dialer is charged at least twelve months. Seat minimums are applied, so two agents on a three-seat minimum are billed as three.',
  },
  {
    question: 'Which prices does it use?',
    answer:
      'Each vendor’s lowest published price that includes multi-line or predictive dialing, before setup fees, add-ons and usage. Vendors that sell only by quote are shown as quoted.',
  },
  {
    question: 'When is a monthly dialer cheaper?',
    answer:
      'For one seat over a full month, a dialer published at under $140 a month costs less than four weeks of DialerSeat. Weekly billing wins for short projects, seasonal hires, trial runs and floors whose headcount changes week to week.',
  },
]

export default function DialerCostCalculatorPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Dialer cost calculator', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Dialer cost calculator',
          url: `https://dialerseat.com${ROUTE}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          dateModified: UPDATED,
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ TOOL · DIALER COST CALCULATOR</div>
            <h1>
              What will a dialer
              <span className="second">actually cost you?</span>
            </h1>
            <p>
              Set the weeks you need and the agents you have. Monthly and annual billing, seat minimums
              and the vendors’ own published prices are applied, so the number is what you would be billed.
            </p>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="scale">
          <DialerCostCalculator />
        </GutsSection>

        <GutsSection icon="chat" title="How it works">
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.question}</h3>
                <p style={{ margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </div>
          <div className="guts-btns">
            <Link href="/data/dialer-pricing" className="guts-btn secondary">EVERY DIALER’S PRICING</Link>
            <Link href="/pricing" className="guts-btn secondary">DIALERSEAT PRICING</Link>
          </div>
          <CiteThis title="Dialer cost calculator" path={ROUTE} embedPath="/embed/dialer-cost-calculator" embedHeight={760} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
