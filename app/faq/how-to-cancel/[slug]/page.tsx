import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { notFound } from 'next/navigation'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema } from '@/lib/schema'
import { CANCEL_CHECKED, CANCEL_GUIDES, SOURCE_LABEL, type CancelGuide } from '@/lib/cancelGuides'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /faq/how-to-cancel/<slug>: how to cancel one dialer, from its own pages
// =============================================================================
// SEARCH INTENT: "how to cancel <dialer> subscription", confirmed in Google
// autocomplete on 13 Nov 2026 for every dialer here. The reader is leaving a
// dialer and wants the steps, so the steps come first and DialerSeat appears
// once, at the end. Rendered from lib/cancelGuides.ts; see its header for the
// sourcing rule.
// =============================================================================

const INDEX = '/faq/how-to-cancel'

export function generateStaticParams() {
  return CANCEL_GUIDES.map((g) => ({ slug: g.slug }))
}

const bySlug = (slug: string): CancelGuide | undefined => CANCEL_GUIDES.find((g) => g.slug === slug)

const FIELDS: { key: keyof CancelGuide; label: string }[] = [
  { key: 'who', label: msg("WHO CAN CANCEL") },
  { key: 'notice', label: msg("NOTICE") },
  { key: 'ends', label: msg("WHEN IT ENDS") },
  { key: 'refunds', label: msg("REFUNDS") },
  { key: 'numbers', label: msg("PHONE NUMBERS") },
  { key: 'data', label: msg("YOUR DATA") },
]

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = bySlug(slug)
  if (!g) return {}
  const tm = await getT()
  const name = g.name
  const url = `https://dialerseat.com${INDEX}/${g.slug}`
  const description = tm(msg('How to cancel {name}, from its own help pages: the steps, the notice it needs, refunds, and what happens to your phone numbers and data.'), { name })
  const social = tm(msg('How to cancel {name}'), { name })
  return localizeMetadata({
    title: tm(msg('How to Cancel {name}: Notice, Refunds & Your Numbers (2026)'), { name }),
    description,
    alternates: { canonical: url },
    openGraph: { title: social, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: social, description },
  })
}

export default async function CancelGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  await primeLocale()
  const { slug } = await params
  const g = bySlug(slug)
  if (!g) notFound()

  const ROUTE = `${INDEX}/${g.slug}`
  const updated = pageDate(INDEX)
  const name = g.name
  const others = CANCEL_GUIDES.filter((o) => o.slug !== g.slug)

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("How to cancel a dialer"), url: INDEX },
          { name, url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: t('How to cancel {name}', { name }),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: updated,
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
          citation: g.sources.map((x) => x.url),
        }}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(INDEX)} activeHref={INDEX}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ FAQ · CANCELLING A DIALER")}</div>
            <h1>
              {t("How to cancel {name},", { name })}<span className="second">{t("from its own help pages.")}</span>
            </h1>
            <p>{t(g.answer)}</p>
            <PageStamp>{t("Checked against {name}’s own pages on {cHECKED} · page updated {uPDATED}", { name, cHECKED: CANCEL_CHECKED, uPDATED: updated })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("The steps")}>
          <ol style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto', paddingInlineStart: 22 }}>
            {g.steps.map((s) => (
              <li key={s} style={{ marginBottom: 8 }}>{t(s)}</li>
            ))}
          </ol>
        </GutsSection>

        <GutsSection icon="shield" title={t("The terms")}>
          <div className="guts-tablewrap">
            <table>
              <tbody>
                {FIELDS.filter((f) => g[f.key]).map((f) => (
                  <tr key={f.key}>
                    <td style={{ width: '28%', fontSize: 10, letterSpacing: 2 }}>{t(f.label)}</td>
                    <td style={{ textAlign: 'start', color: '#1a1c24' }}>{t(g[f.key] as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {g.watch && <p className="guts-note"><strong>{t("Worth knowing first:")}</strong> {t(g.watch)}</p>}
          <p className="guts-note">
            {t("Sources:")}{' '}
            {g.sources.map((x, i) => (
              <span key={x.url}>
                {i > 0 && ' · '}
                <a href={x.url} target="_blank" rel="noopener noreferrer">{t(SOURCE_LABEL[x.kind], { name })}</a>
              </span>
            ))}
          </p>
          <p className="guts-note">
            {t("Every line above is from {name}’s own pages, linked here. Terms change, so check them before you cancel, and keep a copy of your request.", { name })}</p>
        </GutsSection>

        <GutsSection icon="phone" title={t("If you are moving to another dialer")}>
          <p>
            {t("DialerSeat bills $35 per seat per week with no contract: you can cancel any week, and nothing renews for longer than a week.")}</p>
          <div className="guts-btns">
            <Link href={`/vs/${g.slug}`} className="guts-btn secondary">{t("SEE THE COMPARISON")}</Link>
            <Link href="/data/dialer-contract-terms" className="guts-btn secondary">{t("CONTRACT TERMS")}</Link>
            <Link href="/pricing" className="guts-btn secondary">{t("WHAT ONE WEEK COSTS")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="book" title={t("Other dialers")}>
          <p>
            {others.map((o, i) => (
              <span key={o.slug}>
                {i > 0 && ' · '}
                <Link href={`${INDEX}/${o.slug}`}>{t("How to cancel {name}", { name: o.name })}</Link>
              </span>
            ))}
          </p>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
