'use client'
import Link from '@/components/LocaleLink'
import { useState } from 'react'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import SuggestionModal from '@/components/SuggestionModal'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import JsonLd from '@/components/json-ld'
import { pageDate } from '@/lib/pageDates'
import { vsRail } from '@/lib/gutsRail'
import { COMPETITORS, DIALERSEAT, crossShoppedPairs, matchupSlug, type Competitor } from '@/lib/competitors'
import { featuresFor } from '@/lib/competitorFeatures'
import { t } from '@/lib/i18n/client'

// =============================================================================
// DATA-DRIVEN COMPETITOR PAGE
// =============================================================================
// Everything this renders already lives in lib/competitors.ts, because the
// markdown exports and the head-to-head pages need the same facts. So this
// renders from that single source, and adding competitor twenty-two is a data
// entry rather than a file.
//
// The layout is now components/GutsShell — the same navigation rail and
// centered article card /vs/everyone uses. That is the whole point of the
// shell existing: twenty-one pages pick up a redesign here rather than
// twenty-one times, and none of them can drift from the others.
//
// The section ORDER is deliberate and unchanged: what each costs, then where
// each wins feature by feature, then where the COMPETITOR is genuinely the
// better buy, and only then our own case. A comparison that leads with its own
// case reads like marketing, because it is.
// =============================================================================

function Cell({ value, ours }: { value: true | false | string; ours?: boolean }) {
  if (value === true) return <span className="guts-yes">✓</span>
  if (value === false) return <span className="guts-no">✕</span>
  return (
    <span className={ours ? undefined : 'guts-partial'} style={ours ? { fontSize: 12 } : undefined}>
      {t(value)}
    </span>
  )
}

export default function VsCompetitorView({ c }: { c: Competitor }) {
  // Null for the eight competitors that were data-driven from the start and
  // never had a hand-written matrix. The section is skipped rather than
  // rendering an empty table — inventing rows would mean publishing claims
  // about another company's product that nobody researched.
  const matrix = featuresFor(c.slug)
  const [askOpen, setAskOpen] = useState(false)
  // The comparison pages showed no date at all, though they are the pages
  // whose facts (another vendor's prices) go stale fastest. The visible date,
  // dateModified below and the sitemap's <lastmod> all read lib/pageDates.
  const route = `/vs/${c.slug}`
  const updated = pageDate(route)
  // The search is "<tool> alternatives", plural: the searcher wants the
  // shortlist, not one rival. The others on this tool's shortlist (same
  // segment, the gate the head-to-head pages use) come straight from their
  // own records, so the table makes no claim the comparison pages don't.
  const alternatives = COMPETITORS.filter((o) => o.segment === c.segment && o.slug !== c.slug)
  // Head-to-heads were linked only from other head-to-heads sharing a tool,
  // which left a segment with one pair (CloudTalk vs Aircall) linked from
  // nowhere. Each tool's own page is where its matchups belong.
  const matchups = crossShoppedPairs().filter(([x, y]) => x.slug === c.slug || y.slug === c.slug)

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `DialerSeat vs ${c.name}`,
          url: `https://dialerseat.com${route}`,
          dateModified: updated,
          author: { '@id': 'https://dialerseat.com/#organization' },
          publisher: { '@id': 'https://dialerseat.com/#organization' },
        }}
      />
      <SiteHeader />
      <GutsShell rail={vsRail(c.slug)} activeHref={`/vs/${c.slug}`}>

        <GutsSection>
          <div className="guts-hero">
            {/* The phrase buyers search is "<tool> alternative", not "DialerSeat
                vs <tool>". The h1 keeps the comparison; the eyebrow carries the
                search phrase, so it is on the page and not only in the title. */}
            <div className="guts-eyebrow">{t("▸ {name} ALTERNATIVE · PRICING, PROS & CONS", { name: c.name.toUpperCase() })}</div>
            <h1>
              DialerSeat <span className="versus">{t("vs")}</span> {c.name}
            </h1>
            <p>{t(c.summary)}</p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/vs" className="guts-btn secondary">{t("ALL COMPARISONS")}</Link>
            </div>
            <PageStamp>{t('Updated {date}', { date: updated })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="price" title={t("{name} pricing vs DialerSeat pricing", { name: c.name })}>
          <p>
            {t("Both columns are stated the way each vendor states them. Where {name} prices by quote, that is said rather than guessed at.", { name: c.name })}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>DialerSeat</h3>
              <div className="role">{t("OUR PRODUCT")}</div>
              <FactRow label="PRICING" value={DIALERSEAT.pricing} />
              <FactRow label="CONTRACT" value={DIALERSEAT.contract} />
              <FactRow label="DIALING" value={DIALERSEAT.dialing} />
              <FactRow label="ADDING A SEAT" value={DIALERSEAT.team.addingASeat} />
            </div>
            <div className="guts-panel">
              <h3>{c.name}</h3>
              <div className="role">{t("COMPETITOR")}</div>
              <FactRow label="PRICING" value={c.pricing} />
              <FactRow label="CONTRACT" value={c.contract} />
              <FactRow label="DIALING" value={c.dialing} />
              <FactRow label="ADDING A SEAT" value={c.team.addingASeat} />
            </div>
          </div>
          <p className="guts-note">
            {t("DialerSeat bills by the week, so one week of use costs $35 and four weeks cost $140. A tool billed by the month costs a full month even when you only need it for a week.")}{' '}
            <Link href="/pricing">{t("How the billing compares")}</Link> ·{' '}
            <Link href="/data/dialer-pricing">{t("Every dialer's published pricing")}</Link>
          </p>
        </GutsSection>

        {matrix && (
          <GutsSection icon="table" title={t("Where each tool wins")}>
            <p>{t(matrix.lede)}</p>
            <div className="guts-tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("FEATURE")}</th>
                    <th className="ds-head">DIALERSEAT</th>
                    <th>{c.name.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((f, i) => (
                    <tr key={i}>
                      <td>{t(f.feature)}</td>
                      <td className="ds-cell"><Cell value={f.dialerseat} ours /></td>
                      <td><Cell value={f.competitor} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GutsSection>
        )}

        {/* ── PROS AND CONS ─────────────────────────────────────────────
            Headed in the words buyers search — "pros and cons of X", "cons of
            X" — because a heading is the strongest on-page signal a search
            engine or an AI crawler reads. The content is unchanged: it was
            always the competitor's genuine strengths and where buyers get
            caught out. See lib/vsSeo for the structured-data half. */}
        <GutsSection icon="scale" title={t("Pros and cons of {name}", { name: c.name })}>
          <p>
            {t("A comparison where the competitor loses at everything is marketing, and it reads like marketing. These are real advantages, and real drawbacks.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>{t("Pros of {name}", { name: c.name })}</h3>
              <ul className="guts-list good">
                {c.wins.map((w) => <li key={w}>{t(w)}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <h3>{t("Cons of {name}", { name: c.name })}</h3>
              <ul className="guts-list warn">
                {c.friction.map((f) => <li key={f}>{t(f)}</li>)}
              </ul>
            </div>
          </div>
          <div className="guts-callout">
            <h3>{t("Who should pick {name}", { name: c.name })}</h3>
            <p>{t(c.bestFor)}</p>
            <p>
              {t("If that describes you, take {name}. It is a real product with real strengths and no comparison page should talk you out of the right tool.", { name: c.name })}</p>
          </div>
        </GutsSection>

        {alternatives.length > 0 && (
          <GutsSection icon="list" title={t("Other {name} alternatives", { name: c.name })}>
            <p>
              {t("The other tools buyers shortlist against {name}, with the price each vendor publishes and who each one suits.", { name: c.name })}</p>
            <div className="guts-tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("TOOL")}</th>
                    <th>{t("PUBLISHED PRICING")}</th>
                    <th>{t("BEST FOR")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="ds-cell">DialerSeat</td>
                    <td className="ds-cell" style={{ textAlign: 'start' }}>{t(DIALERSEAT.pricing)}</td>
                    <td className="ds-cell" style={{ textAlign: 'start' }}>{t(DIALERSEAT.bestFor)}</td>
                  </tr>
                  {alternatives.map((o) => (
                    <tr key={o.slug}>
                      <td><Link href={`/vs/${o.slug}`}>{o.name}</Link></td>
                      <td style={{ textAlign: 'start' }}>{t(o.pricing)}</td>
                      <td style={{ textAlign: 'start' }}>{t(o.bestFor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {matchups.length > 0 && (
              <>
                <h3 style={{ marginTop: 28 }}>{t("Head-to-head comparisons")}</h3>
                <div className="guts-btns">
                  {matchups.map(([x, y]) => (
                    <Link key={matchupSlug(x, y)} href={`/vs/${matchupSlug(x, y)}`} className="guts-btn secondary">
                      {t("{name} vs {name2}", { name: x.name, name2: y.name })}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </GutsSection>
        )}

        <GutsSection icon="check" title={t("Who should pick DialerSeat")}>
          <p>{t(DIALERSEAT.bestFor)}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>{t("Pros of DialerSeat")}</h3>
              <ul className="guts-list good">
                {DIALERSEAT.wins.map((w) => <li key={w}>{t(w)}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <h3>{t("Cons of DialerSeat")}</h3>
              <ul className="guts-list warn">
                {DIALERSEAT.friction.map((f) => <li key={f}>{t(f)}</li>)}
              </ul>
            </div>
          </div>

          <p className="guts-note">
            {t("DialerSeat publishes this page, so read the DialerSeat column with that in mind. Competitor pricing and capability are taken from each vendor’s own published material and independent review sites at the time of writing, and vendors change their pricing without telling us. Check theirs before you decide. If something here is out of date or wrong,")}{' '}
            <button type="button" className="guts-inline" onClick={() => setAskOpen(true)}>
              {t("tell us and we will fix it")}</button>.
          </p>

          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq" className="guts-btn secondary">{t("READ THE FAQ")}</Link>
          </div>
        </GutsSection>

      </GutsShell>

      <SuggestionModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        title={t("Something wrong on the {name} page?", { name: c.name })}
        intro="Tell us what is out of date or incorrect and we will check it against the vendor's own material."
        defaultKind="other"
      />
      <SiteFooter />
    </>
  )
}

/** One labelled fact inside a comparison panel. */
function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="vsfact">
      <style>{`
        .vsfact { padding: 10px 0; border-top: 1px solid rgba(196,200,208,0.55); }
        .vsfact:first-of-type { border-top: none; padding-top: 0; }
        .vsfact-label {
          font-size: 9px; font-weight: bold; letter-spacing: 2px;
          color: #5a5e6a; margin-bottom: 5px;
        }
        .vsfact-value { font-size: 13.5px; line-height: 1.6; color: #1a1c24; }
      `}</style>
      <div className="vsfact-label">{t(label)}</div>
      <div className="vsfact-value">{t(value)}</div>
    </div>
  )
}
