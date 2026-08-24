'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'
import { DIALERSEAT, type Competitor } from '@/lib/competitors'

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
// The bespoke pages are deliberately left alone. They rank, they carry
// hand-written detail that does not fit a schema, and rewriting a page that
// works to satisfy a consistency instinct is not an improvement.
// =============================================================================

const T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  blue: '#4a9eff',
  green: '#4ade80',
  amber: '#fbbf24',
}

export default function VsCompetitorView({ c }: { c: Competitor }) {
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
          .vs-hero {
            background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
            color: white;
            padding: 80px 32px 100px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .vs-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 30% 30%, rgba(74,158,255,0.15) 0%, transparent 50%);
          }
          .vs-hero-inner { position: relative; max-width: 880px; margin: 0 auto; }
          .vs-eyebrow {
            display: inline-block;
            padding: 6px 14px;
            background: rgba(74,158,255,0.15);
            border: 1px solid ${T.blue};
            border-radius: 4px;
            color: ${T.blue};
            font-size: 11px;
            letter-spacing: 3px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .vs-h1 {
            font-size: 56px;
            letter-spacing: -1px;
            line-height: 1.05;
            font-weight: 800;
            margin: 0 0 20px 0;
          }
          .vs-h1 .versus { color: ${T.blue}; }
          .vs-subhead {
            font-size: 19px;
            line-height: 1.55;
            color: #c4c8d8;
            max-width: 720px;
            margin: 0 auto 36px;
          }
          .vs-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          .vs-btn-primary {
            padding: 16px 32px;
            background: linear-gradient(135deg, ${T.blue}, #2a6eff);
            color: white;
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 0 24px rgba(74,158,255,0.4);
          }
          .vs-btn-ghost {
            padding: 16px 32px;
            border: 1px solid ${T.border};
            color: ${T.text};
            font-size: 13px;
            letter-spacing: 2.5px;
            font-weight: bold;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
          }
          .vs-section { max-width: 1080px; margin: 0 auto; padding: 72px 32px; }
          .vs-section-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 12px; }
          .vs-section-h2 { font-size: 36px; letter-spacing: -0.5px; line-height: 1.15; font-weight: 800; margin: 0 0 16px 0; color: ${T.text}; }
          .vs-section-lede { font-size: 16px; color: ${T.muted}; line-height: 1.65; max-width: 720px; margin: 0 0 40px 0; }
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
              <Link href="/sign-up" className="vs-btn-primary">START 7 DAYS FREE</Link>
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
            <Link href="/sign-up" className="vs-btn-primary">START 7 DAYS FREE</Link>
            <Link href="/faq" className="vs-btn-ghost">READ THE FAQ</Link>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  )
}
