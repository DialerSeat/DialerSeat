import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { COMPETITORS } from '@/lib/competitors'
import { COUNTRY_RULES } from '@/lib/countryRules'
import { VERTICALS } from '@/lib/verticals'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

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

const baseMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const DATA = [
  {
    href: '/data/dialer-pricing',
    role: 'DATA',
    title: msg("Dialer pricing index"),
    body: `Published pricing, contract terms and seat minimums for ${COMPETITORS.length + 1} dialers, side by side.`,
  },
  {
    href: '/data/calling-rules-by-country',
    role: 'DATA',
    title: msg("Calling rules by country"),
    body: `Do Not Call lists, calling hours, consent and dialer rules for ${COUNTRY_RULES.length} countries, with sources.`,
  },
  {
    href: '/data/connect-rates',
    role: 'LIVE DATA',
    title: msg("Connect rates by state and hour"),
    body: msg("Measured on the platform over the last 90 days, with sample sizes shown and nothing published below the threshold."),
  },
]

const TOOLS = [
  {
    href: '/tools/dialer-cost-calculator',
    role: 'CALCULATOR',
    title: msg("Dialer cost calculator"),
    body: msg("What each dialer bills for the weeks and agents you need, with seat minimums and annual terms applied. Embeddable."),
  },
  {
    href: '/tools/abandon-rate-calculator',
    role: 'CALCULATOR',
    title: msg("Abandon rate calculator"),
    body: msg("Check a predictive campaign against the US, UK and Canadian abandoned-call limits. Embeddable."),
  },
]

const GUIDES = [
  { href: '/faq/what-is-an-auto-dialer', label: 'What is an auto dialer?' },
  { href: '/faq/is-a-predictive-dialer-legal', label: msg("Is a predictive dialer legal? The 3% rule") },
  { href: '/faq/calling-hours', label: msg("Telemarketing calling hours by US state") },
  { href: '/faq/how-to-scrub-the-do-not-call-registry', label: msg("How to scrub a list against the Do Not Call Registry") },
  { href: '/faq/why-calls-show-spam-likely', label: msg("Why calls show “Spam Likely”") },
  { href: '/faq/local-presence-dialing', label: msg("Local presence dialing") },
  { href: '/faq/how-many-numbers-do-i-need', label: msg("How many phone numbers a dialer needs") },
  { href: '/faq/10dlc-and-outbound-calling', label: msg("Do you need 10DLC to make outbound calls?") },
  { href: '/faq/dialer-glossary', label: msg("Dialer glossary") },
  { href: '/dialing-modes', label: msg("Preview, power, progressive and predictive dialing") },
]

function Cards({ items }: { items: { href: string; role: string; title: string; body: string }[] }) {
  return (
    <div className="guts-grid-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="guts-panel">
          <div className="role">{t(i.role)}</div>
          <h3>{t(i.title)}</h3>
          <p>{t(i.body)}</p>
        </Link>
      ))}
    </div>
  )
}

export default async function ResourcesPage() {
  await primeLocale()
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Resources"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: msg("Outbound calling resources"),
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
            <div className="guts-eyebrow">{t("▸ RESOURCES")}</div>
            <h1>
              {t("Data and tools for")}<span className="second">{t("people who call for a living.")}</span>
            </h1>
            <p>
              {t("Free to read, quote, link and embed. Every data page is dated and sourced, and each one ends with the link ready to paste.")}</p>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="table" title={t("Data")}>
          <Cards items={DATA} />
        </GutsSection>

        <GutsSection icon="scale" title={t("Calculators")}>
          <Cards items={TOOLS} />
        </GutsSection>

        <GutsSection icon="team" title={t("By industry")}>
          <ul className="guts-list good">
            <li><Link href="/faq/dialer-for-insurance-agents">{t("Dialer for insurance agents")}</Link></li>
            <li><Link href="/faq/dialer-for-real-estate">{t("Dialer for real estate agents and investors")}</Link></li>
            <li><Link href="/faq/dialer-for-call-centers">{t("Dialer for call centers")}</Link></li>
            <li><Link href="/faq/dialer-for-offshore-agents">{t("Dialer for offshore and remote agents")}</Link></li>
            {VERTICALS.map((v) => (
              <li key={v.slug}><Link href={`/faq/dialer-for-${v.slug}`}>{t(v.title.split(':')[0])}</Link></li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="shield" title={t("Calling rules, one country at a time")}>
          <p>
            {COUNTRY_RULES.map((c, i) => (
              <span key={c.code}>
                {i > 0 && ' · '}
                <Link href={`/data/calling-rules-by-country/${c.code.toLowerCase()}`}>{c.name}</Link>
              </span>
            ))}
          </p>
        </GutsSection>

        <GutsSection icon="book" title={t("Guides")}>
          <ul className="guts-list good">
            {GUIDES.map((g) => (
              <li key={g.href}><Link href={g.href}>{t(g.label)}</Link></li>
            ))}
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title={t("Writing about outbound calling?")}>
          <p>
            {t("Use any of this with a link to the page you used. For a quote, a figure we have not published, or a correction, email")}{" "}<a href="mailto:support@dialerseat.com">support@dialerseat.com</a>{t(". Machine-readable versions are at")}{" "}<a href="/llms-full.txt">{t("/llms-full.txt")}</a> {t("and")}{' '}
            <Link href="/md">{t("/md")}</Link>.
          </p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
