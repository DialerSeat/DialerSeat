import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/dialer-for-real-estate
// =============================================================================
// SEARCH INTENT: "auto dialer for real estate agents" (480/mo US), "real estate
// dialer" (~370), "dialer for wholesaling", "cold calling software for real
// estate", "mojo dialer alternative". Residential agents and investors are the
// biggest single buyer group for power dialers, and Mojo, REDX, BatchDialer and
// WAVV are all built for them. The site had no page addressed to them.
//
// WHAT IS CLAIMED, and where it comes from:
//   $35 / seat / week, weekly     lib/canonicalFacts pricing
//   predictive, multi-line         canonicalFacts modes
//   windows per LEAD state         canonicalFacts compliance
//   local presence default         the local presence page
//   CSV import, auto-detected      canonicalFacts features
//   lead drip on Manager+          the insurance page and send-leads page
//   same seat price abroad         canonicalFacts teams.offshore
//   Mojo $139 + $10                /vs/mojo
//
// WHAT IS DELIBERATELY NOT CLAIMED:
//   - Any named integration with PropStream, BatchLeads, DealMachine or a CRM.
//     They export CSV and many can send a webhook; that is what is said.
//   - A calls-per-hour figure for DialerSeat. We have no vertical data.
//   - Lead data. DialerSeat does not sell lists, and the page says so.
// =============================================================================

const ROUTE = '/faq/dialer-for-real-estate'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  title: 'Dialer for Real Estate Agents & Investors: Expireds, FSBO, Wholesaling | DialerSeat',
  description:
    'A real estate dialer for agents, wholesalers and their VAs: multi-line predictive, local caller ID, calling windows per lead state, and $35 per seat per week with no contract. Bring your list from any data tool.',
  keywords: [
    'real estate dialer', 'auto dialer for real estate agents', 'dialer for wholesaling',
    'cold calling software for real estate', 'expired listing dialer', 'fsbo dialer',
    'real estate power dialer', 'mojo dialer alternative',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Dialer for real estate agents and investors',
    description: 'Multi-line predictive, local caller ID, calling windows per lead state. $35 per seat per week.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer for real estate agents and investors',
    description: 'Multi-line predictive, local caller ID, calling windows per lead state. $35 per seat per week.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("What is the best dialer for real estate agents?"),
    answer:
      msg("One that fits your lists. Expireds and FSBOs are worked fast and in volume, so multi-line or predictive dialing and a local caller ID matter most. Referral and sphere calls need preview dialing and good notes. DialerSeat includes all four modes at $35 per seat per week, so you choose per campaign instead of per plan."),
  },
  {
    question: msg("Can I use my PropStream, BatchLeads or DealMachine lists?"),
    answer:
      'Yes. Export the list as a CSV and upload it; the columns are detected automatically. If your CRM or data tool can send a webhook, lead drip on Manager+ sends new leads straight into a running campaign. DialerSeat does not sell lead data, so you keep your own source.',
  },
  {
    question: msg("Can my virtual assistants in the Philippines use it?"),
    answer:
      msg("Yes. Agents dial from a browser anywhere, at the same $35 per seat per week, and calling windows follow each lead’s own state, so a VA in another time zone cannot call a US seller outside legal hours."),
  },
  {
    question: msg("Do I need to scrub expired and FSBO lists against the Do Not Call Registry?"),
    answer:
      'Yes. Calling a homeowner to solicit a listing or a purchase is a marketing call, and many FSBO and expired numbers are on the National Do Not Call Registry. Scrubbing is your responsibility; DialerSeat blocks numbers on your own suppression list and anyone who opts out.',
  },
  {
    question: msg("How does the price compare with Mojo Dialer?"),
    answer:
      msg("Mojo Dialer is billed monthly: $139 for Triple Line plus a $10 Agent Access licence, before data add-ons. DialerSeat is $35 per seat per week with predictive included and no contract, so a week costs $35 and four weeks cost $140."),
  },
]

export default async function DialerForRealEstatePage() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Dialer for real estate"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ REAL ESTATE")}</div>
            <h1>
              {t("A dialer for expireds, FSBOs")}<span className="second">{t("and the list you bought today.")}</span>
            </h1>
            <p>
              {t("Listing agents, wholesalers, investors and the VAs who dial for them. Here is what matters in a real estate dialer, and what DialerSeat does about each part.")}</p>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={t("More lines when the list is cold, one line when it is warm")}>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("EXPIREDS, FSBO, COLD LISTS")}</div>
              <h3>{t("Predictive")}</h3>
              <p>{t("Several lines at once, the first seller who answers reaches you. Real predictive, not a fixed triple line.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("CIRCLE PROSPECTING")}</div>
              <h3>{t("Power or progressive")}</h3>
              <p>{t("One call at a time, dialed the moment the last one ends.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("SPHERE, REFERRALS, CALLBACKS")}</div>
              <h3>{t("Preview")}</h3>
              <p>{t("Read the notes first, then start the call yourself.")}</p>
            </div>
            <div className="guts-panel">
              <div className="role">{t("NOT A TIER")}</div>
              <h3>{t("All four included")}</h3>
              <p>{t("Chosen per campaign. Nothing to upgrade to change how you dial.")}</p>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="phone" title={t("A local number, so sellers pick up")}>
          <p>
            {t("A homeowner who listed last month has had a dozen agents call. An out-of-state number is the easiest one to ignore. Every DialerSeat call goes out from a number matched to the seller: their area code first, then their state, then their region. It is on by default, with no add-on fee, and calls spread across the pool so no single number gets labelled Spam Likely.")}</p>
          <div className="guts-btns">
            <Link href="/faq/local-presence-dialing" className="guts-btn secondary">{t("HOW THE NUMBER IS PICKED")}</Link>
            <Link href="/faq/why-calls-show-spam-likely" className="guts-btn secondary">{t("WHY CALLS GET FLAGGED")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("Your list, from whatever tool you use")}>
          <p>
            {t("DialerSeat does not sell lead data, so you are not paying for a dataset you already have. Export your list from PropStream, BatchLeads, DealMachine, your MLS or your CRM as a CSV and upload it; the columns are detected automatically. If the tool can send a webhook, lead drip on Manager+ puts new leads straight into a running campaign.")}</p>
          <div className="guts-btns">
            <Link href="/faq/leads" className="guts-btn secondary">{t("UPLOADING LEADS")}</Link>
            <Link href="/faq/send-leads-from-your-crm" className="guts-btn secondary">{t("LEAD DRIP")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="team" title={t("VAs who dial for you")}>
          <p>
            {t("Many investors have callers in the Philippines or Latin America. Each gets their own seat at the same $35 a week, dials from a browser, and cannot call a seller outside that seller’s legal hours, because the window is enforced against the lead’s state on the server. You see who is live and what each caller did.")}</p>
          <div className="guts-btns">
            <Link href="/faq/dialer-for-offshore-agents" className="guts-btn secondary">{t("OFFSHORE & REMOTE AGENTS")}</Link>
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="shield" title={t("The compliance part, for real estate")}>
          <ul className="guts-list good">
            <li><strong>{t("Calling windows")}</strong> {t("are enforced per lead state, including the states stricter than 8 a.m. to 9 p.m.")}</li>
            <li><strong>{t("Abandoned calls")}</strong> {t("are held under the federal 3% limit automatically in predictive mode.")}</li>
            <li><strong>{t("Opt-outs.")}</strong> {t("Pressing 9 on the abandoned-call message blocks the number across your account, and a STOP text blocks it platform-wide.")}</li>
          </ul>
          <ul className="guts-list warn">
            <li>
              <strong>{t("Scrub expireds and FSBOs.")}</strong> {t("Soliciting a listing is a marketing call, and many of these numbers are on the National Do Not Call Registry.")}{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">{t("How to scrub your list")}</Link>.
            </li>
            <li><strong>{t("Consent for texts and recorded messages")}</strong> {t("is yours to hold.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="price" title={t("What it costs")}>
          <p>
            {t("$35 per seat per week, billed weekly, with every mode, local presence and recording included. No contract and no data add-ons. Mojo Dialer bills monthly, $139 for Triple Line plus a $10 Agent Access licence, so a slow month still pays the full month.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/vs/mojo" className="guts-btn secondary">{t("VS MOJO DIALER")}</Link>
            <Link href="/vs/batchdialer" className="guts-btn secondary">{t("VS BATCHDIALER")}</Link>
            <Link href="/vs/redx" className="guts-btn secondary">{t("VS REDX")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="chat" title={t("Real estate dialer questions")}>
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {FAQS.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t(f.question)}</h3>
                <p style={{ margin: 0 }}>{t(f.answer)}</p>
              </div>
            ))}
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
