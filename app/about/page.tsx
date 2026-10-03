import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /about — who publishes all this, and how it is checked
// =============================================================================
// Search engines and assistants decide how far to trust a page partly by what
// they can learn about its publisher: who it is, what it sells, how it
// researches, and whether it corrects itself. The site had a hundred pages of
// comparisons and data and no page answering any of that. A comparison site
// without a stated method reads as marketing; one with a method, a corrections
// policy and a list of its own limits reads as a source.
//
// Everything about the product is read from lib/canonicalFacts.
// =============================================================================

const ROUTE = '/about'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'About DialerSeat: Who We Are and How We Research | DialerSeat',
  description:
    'DialerSeat is an outbound dialer at $35 per seat per week. How we research competitor pricing and calling rules, how we handle corrections, and where DialerSeat is not the right choice.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'About DialerSeat',
    description: 'Who publishes this site, how the comparisons and data are researched, and how corrections are made.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About DialerSeat',
    description: 'Who publishes this site, how the comparisons and data are researched, and how corrections are made.',
  },
}

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'About', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          url: `https://dialerseat.com${ROUTE}`,
          name: 'About DialerSeat',
          dateModified: UPDATED,
          mainEntity: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ ABOUT</div>
            <h1>
              A dialer for people
              <span className="second">who live on the phone.</span>
            </h1>
            <p>{FACTS.oneLine}</p>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="info" title="What DialerSeat is">
          <p>
            An outbound calling platform, founded in 2025, for solo agents through mid-size floors:{' '}
            {FACTS.audience.join(', ').toLowerCase()}. All four dialing modes, answering-machine detection
            and compliance tooling are included in one weekly seat price.
          </p>
          <p>
            Every comparison, data page and guide on this site is published by DialerSeat as a company and
            checked against the method below. Pages carry the date they last changed.
          </p>
          <ul className="guts-list good">
            {FACTS.pricing.slice(1, 5).map((p) => <li key={p}>{p}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="book" title="How we research what we publish" id="method">
          <ul className="guts-list good">
            <li>
              <strong>Competitor pricing</strong> comes from each vendor’s own published pricing. Where a vendor
              sells only by quote, we say so and do not estimate. Every comparison page and the{' '}
              <Link href="/data/dialer-pricing">pricing index</Link> render from one record per vendor, so the
              site cannot state two prices for the same tool.
            </li>
            <li>
              <strong>Comparisons concede.</strong> Each one says what the other tool does better and who it is
              the right choice for, before making our case.
            </li>
            <li>
              <strong>Rules and laws</strong> are summarised from the regulator or statute, linked beside the
              summary, with the date they were checked. Anything we could not verify is left out.
            </li>
            <li>
              <strong>Platform data</strong>, like <Link href="/data/connect-rates">connect rates</Link>, is
              computed from anonymized call records, shows its sample size, and publishes nothing below a
              minimum sample.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="check" title="Corrections">
          <p>
            If a price, a rule or a claim about another company is wrong or out of date, email{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> with the source. We would rather
            fix it than benefit from it, and the page is re-dated when it changes.
          </p>
        </GutsSection>

        <GutsSection icon="alert" title="Where DialerSeat is not the right choice">
          <ul className="guts-list warn">
            {FACTS.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="list" title="Find us">
          <ul className="guts-list good">
            <li>Support: <a href="mailto:support@dialerseat.com">support@dialerseat.com</a></li>
            <li>Data and tools: <Link href="/resources">/resources</Link></li>
            <li>For AI assistants and crawlers: <a href="/llms.txt">/llms.txt</a> and <a href="/llms-full.txt">/llms-full.txt</a></li>
            <li>Live system status: <Link href="/status">/status</Link></li>
          </ul>
          <div className="guts-btns">
            <Link href="/pricing" className="guts-btn primary">PRICING</Link>
            <Link href="/faq/why-dialerseat" className="guts-btn secondary">WHY DIALERSEAT</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
