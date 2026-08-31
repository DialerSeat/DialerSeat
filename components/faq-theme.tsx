'use client'

// =============================================================================
// ONE VISUAL LANGUAGE FOR EVERY /faq ARTICLE
// =============================================================================
// Fourteen FAQ pages, fourteen private stylesheets, 404 distinct class names
// between them and — measured — only THREE css lines common to all fourteen.
// There was no shared style to extract, which is why the first attempt at this
// was abandoned: extraction assumes commonality that did not exist.
//
// So this is not an extraction, it is a canonical vocabulary. It deliberately
// mirrors components/vs-competitor-view.tsx — same palette, same hero rhythm,
// same section spacing, same card and table treatment — so that a reader moving
// between /vs/readymode and /faq/leads sees one product rather than two.
//
// WHAT THIS IS NOT. It is not a layout component and it does not own page
// structure. FAQ pages run from three sections to ten and 331 to 999 lines,
// and a schema wide enough to express all of them would BE the page, with worse
// ergonomics. Each page keeps its own JSX. This supplies the chrome those
// elements are painted with.
//
// TO MIGRATE A PAGE: drop its <style> block, render <FaqTheme />, and rename
// its private prefix onto the vocabulary below. See docs/vs-and-faq-pages.md.
// =============================================================================

/** Shared with vs-competitor-view.tsx. Changing a value here changes it there. */
export const FAQ_T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  surface2: '#2a2a4a',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  blue: '#4a9eff',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
}

const T = FAQ_T

export default function FaqTheme() {
  return (
    <style>{`
      .faq-root * { box-sizing: border-box; }

      /* ── ARTICLE COLUMN ──────────────────────────────────────────────
         Narrower than /vs on purpose. A comparison page is a table the eye
         scans across; an answer is prose the eye reads down, and prose past
         roughly 75 characters a line is measurably harder to track. */
      .faq-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }

      .faq-eyebrow {
        font-size: 11px; letter-spacing: 4px; color: ${T.muted};
        font-weight: bold; margin-bottom: 14px; text-transform: uppercase;
      }
      .faq-h1 {
        font-size: 44px; line-height: 1.1; letter-spacing: -0.5px;
        font-weight: 800; margin: 0 0 18px 0; color: ${T.text};
      }
      .faq-deck {
        font-size: 18px; line-height: 1.65; color: ${T.muted};
        margin: 0 0 48px 0;
      }

      /* ── SECTIONS ────────────────────────────────────────────────────
         Same vertical rhythm as .vs-section so the two page types feel like
         one site rather than two templates that happen to share a palette. */
      .faq-section { margin: 0 0 56px 0; }
      .faq-section-eyebrow {
        font-size: 11px; letter-spacing: 4px; color: ${T.muted};
        font-weight: bold; margin-bottom: 12px;
      }
      .faq-h2 {
        font-size: 30px; line-height: 1.2; letter-spacing: -0.3px;
        font-weight: 800; margin: 0 0 14px 0; color: ${T.text};
      }
      .faq-h3 {
        font-size: 19px; font-weight: 700; margin: 28px 0 10px 0; color: ${T.text};
      }
      .faq-p {
        font-size: 16px; line-height: 1.75; color: ${T.muted}; margin: 0 0 16px 0;
      }
      .faq-p strong { color: ${T.text}; font-weight: 700; }
      .faq-p a, .faq-link { color: ${T.blue}; text-decoration: none; }
      .faq-p a:hover, .faq-link:hover { text-decoration: underline; }

      /* ── LISTS ───────────────────────────────────────────────────────── */
      .faq-list { list-style: none; padding: 0; margin: 0 0 20px 0; }
      .faq-list li {
        position: relative; padding: 0 0 0 22px; margin-bottom: 10px;
        font-size: 15.5px; line-height: 1.7; color: ${T.muted};
      }
      .faq-list li::before {
        content: '–'; position: absolute; left: 0; color: ${T.blue}; font-weight: bold;
      }
      .faq-list li strong { color: ${T.text}; }

      /* ── CARD ────────────────────────────────────────────────────────── */
      .faq-card {
        background: ${T.surface}; border: 1px solid ${T.border};
        border-radius: 4px; padding: 24px; margin: 0 0 20px 0;
      }
      .faq-card-title {
        font-size: 17px; font-weight: 800; color: ${T.text}; margin: 0 0 8px 0;
      }
      .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

      /* ── CALLOUT ──────────────────────────────────────────────────────
         The left border carries the meaning, so the tone modifiers change
         only that and nothing else. */
      .faq-callout {
        background: ${T.surface}; border: 1px solid ${T.border};
        border-left: 3px solid ${T.blue}; border-radius: 4px;
        padding: 18px 22px; margin: 0 0 24px 0;
        font-size: 15px; line-height: 1.7; color: ${T.muted};
      }
      .faq-callout strong { color: ${T.text}; }
      .faq-callout.warn { border-left-color: ${T.amber}; }
      .faq-callout.good { border-left-color: ${T.green}; }
      .faq-callout.bad  { border-left-color: ${T.red}; }

      /* ── TABLE ──────────────────────────────────────────────────────
         Identical treatment to .feature-table on /vs. */
      .faq-table {
        width: 100%; border-collapse: collapse; background: ${T.surface};
        border: 1px solid ${T.border}; border-radius: 4px; overflow: hidden;
        margin: 0 0 24px 0;
      }
      .faq-table th {
        padding: 14px 18px; background: ${T.dark}; color: ${T.text};
        font-size: 11px; letter-spacing: 2px; text-align: left; font-weight: bold;
      }
      .faq-table td {
        padding: 13px 18px; border-top: 1px solid ${T.border};
        font-size: 14.5px; color: ${T.muted};
      }
      .faq-table td strong { color: ${T.text}; }
      .faq-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }

      /* ── FIELD TABLE ────────────────────────────────────────────────
         A grid rather than a <table>, because these are label/value pairs
         that must collapse to stacked rows on a phone — something a real
         table cell cannot do without fighting it. */
      .faq-fieldtable {
        margin: 20px 0 8px; border: 1px solid ${T.border}; border-radius: 4px;
        overflow: hidden; background: ${T.surface};
      }
      .faq-fieldrow { display: grid; grid-template-columns: 180px 1fr; }
      .faq-fieldrow + .faq-fieldrow { border-top: 1px solid ${T.border}; }
      .faq-fieldrow.head { background: ${T.dark}; }
      .faq-fieldcell { padding: 13px 16px; font-size: 14px; line-height: 1.6; color: ${T.muted}; }
      .faq-fieldcell.name { color: ${T.text}; font-weight: 600; }
      .faq-fieldcell.muted { color: ${T.muted}; }
      .faq-fieldrow.head .faq-fieldcell {
        color: ${T.text}; font-size: 11px; letter-spacing: 2px; font-weight: bold;
      }
      .faq-fieldcell .req { color: ${T.amber}; font-size: 11px; letter-spacing: 1px; }

      /* ── NUMBERED FLOW ───────────────────────────────────────────────── */
      .faq-flow { counter-reset: faqstep; margin: 0 0 24px 0; }
      .faq-flow-step {
        counter-increment: faqstep; position: relative;
        padding: 0 0 22px 46px; border-left: 1px solid ${T.border};
        margin-left: 14px;
      }
      .faq-flow-step:last-child { border-left-color: transparent; padding-bottom: 0; }
      .faq-flow-step::before {
        content: counter(faqstep);
        position: absolute; left: -14px; top: -2px;
        width: 28px; height: 28px; border-radius: 50%;
        background: ${T.surface}; border: 1px solid ${T.blue}; color: ${T.blue};
        font-size: 12px; font-weight: bold;
        display: flex; align-items: center; justify-content: center;
      }
      .faq-flow-title { font-size: 16px; font-weight: 700; color: ${T.text}; margin-bottom: 5px; }
      .faq-flow-body { font-size: 15px; line-height: 1.7; color: ${T.muted}; }

      /* ── BADGES ──────────────────────────────────────────────────────── */
      .faq-badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 20px 0; }
      .faq-badge {
        display: inline-block; padding: 5px 11px; border-radius: 3px;
        background: rgba(74,158,255,0.12); border: 1px solid ${T.blue};
        color: ${T.blue}; font-size: 11px; letter-spacing: 1.5px; font-weight: bold;
      }
      .faq-badge.hi { background: rgba(74,222,128,0.12); border-color: ${T.green}; color: ${T.green}; }

      /* ── CLOSING CTA ─────────────────────────────────────────────────── */
      .faq-cta {
        background: linear-gradient(135deg, ${T.darker} 0%, ${T.dark} 100%);
        border: 1px solid ${T.border}; border-radius: 4px;
        padding: 36px 32px; text-align: center; margin: 56px 0 0 0;
      }
      .faq-cta-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 10px; }
      .faq-cta-h { font-size: 26px; font-weight: 800; color: ${T.text}; margin: 0 0 20px 0; line-height: 1.25; }
      .faq-cta-btn {
        display: inline-block; padding: 14px 30px; border-radius: 4px;
        background: ${T.blue}; color: ${T.darker}; font-weight: 800;
        font-size: 14px; letter-spacing: 1px; text-decoration: none;
      }
      .faq-cta-btn:hover { opacity: 0.9; }

      /* ── RELATED ─────────────────────────────────────────────────────── */
      .faq-related { margin-top: 56px; padding-top: 28px; border-top: 1px solid ${T.border}; }
      .faq-related-title { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 14px; }
      .faq-related-label { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 14px; }
      .faq-related-links { display: flex; flex-direction: column; }
      .faq-related a { display: block; color: ${T.blue}; text-decoration: none; font-size: 15px; padding: 7px 0; }
      .faq-related a:hover { text-decoration: underline; }

      @media (max-width: 768px) {
        .faq-root { padding: 52px 20px 80px; }
        .faq-h1 { font-size: 32px; }
        .faq-deck { font-size: 16px; margin-bottom: 36px; }
        .faq-h2 { font-size: 24px; }
        .faq-section { margin-bottom: 42px; }
        .faq-grid { grid-template-columns: 1fr; }
        .faq-fieldrow { grid-template-columns: 1fr; }
        .faq-fieldrow .faq-fieldcell + .faq-fieldcell { padding-top: 0; }
        .faq-cta { padding: 28px 20px; }
        .faq-cta-h { font-size: 21px; }
      }
    `}</style>
  )
}
