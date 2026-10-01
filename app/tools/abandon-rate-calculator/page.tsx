import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import CiteThis from '@/components/CiteThis'
import AbandonRateCalculator from '@/components/tools/AbandonRateCalculator'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /tools/abandon-rate-calculator
// =============================================================================
// SEARCH INTENT: "abandon rate calculator", "call abandonment rate formula",
// "3% abandon rate rule", "predictive dialer abandon rate". Compliance
// managers and call-center trainers search this, and it is the calculator a
// training deck or a compliance blog links to. Embeddable at
// /embed/abandon-rate-calculator.
//
// The limits and definitions match lib/countryRules and the sources there.
// =============================================================================

const ROUTE = '/tools/abandon-rate-calculator'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'Abandon Rate Calculator: The 3% Rule for Predictive Dialers | DialerSeat',
  description:
    'Check a predictive campaign against the US 3% (FTC TSR), UK 3% (Ofcom) and Canada 5% (CRTC) abandoned-call limits. Enter answered and abandoned calls, get the rate and how many more calls you can abandon.',
  keywords: [
    'abandon rate calculator', 'call abandonment rate', 'abandoned call rate formula', '3% abandon rate rule',
    'predictive dialer abandon rate', 'ftc abandoned call rule', 'ofcom abandoned call rate',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Abandon rate calculator',
    description: 'Is your predictive campaign inside the US, UK or Canadian abandoned-call limit?',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Abandon rate calculator',
    description: 'Is your predictive campaign inside the US, UK or Canadian abandoned-call limit?',
  },
}

const FAQS = [
  {
    question: 'How do you calculate the abandon rate?',
    answer:
      'Divide abandoned calls by calls answered by a person, then multiply by 100. Use answered calls, not dials: dividing by dials makes the rate look lower than the regulator will measure it.',
  },
  {
    question: 'What is the legal abandon rate for a predictive dialer?',
    answer:
      'In the US, no more than 3% of calls answered by a person, per campaign, over each 30-day period (FTC Telemarketing Sales Rule). In the UK, no more than 3% of live calls per campaign per 24 hours (Ofcom). In Canada, no more than 5% per calendar month (CRTC).',
  },
  {
    question: 'What counts as an abandoned call?',
    answer:
      'In the US and Canada, a call is abandoned when a person answers and no live agent is connected within 2 seconds. In the US, every abandoned call must also play a recorded message with the seller’s name and phone number.',
  },
]

export default function AbandonRateCalculatorPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Abandon rate calculator', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Abandon rate calculator',
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
            <div className="guts-eyebrow">▸ TOOL · ABANDON RATE CALCULATOR</div>
            <h1>
              Is your campaign
              <span className="second">inside the 3% rule?</span>
            </h1>
            <p>
              Enter answered and abandoned calls and pick the rule you dial under. You get the rate, whether
              it is inside the limit, and how many more calls you could abandon before crossing it.
            </p>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="shield">
          <AbandonRateCalculator />
        </GutsSection>

        <GutsSection icon="chat" title="The rules behind it">
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.question}</h3>
                <p style={{ margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </div>
          <p>
            DialerSeat holds every predictive campaign under the US limit automatically and drops to one
            line per agent before it is reached.
          </p>
          <div className="guts-btns">
            <Link href="/faq/is-a-predictive-dialer-legal" className="guts-btn secondary">IS A PREDICTIVE DIALER LEGAL?</Link>
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">RULES BY COUNTRY</Link>
          </div>
          <CiteThis title="Abandon rate calculator" path={ROUTE} embedPath="/embed/abandon-rate-calculator" embedHeight={460} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
