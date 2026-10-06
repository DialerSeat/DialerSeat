import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import type { Vertical } from '@/lib/verticals'
import { getT, primeLocale, t } from '@/lib/i18n/server'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// ONE INDUSTRY PAGE, FROM ONE RECORD
// =============================================================================
// Renders a lib/verticals record in the same order the hand-written insurance
// page uses: how the lists map to dialing modes, what matters in this trade,
// the compliance split (what the dialer enforces, what stays yours), cost, and
// the questions. The section order is the argument; the record is the content.
// =============================================================================

const route = (v: Vertical) => `/faq/dialer-for-${v.slug}`

/**
 * The page's metadata in the request's language. Async because it needs
 * getT(): metadata is built outside the page render, where t() would read no
 * language and freeze the title in English.
 */
export async function verticalMetadata(v: Vertical): Promise<Metadata> {
  const tm = await getT()
  const url = `https://dialerseat.com${route(v)}`
  const title = tm(v.title)
  const description = tm(v.description)
  return localizeMetadata({
    title: tm(msg('{title} | DialerSeat'), { title }),
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  })
}

export default async function VerticalView({ v }: { v: Vertical }) {
  await primeLocale()
  const ROUTE = route(v)
  const updated = pageDate(ROUTE)

  return (
    <>
      <JsonLd data={faqPageSchema(v.faqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: t(v.title).split(':')[0].trim(), url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: t(v.title),
          url: `https://dialerseat.com${ROUTE}`,
          dateModified: updated,
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
          citation: v.sources.map((s) => s.url),
        }}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ {t(v.eyebrow)}</div>
            <h1>
              {t(v.h1[0])}
              <span className="second">{t(v.h1[1])}</span>
            </h1>
            <p>{t(v.intro)}</p>
            <PageStamp>{t("Updated {updated}", { updated })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={t("The right mode for each list")}>
          <div className="guts-grid-2">
            {v.modes.map((m) => (
              <div key={m.role} className="guts-panel">
                <div className="role">{t(m.role)}</div>
                <h3>{t(m.mode)}</h3>
                <p>{t(m.body)}</p>
              </div>
            ))}
          </div>
        </GutsSection>

        {v.sections.map((s) => (
          <GutsSection key={s.title} icon={s.icon} title={t(s.title)}>
            <p>{t(s.body)}</p>
            {s.links && (
              <div className="guts-btns">
                {s.links.map((l) => (
                  <Link key={l.href} href={l.href} className="guts-btn secondary">{t(l.label).toUpperCase()}</Link>
                ))}
              </div>
            )}
          </GutsSection>
        ))}

        <GutsSection icon="shield" title={t("The compliance part, said honestly")}>
          <ul className="guts-list good">
            {v.enforced.map((e) => <li key={e}>{t(e)}</li>)}
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            {v.yours.map((y) => <li key={y}>{t(y)}</li>)}
          </ul>
          <p className="guts-note">
            {t("Sources:")}{' '}
            {v.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{t(s.label)}</a>
              </span>
            ))}
            {t(". A summary, not legal advice.")}{' '}
            <Link href="/data/calling-rules-by-country">{t("Rules outside the US")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="price" title={t("What it costs")}>
          <p>
            {t("$35 per seat per week, billed weekly, with every dialing mode, local caller ID and recording included. No contract, no setup fee, no seat minimum, and calling is included. Manager+ at $75 a week adds team ownership, white-labeling and lead drip.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/pricing" className="guts-btn secondary">{t("PRICING")}</Link>
            {v.related.map((r) => (
              <Link key={r.href} href={r.href} className="guts-btn secondary">{t(r.label).toUpperCase()}</Link>
            ))}
          </div>
        </GutsSection>

        <GutsSection icon="chat" title={t("Questions")}>
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {v.faqs.map((f) => (
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
