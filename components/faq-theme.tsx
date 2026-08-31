'use client'

import { SITE as T, SITE_TYPE, SITE_SPACE } from '@/lib/siteTheme'

// =============================================================================
// ONE VISUAL LANGUAGE FOR EVERY /faq ARTICLE — TAKEN FROM THE LANDING PAGE
// =============================================================================
// Fourteen FAQ pages, fourteen private stylesheets, 404 distinct class names
// between them and — measured — only THREE css lines common to all fourteen.
// There was nothing to extract, which is why the first attempt at this failed:
// extraction assumes a commonality these pages never had.
//
// So this is a canonical vocabulary, and every value in it comes from
// lib/siteTheme.ts, which was read out of app/page.tsx. The FAQ pages used to
// be dark — #0a0a14 with white type — against a light landing page. Not a
// looser grid or a different accent: the inverse. That is what made the site
// feel like two products, and it is what this reverses.
//
// WHAT THIS IS NOT. It is not a layout component and does not own page
// structure. FAQ pages run 3 to 10 sections and 331 to 999 lines; a schema wide
// enough for all of them would BE the page, with worse ergonomics than JSX.
// Each page keeps its own markup. This supplies the chrome it is painted with.
//
// TO MIGRATE A PAGE: drop its <style> block, render <FaqTheme />, rename its
// private prefix onto the vocabulary below. See docs/vs-and-faq-pages.md.
// =============================================================================

export default function FaqTheme() {
  return (
    <style>{`
      .faq-root * { box-sizing: border-box; }

      /* ── ARTICLE COLUMN ──────────────────────────────────────────────
         Narrower than /vs on purpose. A comparison is a table the eye scans
         across; an answer is prose the eye reads down, and a line much past
         75 characters is measurably harder to track back from. */
      .faq-root {
        max-width: ${SITE_SPACE.articleWidth};
        margin: 0 auto;
        padding: 96px ${SITE_SPACE.sectionX} 120px;
        color: ${T.text};
      }

      .faq-eyebrow {
        font-size: 12px; letter-spacing: 3px; color: ${T.muted};
        font-weight: bold; margin-bottom: 16px; text-transform: uppercase;
      }

      /* ── THE TWO-TONE HEADLINE ───────────────────────────────────────
         The landing page's signature: near-black over deep blue, as in
         "DIAL SMARTER." / "CLOSE FASTER.". Wrapping the second half in
         <span class="alt"> is what makes an article page read as the same
         product rather than a documentation site that borrowed the colours. */
      .faq-h1 {
        font-size: ${SITE_TYPE.articleH1}; line-height: 1.05; letter-spacing: -2px;
        font-weight: bold; margin: 0 0 20px 0; color: ${T.text};
      }
      .faq-h1 .alt { color: ${T.deep}; }
      .faq-deck {
        font-size: 18px; line-height: 1.65; color: ${T.muted};
        margin: 0 0 56px 0; max-width: 680px;
      }

      /* ── SECTIONS ───────────────────────────────────────────────────── */
      .faq-section { margin: 0 0 64px 0; }
      .faq-section-eyebrow {
        font-size: 12px; letter-spacing: 3px; color: ${T.muted};
        font-weight: bold; margin-bottom: 14px; text-transform: uppercase;
      }
      .faq-h2 {
        font-size: ${SITE_TYPE.articleH2}; line-height: 1.15; letter-spacing: -1px;
        font-weight: bold; margin: 0 0 16px 0; color: ${T.text};
      }
      .faq-h2 .alt { color: ${T.deep}; }
      .faq-h3 {
        font-size: ${SITE_TYPE.articleH3}; font-weight: bold; letter-spacing: -0.3px;
        margin: 32px 0 10px 0; color: ${T.text};
      }
      .faq-p {
        font-size: ${SITE_TYPE.body}; line-height: 1.75; color: ${T.muted};
        margin: 0 0 18px 0;
      }
      .faq-p strong { color: ${T.text}; font-weight: bold; }
      .faq-p a, .faq-link { color: ${T.blue}; text-decoration: none; }
      .faq-p a:hover, .faq-link:hover { text-decoration: underline; }

      /* ── BARE ELEMENTS, WHICH IS HOW THESE PAGES ARE ACTUALLY WRITTEN ──
         The FAQ pages use <h2>, <p>, <li>, <code> directly and almost never
         a className. Styling only .faq-h2 / .faq-p would have left every
         heading and paragraph on all thirteen pages unstyled — the rules that
         used to do this job lived in each page's private stylesheet.
         For prose this is the right shape anyway: an author writing an answer
         should not have to class every paragraph. */
      .faq-section h2 {
        font-size: ${SITE_TYPE.articleH2}; line-height: 1.15; letter-spacing: -1px;
        font-weight: bold; margin: 0 0 16px 0; color: ${T.text};
      }
      .faq-section h3 {
        font-size: ${SITE_TYPE.articleH3}; font-weight: bold; letter-spacing: -0.3px;
        margin: 32px 0 10px 0; color: ${T.text};
      }
      .faq-section h4 {
        font-size: 16.5px; font-weight: bold; margin: 24px 0 8px 0; color: ${T.text};
      }
      .faq-section p {
        font-size: ${SITE_TYPE.body}; line-height: 1.75; color: ${T.muted}; margin: 0 0 18px 0;
      }
      .faq-section ul, .faq-section ol { padding-left: 22px; margin: 0 0 20px 0; }
      .faq-section li {
        font-size: 16px; line-height: 1.7; color: ${T.muted}; margin-bottom: 10px;
      }
      .faq-section li::marker { color: ${T.blue}; }
      .faq-section strong { color: ${T.text}; font-weight: bold; }
      .faq-section em { color: ${T.deep}; font-style: normal; font-weight: bold; }
      .faq-section a { color: ${T.blue}; text-decoration: none; }
      .faq-section a:hover { text-decoration: underline; }
      .faq-section code {
        font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13.5px;
        background: rgba(0,0,0,0.05); border: 1px solid ${T.borderSoft};
        border-radius: 3px; padding: 1px 6px; color: ${T.text};
      }
      /* The two-tone headline again, reached the way these pages write it.
         <em> inside an h1 is their accent span, so it gets the deep blue
         rather than italics. */
      .faq-h1 em { color: ${T.deep}; font-style: normal; }
      .faq-callout p { margin: 0 0 10px 0; font-size: 15.5px; line-height: 1.7; }
      .faq-callout p:last-child { margin-bottom: 0; }
      .faq-flow-body h4 { font-size: 16.5px; font-weight: bold; margin: 0 0 5px 0; color: ${T.text}; }

      /* ── GENERIC MODIFIERS AND NESTED PROSE ──────────────────────────
         Pages write <p className="muted"> and put bare <p> inside flow steps
         and CTAs. Those rules lived in each page's private stylesheet and
         died with it, which left the paragraphs inheriting body colour and
         silently losing their hierarchy — the kind of regression that does
         not error, it just reads slightly wrong on thirteen pages. */
      .faq-root p.muted, .faq-section p.muted, .faq-root .muted {
        color: ${T.muted}; font-size: 15px;
      }
      .faq-root .hi { color: ${T.green}; }
      .faq-flow-body p { font-size: 15.5px; line-height: 1.7; margin: 0 0 8px 0; color: ${T.muted}; }
      .faq-flow-body p:last-child { margin-bottom: 0; }
      .faq-cta p {
        font-size: 15.5px; line-height: 1.7; margin: 0 auto 28px;
        max-width: 520px; color: rgba(255,255,255,0.7);
      }
      .faq-cta .muted { color: rgba(255,255,255,0.55); }

      /* ── LISTS ───────────────────────────────────────────────────────── */
      .faq-list { list-style: none; padding: 0; margin: 0 0 22px 0; }
      .faq-list li {
        position: relative; padding: 0 0 0 24px; margin-bottom: 11px;
        font-size: 16px; line-height: 1.7; color: ${T.muted};
      }
      .faq-list li::before {
        content: ''; position: absolute; left: 0; top: 11px;
        width: 8px; height: 2px; background: ${T.blue};
      }
      .faq-list li strong { color: ${T.text}; }

      /* ── CARDS ───────────────────────────────────────────────────────
         White on the page ground, with the landing page's 3px top edge —
         the same treatment its buttons and pricing cards use. */
      .faq-card {
        background: ${T.surface}; border: 1px solid ${T.border};
        border-top: 3px solid ${T.deep}; border-radius: 6px;
        padding: 26px; margin: 0 0 20px 0;
      }
      .faq-card-title {
        font-size: 17px; font-weight: bold; color: ${T.text}; margin: 0 0 8px 0;
      }
      .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

      /* ── CALLOUT ─────────────────────────────────────────────────────
         The left border carries the meaning, so the tone modifiers change
         only that and nothing else. */
      .faq-callout {
        background: ${T.surface}; border: 1px solid ${T.borderSoft};
        border-left: 3px solid ${T.blue}; border-radius: 6px;
        padding: 20px 24px; margin: 0 0 26px 0;
        font-size: 15.5px; line-height: 1.7; color: ${T.muted};
      }
      .faq-callout strong { color: ${T.text}; }
      .faq-callout.warn { border-left-color: ${T.amber}; }
      .faq-callout.good { border-left-color: ${T.green}; }
      .faq-callout.bad  { border-left-color: ${T.red}; }

      /* ── TABLE ──────────────────────────────────────────────────────
         Same treatment as .feature-table on /vs, so the two page types do
         not disagree about what a table looks like. */
      .faq-table {
        width: 100%; border-collapse: collapse; background: ${T.surface};
        border: 1px solid ${T.border}; border-radius: 6px; overflow: hidden;
        margin: 0 0 26px 0;
      }
      .faq-table th {
        padding: 15px 18px; background: ${T.ink}; color: ${T.inkText};
        font-size: 11px; letter-spacing: 2px; text-align: left; font-weight: bold;
      }
      .faq-table td {
        padding: 14px 18px; border-top: 1px solid ${T.borderSoft};
        font-size: 15px; color: ${T.muted};
      }
      .faq-table td strong { color: ${T.text}; }
      .faq-table tr:nth-child(even) td { background: rgba(0,0,0,0.015); }

      /* ── FIELD TABLE ────────────────────────────────────────────────
         A grid rather than a <table>, because these are label/value pairs
         that must collapse to stacked rows on a phone — which a real table
         cell cannot do without a fight. */
      .faq-fieldtable {
        margin: 22px 0 10px; border: 1px solid ${T.border}; border-radius: 6px;
        overflow: hidden; background: ${T.surface};
      }
      .faq-fieldrow { display: grid; grid-template-columns: 190px 1fr; }
      .faq-fieldrow + .faq-fieldrow { border-top: 1px solid ${T.borderSoft}; }
      .faq-fieldrow.head { background: ${T.ink}; }
      .faq-fieldcell { padding: 14px 17px; font-size: 14.5px; line-height: 1.6; color: ${T.muted}; }
      .faq-fieldcell.name { color: ${T.text}; font-weight: bold; }
      .faq-fieldcell.muted { color: ${T.muted}; }
      .faq-fieldrow.head .faq-fieldcell {
        color: ${T.inkText}; font-size: 11px; letter-spacing: 2px; font-weight: bold;
      }
      .faq-fieldcell .req { color: ${T.amber}; font-size: 11px; letter-spacing: 1px; }

      /* ── NUMBERED FLOW ───────────────────────────────────────────────── */
      .faq-flow { counter-reset: faqstep; margin: 0 0 26px 0; }
      .faq-flow-step {
        counter-increment: faqstep; position: relative;
        padding: 0 0 24px 48px; border-left: 1px solid ${T.border};
        margin-left: 15px;
      }
      .faq-flow-step:last-child { border-left-color: transparent; padding-bottom: 0; }
      .faq-flow-step::before {
        content: counter(faqstep);
        position: absolute; left: -15px; top: -2px;
        width: 30px; height: 30px; border-radius: 50%;
        background: ${T.surface}; border: 1px solid ${T.deep}; color: ${T.deep};
        font-size: 12px; font-weight: bold;
        display: flex; align-items: center; justify-content: center;
      }
      .faq-flow-title { font-size: 16.5px; font-weight: bold; color: ${T.text}; margin-bottom: 5px; }
      .faq-flow-body { font-size: 15.5px; line-height: 1.7; color: ${T.muted}; }

      /* ── BADGES ──────────────────────────────────────────────────────── */
      .faq-badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 22px 0; }
      .faq-badge {
        display: inline-block; padding: 6px 12px; border-radius: 4px;
        background: rgba(74,158,255,0.10); border: 1px solid ${T.blue};
        color: ${T.deep}; font-size: 11px; letter-spacing: 1.5px; font-weight: bold;
      }
      .faq-badge.hi {
        background: rgba(26,106,26,0.08); border-color: ${T.green}; color: ${T.green};
      }

      /* ── THREE THINGS ONE PAGE EACH STILL NEEDS ──────────────────────
         Found by auditing every rule the migration dropped rather than by
         noticing them broken later. Each was used by exactly one page, and
         each is generic enough that the second page to want it should not
         have to reinvent it. */

      /* dialerseat-teams: a full-bleed alternating band. White against the
         #f0f1f4 ground gives the banding without a second colour. */
      .faq-section.alt {
        background: ${T.surface};
        max-width: none;
        padding: 56px 0;
        border-top: 1px solid ${T.borderSoft};
        border-bottom: 1px solid ${T.borderSoft};
      }
      .faq-section.alt > .inner { max-width: 820px; margin: 0 auto; padding: 0 32px; }

      /* why-dialerseat: an eyebrow, tighter and wider-tracked than the
         standard one. */
      .faq-section-label {
        font-size: 10px; letter-spacing: 4px; color: ${T.muted};
        font-weight: bold; margin-bottom: 14px; text-transform: uppercase;
      }

      /* manager-plus: the price badge, which wants the ink treatment rather
         than the tinted one every other badge uses. */
      .faq-badge.price {
        background: ${T.ink}; color: ${T.inkText}; border-color: ${T.ink};
      }

      /* ── CLOSING CTA ─────────────────────────────────────────────────
         A dark panel inside a light page — the same exception the landing
         page makes for its stat bar, and the reason the light ground reads
         as chosen rather than default. */
      .faq-cta {
        background: ${T.ink}; border-radius: 8px;
        padding: 44px 36px; text-align: center; margin: 72px 0 0 0;
      }
      .faq-cta-eyebrow {
        font-size: 12px; letter-spacing: 3px; color: rgba(255,255,255,0.55);
        font-weight: bold; margin-bottom: 12px; text-transform: uppercase;
      }
      .faq-cta-h {
        font-size: 30px; font-weight: bold; letter-spacing: -1px;
        color: ${T.inkText}; margin: 0 0 24px 0; line-height: 1.2;
      }
      .faq-cta-h .alt { color: ${T.blue}; }
      .faq-cta-btn {
        display: inline-block; padding: 13px 26px; border-radius: 6px;
        background: transparent; color: ${T.blue}; font-weight: bold;
        font-size: 12px; letter-spacing: 3px; text-decoration: none;
        border: 1px solid ${T.blue}; border-top: 3px solid ${T.blue};
      }
      .faq-cta-btn:hover { background: rgba(74,158,255,0.10); }

      /* ── RELATED ─────────────────────────────────────────────────────── */
      .faq-related { margin-top: 64px; padding-top: 30px; border-top: 1px solid ${T.border}; }
      .faq-related-title, .faq-related-label {
        font-size: 12px; letter-spacing: 3px; color: ${T.muted};
        font-weight: bold; margin-bottom: 16px; text-transform: uppercase;
      }
      .faq-related-links { display: flex; flex-direction: column; }
      .faq-related a { display: block; color: ${T.blue}; text-decoration: none; font-size: 15.5px; padding: 8px 0; }
      .faq-related a:hover { text-decoration: underline; }

      @media (max-width: 768px) {
        .faq-root { padding: 56px ${SITE_SPACE.sectionXMobile} 80px; }
        .faq-h1 { font-size: 34px; letter-spacing: -1px; }
        .faq-deck { font-size: 16px; margin-bottom: 40px; }
        .faq-h2 { font-size: 25px; }
        .faq-section { margin-bottom: 46px; }
        .faq-grid { grid-template-columns: 1fr; }
        .faq-fieldrow { grid-template-columns: 1fr; }
        .faq-fieldrow .faq-fieldcell + .faq-fieldcell { padding-top: 0; }
        .faq-cta { padding: 32px 22px; }
        .faq-cta-h { font-size: 23px; }
      }
    `}</style>
  )
}
