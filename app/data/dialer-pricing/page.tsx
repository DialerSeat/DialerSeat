import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import CiteThis from '@/components/CiteThis'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { COMPETITORS, DIALERSEAT, type Competitor } from '@/lib/competitors'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /data/dialer-pricing — the Dialer Pricing Index
// =============================================================================
// Every dialer's published price, contract terms and smallest purchase, in one
// table. It renders straight from lib/competitors.ts, the registry every /vs
// page, markdown mirror and llms-full.txt already quote, so the index cannot
// state a price the comparison pages do not.
//
// WHY THIS PAGE: "how much does <dialer> cost" is asked about every tool on the
// list, most vendors hide the answer behind a demo, and nobody publishes the
// whole market side by side. A table that answers it for 27 tools, dated and
// sourced, is the page a blogger links to instead of researching it, and the
// page an assistant quotes when asked to compare prices.
//
// It concedes where DialerSeat is not the cheapest. A phone system with a
// single-line power dialer can cost less per month, and the table shows it;
// an index that only listed the rivals we beat would not be cited twice.
// =============================================================================

const ROUTE = '/data/dialer-pricing'
const UPDATED = pageDate(ROUTE)

// The title and descriptions carry a count, so they are templates that
// localizeMetadata's exact-string lookup cannot match; generateMetadata
// translates and fills them.
const baseMetadata: Metadata = {
  keywords: [
    'dialer pricing', 'dialer pricing comparison', 'readymode pricing', 'mojo dialer pricing',
    'phoneburner pricing', 'batchdialer pricing', 'five9 pricing', 'convoso pricing', 'predictive dialer cost',
  ],
  alternates: {
    canonical: `https://dialerseat.com${ROUTE}`,
    types: { 'text/markdown': `https://dialerseat.com/md${ROUTE}` },
  },
  openGraph: {
    title: 'Dialer Pricing Index',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer Pricing Index',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const tm = await getT()
  const n = COMPETITORS.length + 1
  const social = tm(msg('What {n} outbound dialers charge, their contract terms and seat minimums, side by side.'), { n })
  return localizeMetadata({
    ...baseMetadata,
    title: tm(msg('Dialer Pricing Index: What {n} Dialers Cost | DialerSeat'), { n }),
    description: tm(msg('Published pricing, contract terms and seat minimums for {n} outbound dialers, including ReadyMode, Mojo, PhoneBurner, BatchDialer, Five9, Convoso, Kixie, Orum and VICIdial. Dated and free to cite.'), { n }),
    openGraph: { ...baseMetadata.openGraph, description: social },
    twitter: { ...baseMetadata.twitter, description: social },
  })
}

const SEGMENTS: { key: Competitor['segment']; title: string; note: string }[] = [
  { key: 'call_center', title: msg("Call center and predictive dialers"), note: msg("Built for floors running predictive campaigns all day.") },
  { key: 'real_estate', title: msg("Real estate dialers"), note: msg("Built around investor and agent workflows, often with lead data.") },
  { key: 'sales_crm', title: msg("Sales and CRM dialers"), note: msg("Dialers inside, or attached to, a sales CRM or engagement tool.") },
  { key: 'phone_system', title: msg("Phone systems with a dialer"), note: msg("Business phone platforms where dialing is one feature or add-on.") },
]

const FAQS = [
  {
    question: msg("How much does a predictive dialer cost?"),
    answer:
      msg("Where it is priced publicly, multi-line and predictive dialing runs from about $49 to $250 per seat per month, and several vendors sell only by quote with setup fees and annual contracts. DialerSeat is $35 per seat per week, billed weekly, with predictive included."),
  },
  {
    question: msg("Which dialers bill weekly?"),
    answer:
      msg("Of the dialers in this index, only DialerSeat bills weekly. None of the others sells less than a month, and several sell a year at a time."),
  },
  {
    question: msg("Where do these prices come from?"),
    answer:
      msg("Each vendor’s own published pricing where it exists, and the terms stated on each comparison page where it does not. Where a vendor sells only by quote, the index says so rather than estimating."),
  },
]

export default async function DialerPricingIndex() {
  await primeLocale()
  const all = COMPETITORS.length + 1
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Resources"), url: '/resources' },
          { name: msg("Dialer pricing index"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: msg("Dialer Pricing Index"),
          description: t("Published pricing, contract terms, seat minimums and five-agent costs for {all} outbound dialers.", { all }),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          creator: { '@id': 'https://dialerseat.com/#organization' },
          isAccessibleForFree: true,
          // Reusable with credit (creditText below). Google flags a Dataset
          // without a license (Search Console, 29 Oct 2026).
          license: 'https://creativecommons.org/licenses/by/4.0/',
          creditText: msg("Dialer Pricing Index, DialerSeat"),
          keywords: ['dialer pricing', 'predictive dialer', 'auto dialer', 'call center software'],
          variableMeasured: ['pricing', msg("contract terms"), msg("smallest purchase"), msg("five-agent cost")],
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'text/markdown',
            contentUrl: `https://dialerseat.com/md${ROUTE}`,
          },
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ DATA · DIALER PRICING INDEX")}</div>
            <h1>
              {t("What {all} dialers cost,", { all })}<span className="second">{t("as they publish it.")}</span>
            </h1>
            <p>
              {t("Pricing, contract terms, the smallest purchase and what five agents cost, for every outbound dialer we compare. Quoted-only pricing is marked as quoted rather than guessed. Free to cite.")}</p>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("The short version")}>
          <ul className="guts-list good">
            <li>
              {t("Only one dialer here bills weekly: DialerSeat, at $35 per seat per week. None of the others sells less than a month, and several sell a year at a time.")}</li>
            <li>
              {t("Where multi-line and predictive dialing is priced publicly, it runs from about $49 per seat per month (JustCall Pro, two-seat minimum) to about $250 as reported for Orum, billed annually. The largest contact-center vendors sell by quote.")}</li>
            <li>
              {t("Phone systems where the dialer is a plan tier or an add-on (CloudTalk, Aircall, Dialpad) can cost less per month. Check which tier actually includes the dialing mode you need.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="table" title="DialerSeat">
          <div className="guts-tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("DIALER")}</th>
                  <th scope="col">{t("PRICING")}</th>
                  <th scope="col">{t("CONTRACT")}</th>
                  <th scope="col">{t("FIVE AGENTS")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>DialerSeat</td>
                  <td className="ds-cell" style={{ textAlign: 'start' }}>{t(DIALERSEAT.pricing)}</td>
                  <td style={{ textAlign: 'start' }}>{t(DIALERSEAT.contract)}</td>
                  <td style={{ textAlign: 'start' }}>{t(DIALERSEAT.team.fiveSeats)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </GutsSection>

        {SEGMENTS.map((s) => {
          const rows = COMPETITORS.filter((c) => c.segment === s.key)
          if (rows.length === 0) return null
          return (
            <GutsSection key={s.key} icon="table" title={t(s.title)} id={s.key.replace('_', '-')}>
              <p>{t(s.note)}</p>
              <div className="guts-tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("DIALER")}</th>
                      <th scope="col">{t("PRICING")}</th>
                      <th scope="col">{t("CONTRACT")}</th>
                      <th scope="col">{t("SMALLEST PURCHASE")}</th>
                      <th scope="col">{t("FIVE AGENTS")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.slug}>
                        <td>
                          <Link href={`/vs/${c.slug}`}>{c.name}</Link>
                        </td>
                        <td style={{ textAlign: 'start' }}>{t(c.pricing)}</td>
                        <td style={{ textAlign: 'start' }}>{t(c.contract)}</td>
                        <td style={{ textAlign: 'start' }}>{t(c.team.minimum)}</td>
                        <td style={{ textAlign: 'start' }}>{t(c.team.fiveSeats)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GutsSection>
          )
        })}

        <GutsSection icon="book" title={t("How the index is kept")}>
          <p>
            {t("Each row is the same record the matching comparison page renders from, so the index, the comparison pages and the machine-readable copies always agree. Prices are the vendor’s own published figures where they exist, before setup fees, add-ons and usage. Vendors that sell only by quote are shown that way.")}</p>
          <p>
            {t("Spotted a price that has changed? Email")}{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("with the vendor’s page and the row is corrected and re-dated.")}</p>
          <div className="guts-btns">
            <Link href="/pricing" className="guts-btn secondary">{t("WHAT ONE WEEK COSTS")}</Link>
            <Link href="/tools/dialer-cost-calculator" className="guts-btn secondary">{t("COST CALCULATOR")}</Link>
          </div>
          <CiteThis title={t("Dialer Pricing Index")} path={ROUTE} />
        </GutsSection>

        <GutsSection icon="chat" title={t("Questions")}>
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
