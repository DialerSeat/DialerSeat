import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// =============================================================================
// /faq/dialer-for-insurance-agents
// =============================================================================
// SEARCH INTENT: "dialer for insurance agents", "insurance auto dialer",
// "medicare dialer", "final expense dialer". High commercial intent, and the
// vertical that buys dialers most.
//
// WHAT IS CLAIMED, and where it comes from:
//   $35 / seat / week, weekly     lib/canonicalFacts pricing
//   all four modes included       same
//   windows per LEAD state        same, and lib/tcpaHours
//   abandon cap enforced          lib/dialerPacing
//   local presence default        claim_pool_number; see the local presence page
//   recordings, per campaign      canonicalFacts features
//   lead drip needs Manager+      the Teams campaign page is the only switch
//   DNC scrubbing is yours        canonicalFacts compliance, said plainly
//
// WHAT IS DELIBERATELY NOT CLAIMED:
//   - Any close rate, contact rate or ROI figure for insurance. We have no
//     vertical data and inventing one would poison every real number we publish.
//   - A CMS recording-retention period. The requirement exists for Medicare
//     TPMOs, the length is CMS's to state, and it was under revision in the
//     CY2027 rulemaking — which Federal Register would not serve to a fetch, so
//     it is not quoted. The page tells the reader to keep their own copies and
//     sends them to CMS, which is useful and cannot go stale.
//   - A retention window of our own. Recording expiry is an open item; saying
//     nothing beats saying a number that is not enforced yet.
//   - Any carrier, CRM or quoting-tool integration by name. Lead drip is a
//     webhook; that is what it can honestly be described as.
// =============================================================================

const ROUTE = '/faq/dialer-for-insurance-agents'

const baseMetadata: Metadata = {
  title: 'Dialer for Insurance Agents: Medicare, Final Expense, P&C | DialerSeat',
  description:
    'What an insurance agent needs from a dialer: calling windows enforced per lead state, local caller ID, recordings you can download, four dialing modes, and $35 per seat per week with no contract.',
  keywords: [
    'dialer for insurance agents',
    'insurance auto dialer',
    'medicare dialer',
    'final expense dialer',
    'insurance predictive dialer',
    'best dialer for insurance sales',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Dialer for Insurance Agents',
    description:
      'Calling windows per lead state, local caller ID, recordings you can download. $35 per seat per week.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer for Insurance Agents',
    description: 'Calling windows per lead state, local caller ID, recordings you can download. $35 per seat per week.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What is the best dialer for insurance agents?"),
    answer:
      msg("The one that fits how you sell. A final expense or Medicare agent working aged or shared leads needs volume, so power or predictive dialing and local caller ID matter most. An agent working referrals and quote requests needs preview dialing and good notes. DialerSeat includes all four modes at $35 per seat per week, so you are not paying for a tier to change how you dial."),
  },
  {
    question: msg("How much does an insurance dialer cost?"),
    answer:
      msg("DialerSeat is $35 per seat per week, billed weekly, with no contract, no setup fee and no seat minimum, and calling is included with no per-minute charge. Most dialers aimed at insurance agencies are sold per seat per month on an annual commitment, often with local presence and recording as paid add-ons."),
  },
  {
    question: msg("Can I run a predictive dialer for insurance calls legally?"),
    answer:
      msg("Yes, within the federal rules on abandoned calls, calling hours and consent. DialerSeat enforces the abandon-rate cap per campaign and the calling window per lead, but scrubbing the National Do Not Call Registry and keeping consent records for your leads stay your responsibility."),
  },
  {
    question: msg("Are calls recorded, and can I keep the recordings?"),
    answer:
      msg("Recording can be switched on per campaign, and recordings can be played back and downloaded. If a rule that applies to you requires calls to be retained for a set number of years, download and keep your own copies rather than relying on any platform’s storage."),
  },
  {
    question: msg("I am licensed in several states. Does the dialer handle calling hours?"),
    answer:
      msg("Yes. Calling windows are enforced server-side against each lead’s own state, not your location, so an agent in one time zone cannot dial a lead in another outside that lead’s legal hours. States with stricter rules than the federal window are enforced at the stricter rule."),
  },
]

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Dialer for insurance agents"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ INSURANCE")}</div>
            <h1>
              {t("A dialer for agents")}<span className="second">{t("who live on the phone.")}</span>
            </h1>
            <p>
              {t("Medicare, final expense, ACA, life, P&C: different products, same day. A list, a licence in several states, and however many conversations you can get before the day runs out. Here is what actually matters in a dialer, and what DialerSeat does about each one.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="calendar" title={t("Calling hours, when you are licensed in several states")}>
          <p>
            {t("Selling in six states means six sets of calling hours, and the rule follows the person you are calling, not you. Getting it wrong is the easiest violation on the list to commit by accident.")}</p>
          <p>
            {t("DialerSeat enforces the window on the server against each lead’s own state. An agent working late in one time zone cannot dial into a state where it is already too late, and states stricter than the federal 8 a.m. to 9 p.m. window are held to their own rule.")}</p>
          <div className="guts-btns">
            <Link href="/faq/calling-hours" className="guts-btn secondary">{t("CALLING HOURS BY STATE")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="phone" title={t("Aged and shared leads need a local number")}>
          <p>
            {t("If you buy shared or aged leads, the person you are calling has heard from other agents already, and an unfamiliar out-of-state number is the easiest one to ignore.")}</p>
          <p>
            {t("Every DialerSeat call goes out from a number matched to the prospect: their area code first, then their state, then their region. It is on by default, on every plan, in every dialing mode, and there is no add-on fee for it. Calls spread across the pool so no single number gets hammered into a Spam Likely label.")}</p>
          <div className="guts-btns">
            <Link href="/faq/local-presence-dialing" className="guts-btn secondary">
              {t("HOW THE NUMBER IS PICKED")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={t("All four modes, because a Medicare day is not a referral day")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("FRESH INBOUND, REFERRALS")}</div>
              <h3>{t("Preview")}</h3>
              <p>
                {t("You read the lead first and start the call yourself. Worth the slower pace when the lead cost real money.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("A LIST TO GET THROUGH")}</div>
              <h3>{t("Power or progressive")}</h3>
              <p>{t("One call at a time, dialed the moment the last one ends. No dead air to fill.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("AGED OR SHARED LISTS")}</div>
              <h3>{t("Predictive")}</h3>
              <p>
                {t("Several lines per agent, the first person who answers reaches you. The most conversations per hour, and the mode the abandon rules apply to.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("NOT A TIER")}</div>
              <h3>{t("All included")}</h3>
              <p>
                {t("Pick the mode per campaign. You are not upgrading a plan to change how you dial.")}</p>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="shield" title={t("The compliance part, said honestly")}>
          <ul className="guts-list good">
            <li>
              <strong>{t("Abandoned calls.")}</strong> {t("Predictive campaigns are held under the federal 3% limit automatically, with a drop to one line per agent before the limit is reached.")}{' '}
              <Link href="/faq/is-a-predictive-dialer-legal">{t("How that works")}</Link>.
            </li>
            <li>
              <strong>{t("Calling windows.")}</strong> {t("Enforced per lead, on the server.")}</li>
            <li>
              <strong>{t("Opt-outs.")}</strong> {t("Pressing 9 on the abandoned-call message blocks that number across your account. A text saying STOP blocks it platform-wide.")}</li>
            <li>
              <strong>{t("A per-call export.")}</strong> {t("Every call, with its AMD result, abandon flag and disposition, for any date range.")}{' '}
              <Link href="/faq/compliance-export">{t("Compliance export")}</Link>.
            </li>
          </ul>
          <ul className="guts-list warn">
            <li>
              <strong>{t("Do Not Call scrubbing is yours.")}</strong> {t("Registry access is granted to your organization, so we cannot do it for you.")}{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">{t("How to scrub your list")}</Link>.
            </li>
            <li>
              <strong>{t("Consent records are yours.")}</strong> {t("Whether you may call a lead at all depends on how you got it. If your lead source sends consent details, in a CSV column or through lead drip, DialerSeat stores them with the lead.")}</li>
            <li>
              <strong>{t("Product rules are yours.")}</strong> {t("Medicare sales in particular carry CMS requirements on recording and retention that sit on top of the telemarketing rules. Keep your own copies of recordings, and check the current requirement with")}{' '}
              <a href="https://www.cms.gov" target="_blank" rel="noopener noreferrer">
                {t("CMS")}</a>{' '}
              {t("rather than assuming a platform covers it.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title={t("Scripts and notes that survive the call")}>
          <p>
            {t("A Medicare pitch and a final expense pitch are different conversations, and an agent switching between them mid-day should not be switching campaigns to find the right words. Campaigns carry multiple scripts, reorderable, switchable mid-call, and notes and dispositions stay with the lead across sessions and across seats.")}</p>
        </GutsSection>

        <GutsSection icon="team" title={t("If you run a downline")}>
          <p>
            {t("Agencies and IMOs can put each agent on their own seat under one owner, at the same $35 a week, with per-agent call history and activity visible to the owner. Manager+ at $75 a week adds team ownership, white-labeling under your own brand, and lead drip, which sends new leads from your CRM straight into a running campaign.")}</p>
          <div className="guts-btns">
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
            <Link href="/faq/send-leads-from-your-crm" className="guts-btn secondary">
              {t("SENDING LEADS FROM A CRM")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="price" title={t("What it costs")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("PRO")}</div>
              <h3>{t("$35 per seat, per week")}</h3>
              <p>
                {t("All four modes, local presence, recording, compliance export. Billed weekly, no contract, no setup fee, no seat minimum, no per-minute charge.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("MANAGER+")}</div>
              <h3>{t("$75 per week")}</h3>
              <p>{t("Replaces Pro for the owner and adds teams, white-labeling and lead drip.")}</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("Weekly billing is the part that matters during a selling season. You add a seat when you need one and stop paying for it the week you do not, without renegotiating an annual contract written in July.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/why-we-charge" className="guts-btn secondary">{t("WHY WE CHARGE THIS")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
