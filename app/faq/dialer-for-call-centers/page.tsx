import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { FACTS } from '@/lib/canonicalFacts'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t as tr } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/dialer-for-call-centers
// =============================================================================
// SEARCH INTENT: "auto dialer software for call center" (+110% over the year),
// "predictive dialer for call center", "call center dialer", "outbound call
// center software", "readymode alternative", "vicidial alternative". Small
// floors, lead-gen agencies and BPOs, very often with agents offshore.
//
// Every product claim is read from FACTS.teams in lib/canonicalFacts, the
// block written for exactly this reader, including the `notYet` list. A floor
// manager who finds live monitoring missing after buying is a refund; one who
// reads it here and buys anyway is a customer who knew.
// =============================================================================

const ROUTE = '/faq/dialer-for-call-centers'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  title: 'Predictive Dialer for Call Centers: Weekly Seats, No Contract | DialerSeat',
  description:
    'A predictive dialer for small call centers, lead-gen agencies and offshore floors: shared campaigns with no duplicate calls, per-lead calling windows, the 3% cap enforced, and $35 per seat per week that you add or pause any week.',
  keywords: [
    'auto dialer software for call center', 'predictive dialer for call center', 'call center dialer',
    'outbound call center software', 'call center predictive dialer', 'bpo dialer', 'readymode alternative',
    'vicidial alternative',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Predictive dialer for call centers',
    description: 'Shared campaigns, per-lead calling windows, the 3% cap enforced. $35 per seat per week.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predictive dialer for call centers',
    description: 'Shared campaigns, per-lead calling windows, the 3% cap enforced. $35 per seat per week.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What does a ten-agent floor cost?"),
    answer:
      msg("Ten seats are $350 a week, plus $75 a week for the owner on Manager+, which adds team management and white-labeling. No setup fee, no contract and no seat minimum, and a seat can be paused any week without losing the agent’s data."),
  },
  {
    question: msg("Can two agents call the same lead?"),
    answer:
      msg("No. Leads are claimed in the database before they are dialed, so a shared campaign never hands the same lead to two agents. A claim is released automatically if an agent’s browser closes mid-call."),
  },
  {
    question: msg("Does it work for offshore agents calling US leads?"),
    answer:
      msg("Yes. Agents dial from a browser anywhere at the same seat price, and calling windows are enforced against each lead’s own state, so an agent in another time zone cannot call outside the lead’s legal hours."),
  },
  {
    question: msg("Is there live call monitoring?"),
    answer:
      msg("Not yet. Listen, whisper and barge are not built, and neither are call scoring or workforce management. The owner sees which agents are live, what campaign each is on, and per-agent calls, connects and dispositions for any date range."),
  },
]

export default async function DialerForCallCentersPage() {
  await primeLocale()
  const t = FACTS.teams
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Dialer for call centers"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{tr("▸ CALL CENTERS")}</div>
            <h1>
              {tr("A predictive dialer for floors")}<span className="second">{tr("that change size every week.")}</span>
            </h1>
            <p>
              {tr("Lead-gen agencies, BPOs and small outbound floors, on-site or offshore. Seats you add and pause by the week, campaigns the whole floor shares, and the compliance limits enforced on the server.")}</p>
            <PageStamp>{tr("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="price" title={tr("Seats by the week")}>
          <ul className="guts-list good">
            {t.seats.map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
          <p style={{ marginTop: 18 }}>
            {tr("A campaign that ends on Friday stops costing you on Friday. Floors billed by the month or the year pay for the seats they hired for, not the ones they are using.")}{' '}
            <Link href="/tools/dialer-cost-calculator">{tr("Work out your floor’s cost")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="team" title={tr("One list, the whole floor, no double calls")}>
          <ul className="guts-list good">
            {t.distribution.map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="table" title={tr("What the owner sees")}>
          <ul className="guts-list good">
            {t.visibility.map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            {t.notYet.map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
        </GutsSection>

        <GutsSection icon="shield" title={tr("Compliance on a predictive floor")}>
          <ul className="guts-list good">
            {FACTS.compliance.slice(0, 4).map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
          <p style={{ marginTop: 18 }}>
            {tr("Check any campaign against the limit with the")}{' '}
            <Link href="/tools/abandon-rate-calculator">{tr("abandon rate calculator")}</Link>{tr(", and export every call’s AMD result, abandon flag and disposition with the")}{' '}
            <Link href="/faq/compliance-export">{tr("compliance export")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="phone" title={tr("Offshore floors dialing the US")}>
          <ul className="guts-list good">
            {t.offshore.map((s) => <li key={s}>{tr(s)}</li>)}
          </ul>
          <div className="guts-btns">
            <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">{tr("OFFSHORE AGENTS")}</Link>
            <Link href="/data/calling-rules-by-country" className="guts-btn secondary">{tr("RULES BY COUNTRY")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="chat" title={tr("Call center questions")}>
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{tr(f.question)}</h3>
                <p style={{ margin: 0 }}>{tr(f.answer)}</p>
              </div>
            ))}
          </div>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{tr("GET STARTED →")}</Link>
            <Link href="/vs/readymode" className="guts-btn secondary">{tr("VS READYMODE")}</Link>
            <Link href="/vs/vicidial" className="guts-btn secondary">{tr("VS VICIDIAL")}</Link>
            <Link href="/vs/convoso" className="guts-btn secondary">{tr("VS CONVOSO")}</Link>
            <Link href="/vs/teams" className="guts-btn secondary">{tr("TEAM PRICING")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
