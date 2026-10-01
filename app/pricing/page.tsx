import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import DialerCostCalculator from '@/components/tools/DialerCostCalculator'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'
import { DIALERSEAT } from '@/lib/competitors'
import { BILLED_DIALERS, DIALERSEAT_WEEKLY, billedCost } from '@/lib/weeklyBilling'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /pricing
// =============================================================================
// SEARCH INTENT: "dialer pricing", "predictive dialer pricing" (+90% over the
// last year), "auto dialer cost", "cheap predictive dialer", "no contract
// dialer". The site answered all of these on the homepage and in a dozen /vs
// pages, and had no page whose job was the price. /pricing returned 404.
//
// THE ONE POINT IT MAKES: DialerSeat bills by the week and every multi-line
// dialer we compare against bills by the month or the year, so a week
// elsewhere costs a full month. It is made with the vendors' own published
// figures (lib/weeklyBilling), never an estimate.
//
// canonicalFacts forbids a monthly figure for DialerSeat. This page never
// states one: our side is priced in weeks, including the four-week column.
// =============================================================================

const ROUTE = '/pricing'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'Dialer Pricing: $35 a Week per Seat, No Contract | DialerSeat',
  description:
    'DialerSeat costs $35 per seat per week with every dialer mode included. Billed weekly, so one week costs $35. A week of ReadyMode costs $199 and a week of Mojo Dialer $149, because they bill by the month.',
  keywords: [
    'dialer pricing', 'predictive dialer pricing', 'auto dialer cost', 'power dialer pricing',
    'cheap predictive dialer', 'no contract dialer', 'weekly dialer', 'dialer cost per seat',
  ],
  alternates: {
    canonical: `https://dialerseat.com${ROUTE}`,
    types: { 'text/markdown': `https://dialerseat.com/md${ROUTE}` },
  },
  openGraph: {
    title: 'Dialer pricing: one week costs $35, not a month',
    description: 'Every dialer mode for $35 per seat per week. Monthly dialers bill a full month even for one week.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer pricing: one week costs $35, not a month',
    description: 'Every dialer mode for $35 per seat per week. Monthly dialers bill a full month even for one week.',
  },
}

const FAQS = [
  {
    question: 'How much does DialerSeat cost?',
    answer:
      'DialerSeat Pro is $35 per seat per week, billed weekly, with all four dialer modes (preview, power, progressive and predictive) included. Manager+ is $75 per week and adds team ownership, white-labeling and lead drip. There is no contract, no setup fee and no seat minimum.',
  },
  {
    question: 'Why does one week of another dialer cost a full month?',
    answer:
      'Because they bill by the month or the year. The shortest term you can buy from ReadyMode, PhoneBurner, Mojo Dialer, WAVV, BatchDialer or Kixie is one month, $95 to $199 or more per seat depending on the vendor, so a one-week project, a seasonal hire or a trial run still pays for the month. DialerSeat bills by the week, so one week costs $35 and four weeks cost $140.',
  },
  {
    question: 'Is calling included, or is there a per-minute charge?',
    answer:
      'Calling is included in the seat price. There is no per-minute charge and no credit balance to top up, and unlimited phone numbers with local presence are included.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'No. Billing starts the day you sign up. Because billing is weekly and you can cancel any week, the most a trial run can cost is one week, $35 per seat.',
  },
  {
    question: 'Can I cancel any time?',
    answer:
      'Yes. Cancel any week from Settings. Access runs to the end of the week you paid for, and your leads, recordings and history are kept if the subscription lapses.',
  },
  {
    question: 'What does a five-agent team cost?',
    answer: `${DIALERSEAT.team.fiveSeats} Each agent gets their own login, dialer and call data.`,
  },
]

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Pricing', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `https://dialerseat.com${ROUTE}#page`,
          url: `https://dialerseat.com${ROUTE}`,
          name: 'DialerSeat pricing',
          dateModified: UPDATED,
          about: { '@id': 'https://dialerseat.com/#software' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ PRICING</div>
            <h1>
              One week costs $35.
              <span className="second">Not a month.</span>
            </h1>
            <p>
              DialerSeat is $35 per seat per week with every dialer mode included, billed weekly with no
              contract. The multi-line dialers we compare against bill by the month or the year, so a week
              with them costs a full month: $199 or more for ReadyMode, $149 for Mojo Dialer.
            </p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
              <Link href="/tools/dialer-cost-calculator" className="guts-btn secondary">COST CALCULATOR</Link>
            </div>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="price" title="Two plans, both weekly">
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">PRO</div>
              <h3>$35 per seat, per week</h3>
              <p>
                Preview, power, progressive and predictive dialing, answering-machine detection,
                unlimited numbers with local presence, recording, inbound, and the compliance export.
                Calling included, no per-minute charge.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">MANAGER+</div>
              <h3>$75 per week</h3>
              <p>
                Replaces Pro for the owner and adds team ownership, white-labeling under your own brand
                and domain, and lead drip from your CRM. Each agent seat is still $35 a week.
              </p>
            </div>
          </div>
          <ul className="guts-list good" style={{ marginTop: 24 }}>
            {FACTS.pricing.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="table" title="What one week costs, dialer by dialer">
          <p>
            Each vendor’s lowest published price that includes multi-line or predictive dialing, for one
            seat. Because they bill by the month, one week and four weeks cost the same.
          </p>
          <div className="guts-tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">DIALER</th>
                  <th scope="col">BILLED</th>
                  <th scope="col">1 WEEK</th>
                  <th scope="col">4 WEEKS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>DialerSeat</td>
                  <td className="ds-cell">Weekly</td>
                  <td className="ds-cell">{money(DIALERSEAT_WEEKLY)}</td>
                  <td className="ds-cell">{money(DIALERSEAT_WEEKLY * 4)}</td>
                </tr>
                {BILLED_DIALERS.map((d) => {
                  const one = billedCost(d, 1, 1)
                  const four = billedCost(d, 4, 1)
                  const billed =
                    d.commitment === 'year' ? 'Annually' : d.commitment === 'quote' ? 'By quote' : 'Monthly'
                  const fmt = (n: number | null) =>
                    n === null ? 'Quote' : `${d.from ? 'from ' : ''}${money(n)}`
                  return (
                    <tr key={d.slug}>
                      <td>
                        <Link href={`/vs/${d.slug}`}>{d.name}</Link>
                      </td>
                      <td>{billed}{d.minimumSeats > 1 ? `, ${d.minimumSeats}-seat minimum` : ''}</td>
                      <td>{fmt(one)}</td>
                      <td>{fmt(four)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="guts-note">
            Orum is billed annually with a three-seat minimum, so its smallest purchase is a year for
            three seats. Figures are before setup fees, add-ons and usage, as each vendor publishes them;
            where a vendor sells by quote only, that is said rather than guessed. Every figure, and where
            it is published, is on the{' '}
            <Link href="/data/dialer-pricing">dialer pricing index</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="scale" title="Work out your own number">
          <p>Set how many weeks you need and how many agents. Seat minimums and annual terms are applied.</p>
          <div style={{ marginTop: 24 }}>
            <DialerCostCalculator />
          </div>
        </GutsSection>

        <GutsSection icon="check" title="What $35 a week includes">
          <ul className="guts-list good">
            {FACTS.features.slice(0, 9).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            <li>
              <strong>Do Not Call scrubbing is yours.</strong> Registry access is granted to your
              organization.{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">How to scrub your list</Link>.
            </li>
            <li>
              <strong>Bring your own leads.</strong> There is no built-in lead marketplace.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title="Pricing questions">
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.question}</h3>
                <p style={{ margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </div>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/why-we-charge" className="guts-btn secondary">WHY WE CHARGE THIS</Link>
            <Link href="/vs/teams" className="guts-btn secondary">TEAM PRICING</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
