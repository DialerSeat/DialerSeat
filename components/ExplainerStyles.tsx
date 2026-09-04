import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

/** Matches components/GutsShell, which now owns the page around this. */
const ROYAL = '#2a6eff'
const EXP_FONT = inter.style.fontFamily




interface Props {
  accent: string
  accentBg: string
}

export default function ExplainerStyles({ accent, accentBg }: Props) {
  return (
    <style>{`
      .exp-root { background: ${SITE.bg}; min-height: 100vh; font-family: 'Futura PT', Futura, sans-serif; color: ${SITE.text}; }
      .exp-root * { box-sizing: border-box; }
      .exp-hero {
        background: linear-gradient(135deg, ${SITE.bg} 0%, ${SITE.surface} 100%);
        color: ${SITE.text}; padding: 80px 32px 64px; text-align: center;
        position: relative; overflow: hidden;
        border-bottom: 2px solid ${SITE.deep};
      }
      .exp-hero::before {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(circle at 30% 30%, ${accent}44 0%, transparent 55%);
      }
      .exp-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
      .exp-breadcrumb {
        display: inline-block; font-size: 11px; letter-spacing: 2px;
        color: ${SITE.muted}; text-decoration: none; margin-bottom: 22px;
      }
      .exp-breadcrumb:hover { color: ${SITE.blue}; }
      .exp-eyebrow {
        display: inline-block; padding: 6px 14px;
        background: ${accent}33; border: 1px solid ${accent};
        border-radius: 4px; color: ${SITE.muted};
        font-size: 11px; letter-spacing: 3px; font-weight: bold;
        margin-bottom: 22px;
      }
      .exp-hero h1 {
        font-size: 44px; font-weight: 800; letter-spacing: -0.5px;
        line-height: 1.1; margin: 0 0 16px 0;
      }
      .exp-lead {
        font-size: 17px; line-height: 1.6; color: ${SITE.muted};
        max-width: 580px; margin: 0 auto;
      }
      .exp-section { max-width: 780px; margin: 0 auto; padding: 56px 32px; }
      .exp-section.alt { background: ${SITE.surface}; max-width: none; padding: 56px 0; }
      .exp-section.alt > .inner { max-width: 780px; margin: 0 auto; padding: 0 32px; }
      .exp-section-label {
        font-size: 10px; letter-spacing: 4px; color: ${SITE.muted};
        font-weight: bold; margin-bottom: 14px;
      }
      .exp-section h2 {
        font-size: 28px; font-weight: 800; letter-spacing: -0.3px;
        line-height: 1.2; margin: 0 0 18px 0; color: ${SITE.text};
      }
      .exp-section h3 {
        font-size: 17px; font-weight: 700; margin: 24px 0 8px 0;
        color: ${SITE.text};
      }
      .exp-section p {
        font-size: 16px; line-height: 1.75; color: ${SITE.muted};
        margin: 0 0 14px 0;
      }
      .exp-pullquote {
        margin: 24px 0; padding: 20px 24px; background: ${SITE.surface};
        border-left: 3px solid ${accent}; border-radius: 4px;
        font-size: 15px; line-height: 1.7; color: ${SITE.muted};
      }
      .exp-cards {
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 14px; margin-top: 24px;
      }
      .exp-card {
        padding: 20px 22px; background: ${SITE.surface};
        border: 1px solid ${SITE.border}; border-left: 3px solid ${accent};
        border-radius: 4px;
      }
      .exp-card h3 {
        font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
        margin: 0 0 8px 0; color: ${accent};
      }
      .exp-card p { font-size: 13px; line-height: 1.6; color: ${SITE.muted}; margin: 0; }
      .exp-deepdive {
        display: flex; align-items: center; justify-content: space-between;
        gap: 24px; padding: 24px 28px; background: ${SITE.surface};
        border: 1px solid ${SITE.border}; border-left: 3px solid ${accent};
        border-radius: 4px;
      }
      .exp-deepdive h3 {
        font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: ${SITE.text};
      }
      .exp-deepdive p {
        font-size: 14px; line-height: 1.6; color: ${SITE.muted}; margin: 0;
      }
      .exp-deepdive-btn {
        padding: 12px 22px; background: ${SITE.bg}; color: ${SITE.blue};
        font-size: 11px; letter-spacing: 2.5px; font-weight: bold;
        border-radius: 4px; text-decoration: none; flex-shrink: 0;
        border-top: 3px solid ${accent};
      }
      .exp-qa { margin-top: 24px; }
      .exp-qa details {
        background: ${SITE.surface}; border: 1px solid ${SITE.border};
        border-radius: 4px; margin-bottom: 10px; overflow: hidden;
      }
      .exp-qa details[open] { border-color: ${accent}; }
      .exp-qa summary {
        padding: 18px 22px; font-size: 15px; font-weight: 700;
        color: ${SITE.text}; cursor: pointer; list-style: none;
        display: flex; justify-content: space-between; align-items: center; gap: 16px;
      }
      .exp-qa summary::-webkit-details-marker { display: none; }
      .exp-qa summary::after {
        content: '+'; color: ${accent}; font-size: 22px;
        font-weight: bold; flex-shrink: 0; line-height: 1;
      }
      .exp-qa details[open] summary::after { content: '−'; }
      .exp-qa .answer {
        padding: 0 22px 20px; font-size: 14px; line-height: 1.75;
        color: ${SITE.muted};
      }
      .exp-qa .answer p { margin: 0 0 10px 0; }
      .exp-qa .answer p:last-child { margin-bottom: 0; }
      .exp-qa .answer a {
        color: ${accent}; text-decoration: none;
        border-bottom: 1px dotted ${accent};
      }

      @media (max-width: 768px) {
        .exp-hero { padding: 56px 20px 48px; }
        .exp-hero h1 { font-size: 30px; }
        .exp-lead { font-size: 14px; }
        .exp-section { padding: 40px 20px; }
        .exp-section.alt > .inner { padding: 0 20px; }
        .exp-section h2 { font-size: 22px; }
        .exp-cards { grid-template-columns: 1fr; }
        .exp-deepdive { flex-direction: column; align-items: flex-start; padding: 20px; }
        .exp-deepdive-btn { width: 100%; text-align: center; }
      }

      /* =====================================================================
         INSIDE THE ARTICLE CARD
         =====================================================================
         Written for a page that WAS the article column: its own background,
         its own min-height, its own centered 780px measure. components/GutsShell
         owns all three now, so those rules are unwound here and the sections
         become the blueprint's centered, hairline-separated blocks.
         ===================================================================== */
      .exp-root {
        background: transparent;
        min-height: 0;
        font-family: ${EXP_FONT};
        padding: 0;
      }
      .exp-hero {
        background: transparent;
        padding: 52px 48px 44px;
        border-bottom: 1px solid ${SITE.borderSoft};
      }
      .exp-hero::before { display: none; }
      .exp-hero h1 {
        font-size: 42px; letter-spacing: -1.4px; line-height: 1.08; font-weight: 800;
      }
      .exp-breadcrumb { display: none; }
      .exp-section, .exp-section.alt {
        max-width: none;
        margin: 0;
        padding: 44px 48px;
        border-bottom: 1px solid ${SITE.borderSoft};
        text-align: center;
        background: transparent;
      }
      .exp-section:last-of-type { border-bottom: none; }
      .exp-section.alt > .inner { max-width: none; padding: 0; }
      .exp-section h2 {
        font-size: 27px; letter-spacing: -0.6px; line-height: 1.2; font-weight: 800;
      }

      /* Centered column, left-aligned prose. The section composition stays
         centered; the paragraphs inside it do not, because centered body text
         past about three lines makes the eye hunt for each line start instead
         of returning to a fixed left edge. See components/GutsShell. */
      .exp-section p { margin-left: auto; margin-right: auto; max-width: 660px; text-align: left; }
      .exp-hero .exp-lead, .exp-hero p { text-align: center; }
      .exp-section a { color: ${ROYAL}; font-weight: 600; }
      /* Scanned rather than read: back to left inside the centered section. */
      .exp-cards, .exp-card, .exp-qa, .exp-deepdive, .exp-pullquote,
      .exp-section ul, .exp-section ol, .exp-section table { text-align: left; }

      @media (max-width: 700px) {
        .exp-hero { padding: 34px 22px 30px; }
        .exp-hero h1 { font-size: 29px; letter-spacing: -0.8px; }
        .exp-section, .exp-section.alt { padding: 32px 22px; }
        .exp-section h2 { font-size: 22px; }
      }
    `}</style>
  )
}
