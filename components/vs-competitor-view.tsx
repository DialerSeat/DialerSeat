'use client'
import Link from 'next/link'
import { useState } from 'react'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import SuggestionModal from '@/components/SuggestionModal'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { vsRail } from '@/lib/gutsRail'
import { DIALERSEAT, type Competitor } from '@/lib/competitors'
import { featuresFor } from '@/lib/competitorFeatures'

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
      {value}
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

  return (
    <>
      <SiteHeader />
      <GutsShell rail={vsRail(c.slug)} activeHref={`/vs/${c.slug}`}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ COMPARISON</div>
            <h1>
              DialerSeat <span className="versus">vs</span> {c.name}
            </h1>
            <p>{c.summary}</p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
              <Link href="/vs" className="guts-btn secondary">ALL COMPARISONS</Link>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="price" title="What each one costs and what you get">
          <p>
            Both columns are stated the way each vendor states them. Where {c.name} prices
            by quote, that is said rather than guessed at.
          </p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>DialerSeat</h3>
              <div className="role">OUR PRODUCT</div>
              <FactRow label="PRICING" value={DIALERSEAT.pricing} />
              <FactRow label="CONTRACT" value={DIALERSEAT.contract} />
              <FactRow label="DIALING" value={DIALERSEAT.dialing} />
              <FactRow label="ADDING A SEAT" value={DIALERSEAT.team.addingASeat} />
            </div>
            <div className="guts-panel">
              <h3>{c.name}</h3>
              <div className="role">COMPETITOR</div>
              <FactRow label="PRICING" value={c.pricing} />
              <FactRow label="CONTRACT" value={c.contract} />
              <FactRow label="DIALING" value={c.dialing} />
              <FactRow label="ADDING A SEAT" value={c.team.addingASeat} />
            </div>
          </div>
        </GutsSection>

        {matrix && (
          <GutsSection icon="table" title="Where each tool wins">
            <p>{matrix.lede}</p>
            <div className="guts-tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>FEATURE</th>
                    <th className="ds-head">DIALERSEAT</th>
                    <th>{c.name.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((f, i) => (
                    <tr key={i}>
                      <td>{f.feature}</td>
                      <td className="ds-cell"><Cell value={f.dialerseat} ours /></td>
                      <td><Cell value={f.competitor} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GutsSection>
        )}

        <GutsSection icon="scale" title={`Where ${c.name} is the better choice`}>
          <p>
            A comparison where the competitor loses at everything is marketing, and it
            reads like marketing. These are real advantages.
          </p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>{c.name} does this well</h3>
              <ul className="guts-list good">
                {c.wins.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <h3>Where buyers get caught out</h3>
              <ul className="guts-list warn">
                {c.friction.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </div>
          <div className="guts-callout">
            <h3>Who should pick {c.name}</h3>
            <p>{c.bestFor}</p>
            <p>
              If that describes you, take {c.name}. It is a real product with real
              strengths and no comparison page should talk you out of the right tool.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="check" title="Who should pick DialerSeat">
          <p>{DIALERSEAT.bestFor}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <h3>What we do well</h3>
              <ul className="guts-list good">
                {DIALERSEAT.wins.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
            <div className="guts-panel">
              <h3>Where we fall short</h3>
              <ul className="guts-list warn">
                {DIALERSEAT.friction.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </div>

          <p className="guts-note">
            DialerSeat publishes this page, so read the DialerSeat column with that in
            mind. Competitor pricing and capability are taken from each vendor&rsquo;s own
            published material and independent review sites at the time of writing, and
            vendors change their pricing without telling us. Check theirs before you
            decide. If something here is out of date or wrong,{' '}
            <button type="button" className="guts-inline" onClick={() => setAskOpen(true)}>
              tell us and we will fix it
            </button>.
          </p>

          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq" className="guts-btn secondary">READ THE FAQ</Link>
          </div>
        </GutsSection>

      </GutsShell>

      <SuggestionModal
        open={askOpen}
        onClose={() => setAskOpen(false)}
        title={`Something wrong on the ${c.name} page?`}
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
      <div className="vsfact-label">{label}</div>
      <div className="vsfact-value">{value}</div>
    </div>
  )
}
