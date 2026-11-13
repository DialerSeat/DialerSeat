import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { CANCEL_CHECKED, CANCEL_GUIDES } from '@/lib/cancelGuides'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/how-to-cancel: every cancellation guide, with the notice each needs
// =============================================================================
// The index for lib/cancelGuides.ts. Each row links its own page, which is
// what a "how to cancel <dialer>" search lands on.
// =============================================================================

const ROUTE = '/faq/how-to-cancel'
const UPDATED = pageDate(ROUTE)

export async function generateMetadata(): Promise<Metadata> {
  const tm = await getT()
  const n = CANCEL_GUIDES.length
  const description = tm(msg('How to cancel {n} dialers, each from the vendor’s own help pages: who can cancel, the notice needed, refunds and what happens to your numbers.'), { n })
  const social = tm(msg('How to cancel a dialer subscription'))
  return localizeMetadata({
    title: tm(msg('How to Cancel a Dialer Subscription: {n} Dialers (2026)'), { n }),
    description,
    alternates: { canonical: `https://dialerseat.com${ROUTE}` },
    openGraph: { title: social, description, url: `https://dialerseat.com${ROUTE}`, type: 'article' },
    twitter: { card: 'summary_large_image', title: social, description },
  })
}

export default async function CancelIndex() {
  await primeLocale()
  const guides = [...CANCEL_GUIDES].sort((a, b) => a.name.localeCompare(b.name, 'en'))

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("How to cancel a dialer"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ FAQ · CANCELLING A DIALER")}</div>
            <h1>
              {t("How to cancel a dialer,")}<span className="second">{t("from each vendor’s own pages.")}</span>
            </h1>
            <p>
              {t("Each guide below is read from the dialer’s own help center, terms or pricing page: who can cancel, the notice it needs, whether anything is refunded and what happens to your phone numbers. Several release your numbers the day the account closes, so port the ones you want to keep first.")}</p>
            <PageStamp>{t("Terms checked {cHECKED} · page updated {uPDATED}", { cHECKED: CANCEL_CHECKED, uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="table" title={t("Every dialer")}>
          <div className="guts-tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("DIALER")}</th>
                  <th scope="col">{t("NOTICE")}</th>
                  <th scope="col">{t("WHEN IT ENDS")}</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => (
                  <tr key={g.slug}>
                    <td><Link href={`${ROUTE}/${g.slug}`}>{t("How to cancel {name}", { name: g.name })}</Link></td>
                    <td style={{ textAlign: 'start' }}>{g.notice ? t(g.notice) : t("Not stated")}</td>
                    <td style={{ textAlign: 'start' }}>{g.ends ? t(g.ends) : t("Not stated")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GutsSection>

        <GutsSection icon="check" title={t("Before you cancel any dialer")}>
          <ul className="guts-list">
            <li>{t("Find your renewal date. Several of these renew automatically for a full term unless you give notice in time.")}</li>
            <li>{t("Port any number you want to keep, and keep the account open until the port completes.")}</li>
            <li>{t("Download recordings, call logs and contacts. Some dialers delete them on cancellation.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="phone" title={t("If you are moving to another dialer")}>
          <p>
            {t("DialerSeat bills $35 per seat per week with no contract: you can cancel any week, and nothing renews for longer than a week.")}</p>
          <div className="guts-btns">
            <Link href="/data/dialer-contract-terms" className="guts-btn secondary">{t("CONTRACT TERMS")}</Link>
            <Link href="/pricing" className="guts-btn secondary">{t("WHAT ONE WEEK COSTS")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
