import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import CiteThis from '@/components/CiteThis'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { competitorBySlug } from '@/lib/competitors'
import { DIALER_TERMS, LEFT_OUT, SHORTEST_LABEL, TERMS_CHECKED, termCounts, type DialerTerms } from '@/lib/dialerTerms'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /data/dialer-contract-terms: how every dialer makes you commit
// =============================================================================
// The RankHonestly book's "go and measure something" (ch 24): a small study a
// writer can cite in one sentence and check in one click. Nobody searches for
// "dialer contract terms" (autocomplete, 13 Nov 2026), so this page is built
// to be linked, not to rank: the headline is a count, every row links the
// vendor's own page, and anything a page does not say is shown as not stated.
//
// Rendered from lib/dialerTerms.ts; the counts come from termCounts(), so the
// sentence at the top can never disagree with the table under it.
// =============================================================================

const ROUTE = '/data/dialer-contract-terms'
const UPDATED = pageDate(ROUTE)

const baseMetadata: Metadata = {
  keywords: [
    'dialer contract', 'dialer without contract', 'month to month dialer', 'dialer annual contract',
    'dialer seat minimum', 'dialer setup fee', 'weekly billing dialer', 'dialer pricing comparison',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: { title: 'Dialer contract terms, compared', url: `https://dialerseat.com${ROUTE}`, type: 'article' },
  twitter: { card: 'summary_large_image', title: 'Dialer contract terms, compared' },
}

export async function generateMetadata(): Promise<Metadata> {
  const tm = await getT()
  const c = termCounts()
  const description = tm(msg('None of {total} dialers bills weekly. {quote} hide their price; {yearForLowest} of {published} charge less only for a year. From each vendor’s own pricing page.'), c)
  return localizeMetadata({
    ...baseMetadata,
    title: tm(msg('Dialer Contract Terms: {total} Dialers Compared (2026)'), { total: c.total }),
    description,
    openGraph: { ...baseMetadata.openGraph, description },
    twitter: { ...baseMetadata.twitter, description },
  })
}

const yesNo = (v: boolean | null) => (v === null ? msg("Not stated") : v ? msg("Yes") : msg("No"))

export default async function DialerContractTerms() {
  await primeLocale()
  const c = termCounts()
  const rows = DIALER_TERMS.map((d) => ({ d, comp: competitorBySlug(d.slug) })).sort((a, b) =>
    (a.comp?.name ?? a.d.slug).localeCompare(b.comp?.name ?? b.d.slug, 'en'),
  )
  const cell = { textAlign: 'start' as const }

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Resources"), url: '/resources' },
          { name: msg("Dialer contract terms"), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: msg("Dialer contract terms"),
          description: t("Price visibility, shortest commitment, annual discounts, seat minimums and one-time fees for {total} outbound dialers, from each vendor’s own pricing page.", { total: c.total }),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: UPDATED,
          creator: { '@id': 'https://dialerseat.com/#organization' },
          isAccessibleForFree: true,
          license: 'https://creativecommons.org/licenses/by/4.0/',
          creditText: msg("Dialer contract terms, DialerSeat"),
          variableMeasured: [msg("published price"), msg("shortest commitment"), msg("annual discount"), msg("seat minimum"), msg("one-time fee")],
        }}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ DATA · CONTRACT TERMS")}</div>
            <h1>
              {t("How {total} dialers make you commit,", { total: c.total })}<span className="second">{t("from their own pricing pages.")}</span>
            </h1>
            <p>
              {t("None of the {total} dialers we checked bills by the week. {quote} do not publish a price at all. Of the {published} that do, {yearForLowest} charge less only if you pay for a year. Every row below links the vendor page it was read from.", c)}</p>
            <PageStamp>{t("Terms checked {cHECKED} · page updated {uPDATED}", { cHECKED: TERMS_CHECKED, uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("The numbers")}>
          <ul className="guts-list good">
            <li>{t("{weekly} of {total} bill weekly. The shortest commitment any of them sells is a month.", c)}</li>
            <li>{t("{quote} of {total} show no price: you fill in a form or book a demo first.", c)}</li>
            <li>{t("{yearForLowest} of the {published} with a public price charge less if you pay for a year.", c)}</li>
            <li>{t("{longerThanMonth} sell nothing shorter than three months or a year.", c)}</li>
            <li>{t("{seatMinimum} will not sell a single seat; the largest minimum is {largestMinimum}.", c)}</li>
            <li>{t("{oneTimeFee} states a required one-time onboarding fee on its pricing page.", c)}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="table" title={t("Every dialer, as its pricing page states it")}>
          <div className="guts-tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("DIALER")}</th>
                  <th scope="col">{t("PRICE ON ITS SITE")}</th>
                  <th scope="col">{t("SHORTEST COMMITMENT")}</th>
                  <th scope="col">{t("LOWER PRICE FOR A YEAR")}</th>
                  <th scope="col">{t("SEAT MINIMUM")}</th>
                  <th scope="col">{t("ONE-TIME FEE")}</th>
                  <th scope="col">{t("WHAT THE PAGE SAYS")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>DialerSeat</td>
                  <td className="ds-cell">{t("Yes")}</td>
                  <td className="ds-cell">{t("A week")}</td>
                  <td className="ds-cell">{t("No")}</td>
                  <td className="ds-cell">1</td>
                  <td className="ds-cell">{t("None")}</td>
                  <td className="ds-cell" style={cell}>{t("$35 per seat per week, billed weekly, with no contract; cancel any week.")}</td>
                </tr>
                {rows.map(({ d, comp }) => (
                  <tr key={d.slug} id={d.slug}>
                    <td>{comp ? <Link href={`/vs/${d.slug}`}>{comp.name}</Link> : d.slug}</td>
                    <td>{d.price === 'published' ? t("Yes") : t("Quote only")}</td>
                    <td>{d.shortest ? t(SHORTEST_LABEL[d.shortest]) : t("Not stated")}</td>
                    <td>{t(yesNo(d.yearCheaper))}</td>
                    <td>{d.minimum ?? t("Not stated")}</td>
                    <td>{d.fee ? t(d.fee) : t("None stated")}</td>
                    <td style={cell}>
                      {t(d.note)}{' '}
                      <a href={d.source} target="_blank" rel="noopener noreferrer">{t("Source")}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GutsSection>

        <GutsSection icon="book" title={t("How we counted")}>
          <p>
            {t("Each row was read from the vendor’s own pricing page or FAQ on {cHECKED}, and nowhere else. Where the page does not say, the cell says not stated: nothing is filled in from review sites, resellers or memory.", { cHECKED: TERMS_CHECKED })}</p>
          <p>
            {t("A lower price for a year means paying annually buys a lower rate than paying monthly. A seat minimum is the smallest number of seats the cheapest published plan allows. A one-time fee counts only when the pricing page says it is required.")}</p>
          <p>{t("Left out, and why:")}</p>
          <ul className="guts-list">
            {LEFT_OUT.map((x) => (
              <li key={x.name}><strong>{x.name}</strong>: {t(x.why)}</li>
            ))}
          </ul>
          <p>
            {t("Seen a term that has changed? Email")}{' '}
            <a href="mailto:support@dialerseat.com">support@dialerseat.com</a> {t("with the vendor’s page and the row is corrected and re-dated.")}</p>
        </GutsSection>

        <GutsSection icon="phone" title={t("What it means for a short campaign")}>
          <p>
            {t("A two-week campaign on a dialer that sells a month at a time costs a month. On one with a year’s commitment it costs a year, and a seat minimum multiplies either. The prices themselves are side by side in the dialer pricing index.")}</p>
          <div className="guts-btns">
            <Link href="/data/dialer-pricing" className="guts-btn secondary">{t("DIALER PRICING INDEX")}</Link>
            <Link href="/faq/cheapest-power-dialer" className="guts-btn secondary">{t("CHEAPEST POWER DIALER")}</Link>
            <Link href="/pricing" className="guts-btn secondary">{t("WHAT ONE WEEK COSTS")}</Link>
            <Link href="/faq/how-to-cancel" className="guts-btn secondary">{t("HOW TO CANCEL A DIALER")}</Link>
          </div>
          <CiteThis title={t("Dialer contract terms")} path={ROUTE} />
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
