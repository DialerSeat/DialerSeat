import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { pageDate } from '@/lib/pageDates'
import type { Vertical } from '@/lib/verticals'

// =============================================================================
// ONE INDUSTRY PAGE, FROM ONE RECORD
// =============================================================================
// Renders a lib/verticals record in the same order the hand-written insurance
// page uses: how the lists map to dialing modes, what matters in this trade,
// the compliance split (what the dialer enforces, what stays yours), cost, and
// the questions. The section order is the argument; the record is the content.
// =============================================================================

const route = (v: Vertical) => `/faq/dialer-for-${v.slug}`

export function verticalMetadata(v: Vertical): Metadata {
  const url = `https://dialerseat.com${route(v)}`
  return {
    title: `${v.title} | DialerSeat`,
    description: v.description,
    keywords: v.keywords,
    alternates: { canonical: url },
    openGraph: { title: v.title, description: v.description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: v.title, description: v.description },
  }
}

export default function VerticalView({ v }: { v: Vertical }) {
  const ROUTE = route(v)
  const updated = pageDate(ROUTE)

  return (
    <>
      <JsonLd data={faqPageSchema(v.faqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
          { name: v.title.split(':')[0], url: ROUTE },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: v.title,
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
            <div className="guts-eyebrow">▸ {v.eyebrow}</div>
            <h1>
              {v.h1[0]}
              <span className="second">{v.h1[1]}</span>
            </h1>
            <p>{v.intro}</p>
            <div className="guts-stamp">Updated {updated}</div>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title="The right mode for each list">
          <div className="guts-grid-2">
            {v.modes.map((m) => (
              <div key={m.role} className="guts-panel">
                <div className="role">{m.role}</div>
                <h3>{m.mode}</h3>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
        </GutsSection>

        {v.sections.map((s) => (
          <GutsSection key={s.title} icon={s.icon} title={s.title}>
            <p>{s.body}</p>
            {s.links && (
              <div className="guts-btns">
                {s.links.map((l) => (
                  <Link key={l.href} href={l.href} className="guts-btn secondary">{l.label.toUpperCase()}</Link>
                ))}
              </div>
            )}
          </GutsSection>
        ))}

        <GutsSection icon="shield" title="The compliance part, said honestly">
          <ul className="guts-list good">
            {v.enforced.map((e) => <li key={e}>{e}</li>)}
          </ul>
          <ul className="guts-list warn" style={{ marginTop: 18 }}>
            {v.yours.map((y) => <li key={y}>{y}</li>)}
          </ul>
          <p className="guts-note">
            Sources:{' '}
            {v.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </span>
            ))}
            . A summary, not legal advice.{' '}
            <Link href="/data/calling-rules-by-country">Rules outside the US</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="price" title="What it costs">
          <p>
            $35 per seat per week, billed weekly, with every dialing mode, local caller ID and recording
            included. No contract, no setup fee, no seat minimum, and calling is included. Manager+ at $75 a
            week adds team ownership, white-labeling and lead drip.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/pricing" className="guts-btn secondary">PRICING</Link>
            {v.related.map((r) => (
              <Link key={r.href} href={r.href} className="guts-btn secondary">{r.label.toUpperCase()}</Link>
            ))}
          </div>
        </GutsSection>

        <GutsSection icon="chat" title="Questions">
          <div style={{ textAlign: 'start', maxWidth: 660, margin: '0 auto' }}>
            {v.faqs.map((f) => (
              <div key={f.question} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{f.question}</h3>
                <p style={{ margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
