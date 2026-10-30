import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

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

const baseMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default async function AboutPage() {
  await primeLocale()
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("About"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          url: `https://dialerseat.com${ROUTE}`,
          name: msg("About DialerSeat"),
          dateModified: UPDATED,
          mainEntity: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ ABOUT")}</div>
            <h1>
              {t("A dialer for people")}<span className="second">{t("who live on the phone.")}</span>
            </h1>
            <p>{t(FACTS.oneLine)}</p>
            <div className="guts-stamp">{t("Updated {uPDATED}", { uPDATED: UPDATED })}</div>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("What DialerSeat is")}>
          <p>
            {t("An outbound calling platform for solo agents through mid-size floors: {audience}. All four dialing modes, answering-machine detection and compliance tooling are included in one weekly seat price.", { audience: FACTS.audience.join(', ').toLowerCase() })}</p>
          <p>
            {t("Every comparison, data page and guide on this site is published by DialerSeat as a company and checked against the method below. Pages carry the date they last changed.")}</p>
          <ul className="guts-list good">
            {FACTS.pricing.slice(1, 5).map((p) => <li key={p}>{t(p)}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="book" title={t("How we research what we publish")} id="method">
          <ul className="guts-list good">
            <li>
              <strong>{t("Competitor pricing")}</strong> {t("comes from each vendor’s own published pricing. Where a vendor sells only by quote, we say so and do not estimate. Every comparison page and the")}{' '}
              <Link href="/data/dialer-pricing">{t("pricing index")}</Link> {t("render from one record per vendor, so the site cannot state two prices for the same tool.")}</li>
            <li>
              <strong>{t("Comparisons concede.")}</strong> {t("Each one says what the other tool does better and who it is the right choice for, before making our case.")}</li>
            <li>
              <strong>{t("Rules and laws")}</strong> {t("are summarised from the regulator or statute, linked beside the summary, with the date they were checked. Anything we could not verify is left out.")}</li>
            <li>
              <strong>{t("Platform data")}</strong>{t(", like")}{" "}<Link href="/data/connect-rates">{t("connect rates")}</Link>{t(", is computed from anonymized call records, shows its sample size, and publishes nothing below a minimum sample.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="check" title={t("Corrections")}>
          <p>
            {t("If a price, a rule or a claim about another company is wrong or out of date, email")}{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("with the source. We would rather fix it than benefit from it, and the page is re-dated when it changes.")}</p>
        </GutsSection>

        <GutsSection icon="alert" title={t("Where DialerSeat is not the right choice")}>
          <ul className="guts-list warn">
            {FACTS.limits.map((l) => <li key={l}>{t(l)}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="list" title={t("Find us")}>
          <ul className="guts-list good">
            <li>{t("Support:")}{" "}<a href="mailto:support@dialerseat.com">support@dialerseat.com</a></li>
            <li>{t("Data and tools:")}{" "}<Link href="/resources">{t("/resources")}</Link></li>
            <li>{t("For AI assistants and crawlers:")}{" "}<a href="/llms.txt">{t("/llms.txt")}</a> {t("and")}{" "}<a href="/llms-full.txt">{t("/llms-full.txt")}</a></li>
            <li>{t("Live system status:")}{" "}<Link href="/status">{t("/status")}</Link></li>
          </ul>
          <div className="guts-btns">
            <Link href="/pricing" className="guts-btn primary">{t("PRICING")}</Link>
            <Link href="/faq/why-dialerseat" className="guts-btn secondary">{t("WHY DIALERSEAT")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
