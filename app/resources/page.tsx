import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { COMPETITORS } from '@/lib/competitors'
import { COUNTRY_RULES } from '@/lib/countryRules'
import { VERTICALS } from '@/lib/verticals'
import { pageDate } from '@/lib/pageDates'

// =============================================================================
// /resources — every citable page, in one place
// =============================================================================
// The page an outreach email links to. A blogger, a trainer or a journalist
// looking for a source wants to see everything on offer at once, and a page
// titled "resources" is also what other sites' resource pages link to.
//
// Everything here is free to use with a link back, and the page says so.
// =============================================================================

const ROUTE = '/resources'
const UPDATED = pageDate(ROUTE)

export const metadata: Metadata = {
  title: 'Outbound Calling Resources: Data, Calculators & Guides | DialerSeat',
  description:
    'Free outbound calling resources: a pricing index of every major dialer, telemarketing rules for 15 countries, live connect-rate data, a dialer cost calculator and an abandon-rate calculator. Free to cite and embed.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Outbound calling resources',
    description: 'Dialer pricing index, calling rules by country, connect-rate data and free calculators.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outbound calling resources',
    description: 'Dialer pricing index, calling rules by country, connect-rate data and free calculators.',
  },
}

const DATA = [
  {
    href: '/data/dialer-pricing',
    role: 'DATA',
    title: 'Dialer pricing index',
    body: `Published pricing, contract terms and seat minimums for ${COMPETITORS.length + 1} dialers, side by side.`,
  },
  {
    href: '/data/calling-rules-by-country',
    role: 'DATA',
    title: 'Calling rules by country',
    body: `Do Not Call lists, calling hours, consent and dialer rules for ${COUNTRY_RULES.length} countries, with sources.`,
  },
  {
    href: '/data/connect-rates',
    role: 'LIVE DATA',
    title: 'Connect rates by state and hour',
    body: 'Measured on the platform over the last 90 days, with sample sizes shown and nothing published below the threshold.',
  },
]

const TOOLS = [
  {
    href: '/tools/dialer-cost-calculator',
    role: 'CALCULATOR',
    title: 'Dialer cost calculator',
    body: 'What each dialer bills for the weeks and agents you need, with seat minimums and annual terms applied. Embeddable.',
  },
  {
    href: '/tools/abandon-rate-calculator',
    role: 'CALCULATOR',
    title: 'Abandon rate calculator',
    body: 'Check a predictive campaign against the US, UK and Canadian abandoned-call limits. Embeddable.',
  },
]

const GUIDES = [
  { href: '/faq/what-is-an-auto-dialer', label: 'What is an auto dialer?' },
  { href: '/faq/is-a-predictive-dialer-legal', label: 'Is a predictive dialer legal? The 3% rule' },
  { href: '/faq/calling-hours', label: 'Telemarketing calling hours by US state' },
  { href: '/faq/how-to-scrub-the-do-not-call-registry', label: 'How to scrub a list against the Do Not Call Registry' },
  { href: '/faq/why-calls-show-spam-likely', label: 'Why calls show “Spam Likely”' },
  { href: '/faq/local-presence-dialing', label: 'Local presence dialing' },
  { href: '/faq/how-many-numbers-do-i-need', label: 'How many phone numbers a dialer needs' },
  { href: '/faq/10dlc-and-outbound-calling', label: 'Do you need 10DLC to make outbound calls?' },
  { href: '/faq/dialer-glossary', label: 'Dialer glossary' },
  { href: '/dialing-modes', label: 'Preview, power, progressive and predictive dialing' },
]

function Cards({ items }: { items: typeof DATA }) {
  return (
    <div className="guts-grid-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="guts-panel">
          <div className="role">{i.role}</div>
          <h3>{i.title}</h3>
          <p>{i.body}</p>
        </Link>
      ))}
    </div>
  )
}

export default function ResourcesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Resources', url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Outbound calling resources',
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          publisher: { '@id': 'https://dialerseat.com/#organization' },
          hasPart: [...DATA, ...TOOLS].map((i) => ({ '@type': 'WebPage', name: i.title, url: `https://dialerseat.com${i.href}` })),
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ RESOURCES</div>
            <h1>
              Data and tools for
              <span className="second">people who call for a living.</span>
            </h1>
            <p>
              Free to read, quote, link and embed. Every data page is dated and sourced, and each one ends
              with the link ready to paste.
            </p>
            <div className="guts-stamp">Updated {UPDATED}</div>
          </div>
        </GutsSection>

        <GutsSection icon="table" title="Data">
          <Cards items={DATA} />
        </GutsSection>

        <GutsSection icon="scale" title="Calculators">
          <Cards items={TOOLS} />
        </GutsSection>

        <GutsSection icon="team" title="By industry">
          <ul className="guts-list good">
            <li><Link href="/faq/dialer-for-insurance-agents">Dialer for insurance agents</Link></li>
            <li><Link href="/faq/dialer-for-real-estate">Dialer for real estate agents and investors</Link></li>
            <li><Link href="/faq/dialer-for-call-centers">Dialer for call centers</Link></li>
            <li><Link href="/faq/dialer-for-offshore-agents">Dialer for offshore and remote agents</Link></li>
            {VERTICALS.map((v) => (
              <li key={v.slug}><Link href={`/faq/dialer-for-${v.slug}`}>{v.title.split(':')[0]}</Link></li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="shield" title="Calling rules, one country at a time">
          <p>
            {COUNTRY_RULES.map((c, i) => (
              <span key={c.code}>
                {i > 0 && ' · '}
                <Link href={`/data/calling-rules-by-country/${c.code.toLowerCase()}`}>{c.name}</Link>
              </span>
            ))}
          </p>
        </GutsSection>

        <GutsSection icon="book" title="Guides">
          <ul className="guts-list good">
            {GUIDES.map((g) => (
              <li key={g.href}><Link href={g.href}>{g.label}</Link></li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title="Writing about outbound calling?">
          <p>
            Use any of this with a link to the page you used. For a quote, a figure we have not published,
            or a correction, email <a href="mailto:support@dialerseat.com">support@dialerseat.com</a>.
            Machine-readable versions are at <a href="/llms-full.txt">/llms-full.txt</a> and{' '}
            <Link href="/md">/md</Link>.
          </p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
