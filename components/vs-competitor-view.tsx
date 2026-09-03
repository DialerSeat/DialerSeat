'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'
import { DIALERSEAT, type Competitor } from '@/lib/competitors'
import { featuresFor } from '@/lib/competitorFeatures'
import { SITE, SITE_TYPE, SITE_SPACE } from '@/lib/siteTheme'

// =============================================================================
// DATA-DRIVEN COMPETITOR PAGE
// =============================================================================
// The first thirteen /vs pages are bespoke — roughly 490 lines of hand-written
// JSX each, differing only in their strings. That was fine at thirteen and is
// not fine at twenty-one: it is 6,000 lines of near-identical markup where a
// change to the layout means thirteen edits and a change to the disclosure
// language means thirteen chances to miss one.
//
// Everything this page renders already lives in lib/competitors.ts, because
// the markdown exports and the head-to-head pages need the same facts. So this
// renders from that single source instead, and adding competitor twenty-two is
// a data entry rather than a file.
//
// That reasoning used to end with "the bespoke pages are deliberately left
// alone -- they rank, and rewriting a page that works to satisfy a consistency
// instinct is not an improvement." It held right up until the pages needed a
// redesign. Fifteen copies of one layout means applying a new design fifteen
// times and living with fourteen near-misses, which is a far worse outcome
// than the duplication it was protecting.
//
// So they were migrated. Their feature matrices -- 296 rows of hand-written
// claims about other vendors -- moved verbatim into lib/competitorFeatures.ts
// rather than being retyped, and render below from there.
// =============================================================================

const T = SITE

export default function VsCompetitorView({ c }: { c: Competitor }) {
  // Null for the eight competitors that were data-driven from the start and
  // never had a hand-written matrix. The section below is skipped entirely
  // rather than rendering an empty table.
  const matrix = featuresFor(c.slug)

  return (
    <>
      <SiteHeader />
      <BackToVsButton />
      <div className="vs-root" style={{
        background: T.bg,
        minHeight: '100vh',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}>
        <style>{`
          .vs-root * { box-sizing: border-box; }
          /* Light, like the landing page. This was a dark gradient with a
             blue glow behind it, against a homepage that is #f0f1f4, the
             inverse of the site it belongs to. */
          .vs-hero {
            background: transparent;
            color: ${T.text};
            padding: 88px 32px 72px;
            text-align: center;
            position: relative;
          }
          .vs-hero-inner { position: relative; max-width: 880px; margin: 0 auto; }
          .vs-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.10);
            border: 1px solid ${T.blue};
            border-radius: 4px;
            color: ${T.deep};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .vs-h1 {
            font-size: ${SITE_TYPE.articleH1};
            letter-spacing: -2px;
            line-height: 1.05;
            font-weight: bold;
            margin: 0 0 20px 0;
            color: ${T.text};
          }
          /* The landing page's two-tone headline, applied to the one word
             that carries the meaning of a comparison page. */
          .vs-h1 .versus { color: ${T.deep}; }
          .vs-subhead {
            font-size: 19px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 720px;
            margin: 0 auto 36px;
          }
          .vs-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          /* The landing page's signature key: 1px all round, 3px on top.
             A button here without it looks like a different product. */
          .vs-btn-primary {
            padding: 13px 26px;
            background: transparent;
            color: ${T.blue};
            font-size: 12px;
            letter-spacing: 3px;
            font-weight: bold;
            border: 1px solid ${T.blue};
            border-top: 3px solid ${T.blue};
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
          }
          .vs-btn-primary:hover { background: rgba(74,158,255,0.10); }
          .vs-btn-ghost {
            padding: 13px 26px;
            border: 1px solid ${T.border};
            border-top: 3px solid ${T.muted};
            color: ${T.text};
            font-size: 12px;
            letter-spacing: 3px;
            font-weight: bold;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
          }
          .vs-section { max-width: ${SITE_SPACE.wideWidth}; margin: 0 auto; padding: 72px 32px; }
          .vs-section-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 12px; }
          .vs-section-h2 { font-size: 36px; letter-spacing: -0.5px; line-height: 1.15; font-weight: 800; margin: 0 0 16px 0; color: ${T.text}; }
          .vs-section-lede { font-size: 16px; color: ${T.muted}; line-height: 1.65; max-width: 720px; margin: 0 0 40px 0; }
          .feature-table {
            width: 100%;
            border-collapse: collapse;
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 4px;
            overflow: hidden;
            margin-top: 24px;
          }
          .feature-table th {
            padding: 16px 20px;
            background: ${T.ink};
            color: ${T.inkText};
            font-size: 11px;
            letter-spacing: 2px;
            text-align: left;
            font-weight: bold;
          }
          .feature-table th:nth-child(2), .feature-table th:nth-child(3) { text-align: center; width: 18%; }
          .feature-table td { padding: 14px 20px; border-top: 1px solid ${T.border}; font-size: 14px; }
          .feature-table td:nth-child(2), .feature-table td:nth-child(3) { text-align: center; font-weight: bold; }
          .feature-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
          .feature-table .yes { color: ${T.green}; font-size: 18px; }
          .feature-table .no { color: ${T.red}; font-size: 18px; }
          .feature-table .partial { color: ${T.amber}; font-style: italic; font-size: 12px; }
          .feature-table .ds-cell { background: rgba(74,158,255,0.04); }
          .vs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .vs-card {
            background: ${T.surface};
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 28px;
          }
          .vs-card h3 { font-size: 20px; font-weight: 800; margin: 0 0 6px 0; }
          .vs-card .role { font-size: 11px; letter-spacing: 2px; color: ${T.muted}; font-weight: bold; margin-bottom: 18px; }
          .vs-list { list-style: none; padding: 0; margin: 0; }
          .vs-list li {
            font-size: 14px;
            line-height: 1.6;
            color: #c4c8d8;
            padding: 7px 0 7px 24px;
            position: relative;
          }
          .vs-list li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 14px;
            width: 8px;
            height: 8px;
            border-radius: 2px;
          }
          .vs-list.good li::before { background: ${T.green}; }
          .vs-list.warn li::before { background: ${T.amber}; }
          .fact-row {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 16px;
            padding: 18px 0;
            border-bottom: 1px solid ${T.border};
            align-items: start;
          }
          .fact-row:last-child { border-bottom: none; }
          .fact-label { font-size: 11px; letter-spacing: 2px; color: ${T.muted}; font-weight: bold; padding-top: 2px; }
          .fact-value { font-size: 15px; line-height: 1.65; color: #c4c8d8; }
          .verdict {
            background: ${T.surface};
            border: 1px solid ${T.blue};
            border-radius: 12px;
            padding: 32px;
            margin-top: 8px;
          }
          .verdict h3 { font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: ${T.blue}; }
          .verdict p { font-size: 15px; line-height: 1.7; color: #c4c8d8; margin: 0 0 14px 0; }
          .verdict p:last-child { margin-bottom: 0; }
          .disclosure {
            font-size: 13px;
            line-height: 1.6;
            color: ${T.muted};
            border-left: 2px solid ${T.border};
            padding-left: 16px;
            margin-top: 36px;
          }
          @media (max-width: 860px) {
            .vs-h1 { font-size: 38px; }
            .vs-subhead { font-size: 17px; }
            .vs-grid { grid-template-columns: 1fr; }
            .vs-section { padding: 56px 20px; }
            .vs-hero { padding: 56px 20px 72px; }
            .fact-row { grid-template-columns: 1fr; gap: 4px; }
          }
        `}</style>

        <header className="vs-hero">
          <div className="vs-hero-inner">
            <div className="vs-eyebrow">COMPARISON</div>
            <h1 className="vs-h1">
              DialerSeat <span className="versus">vs</span> {c.name}
            </h1>
            <p className="vs-subhead">{c.summary}</p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">GET STARTED</Link>
              <Link href="/vs" className="vs-btn-ghost">ALL COMPARISONS</Link>
            </div>
          </div>
        </header>

        {/* ── THE FACTS, SIDE BY SIDE ───────────────────────────────────── */}
        <section className="vs-section">
          <div className="vs-section-eyebrow">THE SHORT VERSION</div>
          <h2 className="vs-section-h2">What each one costs and what you get</h2>
          <p className="vs-section-lede">
            Both columns are stated the way each vendor states them. Where {c.name} prices
            by quote, that is said rather than guessed at.
          </p>

          <div className="vs-grid">
            <div className="vs-card">
              <h3>DialerSeat</h3>
              <div className="role">OUR PRODUCT</div>
              <div className="fact-row">
                <div className="fact-label">PRICING</div>
                <div className="fact-value">{DIALERSEAT.pricing}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">CONTRACT</div>
                <div className="fact-value">{DIALERSEAT.contract}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">DIALING</div>
                <div className="fact-value">{DIALERSEAT.dialing}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">ADDING A SEAT</div>
                <div className="fact-value">{DIALERSEAT.team.addingASeat}</div>
              </div>
            </div>

            <div className="vs-card">
              <h3>{c.name}</h3>
              <div className="role">COMPETITOR</div>
              <div className="fact-row">
                <div className="fact-label">PRICING</div>
                <div className="fact-value">{c.pricing}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">CONTRACT</div>
                <div className="fact-value">{c.contract}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">DIALING</div>
                <div className="fact-value">{c.dialing}</div>
              </div>
              <div className="fact-row">
                <div className="fact-label">ADDING A SEAT</div>
                <div className="fact-value">{c.team.addingASeat}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURE BY FEATURE ────────────────────────────────────────
            Only rendered for competitors that HAVE a matrix. The eight pages
            that were data-driven from the start never had one, and inventing
            296 rows to make them symmetrical would mean publishing claims
            about other companies' products that nobody researched. A missing
            table is honest; a fabricated one is not. */}
        {matrix && (
          <section className="vs-section" style={{ paddingTop: 0 }}>
            <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
            <h2 className="vs-section-h2">Where each tool wins.</h2>
            <p className="vs-section-lede">{matrix.lede}</p>

            <div style={{ overflowX: 'auto' }}>
              <table className="feature-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>DialerSeat</th>
                    <th>{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((f, i) => (
                    <tr key={i}>
                      <td>{f.feature}</td>
                      <td className="ds-cell">
                        {f.dialerseat === true ? <span className="yes">✓</span>
                          : f.dialerseat === false ? <span className="no">✕</span>
                          : <span style={{ color: T.text, fontSize: 12 }}>{f.dialerseat}</span>}
                      </td>
                      <td>
                        {f.competitor === true ? <span className="yes">✓</span>
                          : f.competitor === false ? <span className="no">✕</span>
                          : <span className="partial">{f.competitor}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── WHERE THEY ARE GENUINELY BETTER ───────────────────────────── */}
        <section className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">HONESTLY</div>
          <h2 className="vs-section-h2">Where {c.name} is the better choice</h2>
          <p className="vs-section-lede">
            A comparison where the competitor loses at everything is marketing, and it
            reads like marketing. These are real advantages.
          </p>

          <div className="vs-grid">
            <div className="vs-card">
              <h3 style={{ fontSize: 16 }}>{c.name} does this well</h3>
              <ul className="vs-list good">
                {c.wins.map(w => <li key={w}>{w}</li>)}
              </ul>
            </div>
            <div className="vs-card">
              <h3 style={{ fontSize: 16 }}>Where buyers get caught out</h3>
              <ul className="vs-list warn">
                {c.friction.map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </div>

          <div className="verdict">
            <h3>Who should pick {c.name}</h3>
            <p>{c.bestFor}</p>
            <p>
              If that describes you, take {c.name}. It is a real product with real
              strengths and no comparison page should talk you out of the right tool.
            </p>
          </div>
        </section>

        {/* ── WHERE WE ARE ─────────────────────────────────────────────── */}
        <section className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE OTHER SIDE</div>
          <h2 className="vs-section-h2">Who should pick DialerSeat</h2>
          <p className="vs-section-lede">{DIALERSEAT.bestFor}</p>

          <div className="vs-grid">
            <div className="vs-card">
              <h3 style={{ fontSize: 16 }}>What we do well</h3>
              <ul className="vs-list good">
                {DIALERSEAT.wins.map(w => <li key={w}>{w}</li>)}
              </ul>
            </div>
            <div className="vs-card">
              <h3 style={{ fontSize: 16 }}>Where we fall short</h3>
              <ul className="vs-list warn">
                {DIALERSEAT.friction.map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </div>

          <p className="disclosure">
            DialerSeat publishes this page, so read the DialerSeat column with that in
            mind. Competitor pricing and capability are taken from each vendor&rsquo;s own
            published material and independent review sites at the time of writing, and
            vendors change their pricing without telling us. Check theirs before you
            decide. If something here is out of date or wrong, tell us and we will fix it.
          </p>

          <div className="vs-cta-row" style={{ marginTop: 40, justifyContent: 'flex-start' }}>
            <Link href="/sign-up" className="vs-btn-primary">GET STARTED</Link>
            <Link href="/faq" className="vs-btn-ghost">READ THE FAQ</Link>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  )
}
