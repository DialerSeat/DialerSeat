import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /features — every capability in one seat, and what is not built
// =============================================================================
// SEARCH INTENT: "dialerseat features", "does dialerseat have <x>", and the
// product-detail lookups AI assistants now run against a vendor's own site.
// After GPT-5.6 (August 2026) ChatGPT began searching brand domains directly
// with site: queries, and product pages overtook "best X" lists as the page
// type it retrieves most (Peec AI). The site had no single page answering
// "what does it do": the facts were spread across the homepage cards, the FAQ
// and llms-full.txt.
//
// Everything renders from lib/canonicalFacts, the same record /llms.txt,
// /llms-full.txt and the markdown mirrors quote, so no two surfaces can state
// a capability differently. The "not built" list is part of the page on
// purpose: an assistant that cannot find a limit stated tends to guess one
// away, and a buyer who finds a gap after paying is a refund.
// =============================================================================

const ROUTE = '/features'
const UPDATED = pageDate(ROUTE)

const MODE_ROUTES: Record<string, string> = {
  Preview: '/dialing-modes/preview',
  Power: '/dialing-modes/power',
  Progressive: '/dialing-modes/progressive',
  Predictive: '/dialing-modes/predictive',
}

const baseMetadata: Metadata = {
  title: 'DialerSeat Features: Dialing Modes, AMD, Compliance, Teams',
  description:
    'Everything a $35-a-week DialerSeat seat includes: all four dialing modes, answering-machine detection, local presence, recording, compliance enforcement and team tools. Plus what is not built yet.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'DialerSeat features',
    description: 'Every dialing mode, AMD, local presence, compliance and team tools in one weekly seat, and what is not built yet.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat features',
    description: 'Every dialing mode, AMD, local presence, compliance and team tools in one weekly seat.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default async function FeaturesPage() {
  await primeLocale()
  const notBuilt = [...new Set([...FACTS.teams.notYet, ...FACTS.limits])]

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Features"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          url: `https://dialerseat.com${ROUTE}`,
          name: msg("DialerSeat features"),
          dateModified: UPDATED,
          about: { '@id': 'https://dialerseat.com/#software' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ FEATURES")}</div>
            <h1>
              {t("Everything in one seat,")}<span className="second">{t("for $35 a week.")}</span>
            </h1>
            <p>{t(FACTS.oneLine)}</p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/pricing" className="guts-btn secondary">{t("PRICING")}</Link>
            </div>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={t("Four dialing modes, chosen per campaign")}>
          <p>{t("All four are included at the base price. Each campaign picks its own mode, so one list can run predictive while another runs preview.")}</p>
          <div className="guts-grid-2">
            {FACTS.modes.map(([mode, body]) => (
              <Link key={mode} href={MODE_ROUTES[mode]} className="guts-panel">
                <div className="role">{mode.toUpperCase()}</div>
                <p>{t(body)}</p>
              </Link>
            ))}
          </div>
        </GutsSection>

        <GutsSection icon="phone" title={t("What every seat includes")}>
          <ul className="guts-list good">
            {FACTS.features.map((f) => <li key={f}>{t(f)}</li>)}
          </ul>
          <div className="guts-btns">
            <Link href="/faq/how-does-amd-work" className="guts-btn secondary">{t("HOW AMD WORKS")}</Link>
            <Link href="/faq/local-presence-dialing" className="guts-btn secondary">{t("LOCAL PRESENCE")}</Link>
            <Link href="/faq/numbers" className="guts-btn secondary">{t("NUMBERS & CALLER ID")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="shield" title={t("Compliance the dialer enforces, and what stays yours")}>
          <ul className="guts-list good">
            {FACTS.compliance.slice(0, -1).map((c) => <li key={c}>{t(c)}</li>)}
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            <li>{t(FACTS.compliance[FACTS.compliance.length - 1])}</li>
          </ul>
          <div className="guts-btns">
            <Link href="/faq/how-we-keep-compliance" className="guts-btn secondary">{t("HOW WE KEEP COMPLIANCE")}</Link>
            <Link href="/tools/abandon-rate-calculator" className="guts-btn secondary">{t("ABANDON RATE CALCULATOR")}</Link>
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">{t("RULES BY COUNTRY")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="team" title={t("Teams")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("SEATS")}</div>
              <ul className="guts-list good">
                {FACTS.teams.seats.map((s) => <li key={s}>{t(s)}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <div className="role">{t("LEAD DISTRIBUTION")}</div>
              <ul className="guts-list good">
                {FACTS.teams.distribution.map((s) => <li key={s}>{t(s)}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <div className="role">{t("VISIBILITY")}</div>
              <ul className="guts-list good">
                {FACTS.teams.visibility.map((s) => <li key={s}>{t(s)}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <div className="role">{t("REMOTE AND OFFSHORE AGENTS")}</div>
              <ul className="guts-list good">
                {FACTS.teams.offshore.map((s) => <li key={s}>{t(s)}</li>)}
              </ul>
            </div>
          </div>
          <div className="guts-btns">
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
            <Link href="/vs/teams" className="guts-btn secondary">{t("TEAM PRICING VS OTHERS")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="alert" title={t("Not built yet, and not what DialerSeat is")}>
          <p>{t("Stated here so nobody finds out after paying.")}</p>
          <ul className="guts-list warn">
            {notBuilt.map((l) => <li key={l}>{t(l)}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="price" title={t("What it costs")}>
          <ul className="guts-list good">
            {FACTS.pricing.map((p) => <li key={p}>{t(p)}</li>)}
          </ul>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/pricing" className="guts-btn secondary">{t("PRICING")}</Link>
            <Link href="/vs" className="guts-btn secondary">{t("COMPARISONS")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
