// Shared <style> block for /faq/* explainer pages.
// Server-renderable. Pass per-page accent color + accent-bg for the
// eyebrow chip, cards, and pullquote borders.

interface Props {
  accent: string
  accentBg: string
}

export default function ExplainerStyles({ accent, accentBg }: Props) {
  return (
    <style>{`
      .exp-root { background: #f0f1f4; min-height: 100vh; font-family: 'Futura PT', Futura, sans-serif; color: #1a1c24; }
      .exp-root * { box-sizing: border-box; }
      .exp-hero {
        background: linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%);
        color: white; padding: 80px 32px 64px; text-align: center;
        position: relative; overflow: hidden;
      }
      .exp-hero::before {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(circle at 30% 30%, ${accent}44 0%, transparent 55%);
      }
      .exp-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
      .exp-breadcrumb {
        display: inline-block; font-size: 11px; letter-spacing: 2px;
        color: #8888aa; text-decoration: none; margin-bottom: 22px;
      }
      .exp-breadcrumb:hover { color: #4a9eff; }
      .exp-eyebrow {
        display: inline-block; padding: 6px 14px;
        background: ${accent}33; border: 1px solid ${accent};
        border-radius: 4px; color: #c4c8d0;
        font-size: 11px; letter-spacing: 3px; font-weight: bold;
        margin-bottom: 22px;
      }
      .exp-hero h1 {
        font-size: 44px; font-weight: 800; letter-spacing: -0.5px;
        line-height: 1.1; margin: 0 0 16px 0;
      }
      .exp-lead {
        font-size: 17px; line-height: 1.6; color: #c4c8d8;
        max-width: 580px; margin: 0 auto;
      }
      .exp-section { max-width: 780px; margin: 0 auto; padding: 56px 32px; }
      .exp-section.alt { background: white; max-width: none; padding: 56px 0; }
      .exp-section.alt > .inner { max-width: 780px; margin: 0 auto; padding: 0 32px; }
      .exp-section-label {
        font-size: 10px; letter-spacing: 4px; color: #5a5e6a;
        font-weight: bold; margin-bottom: 14px;
      }
      .exp-section h2 {
        font-size: 28px; font-weight: 800; letter-spacing: -0.3px;
        line-height: 1.2; margin: 0 0 18px 0;
      }
      .exp-section h3 {
        font-size: 17px; font-weight: 700; margin: 24px 0 8px 0;
        color: #1a1c24;
      }
      .exp-section p {
        font-size: 16px; line-height: 1.75; color: #2c3038;
        margin: 0 0 14px 0;
      }
      .exp-pullquote {
        margin: 24px 0; padding: 20px 24px; background: ${accentBg};
        border-left: 3px solid ${accent}; border-radius: 4px;
        font-size: 15px; line-height: 1.7; color: #1a1c24;
      }
      .exp-cards {
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 14px; margin-top: 24px;
      }
      .exp-card {
        padding: 20px 22px; background: ${accentBg};
        border: 1px solid #e4e6ec; border-left: 3px solid ${accent};
        border-radius: 8px;
      }
      .exp-card h3 {
        font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
        margin: 0 0 8px 0; color: ${accent};
      }
      .exp-card p { font-size: 13px; line-height: 1.6; color: #1a1c24; margin: 0; }
      .exp-deepdive {
        display: flex; align-items: center; justify-content: space-between;
        gap: 24px; padding: 24px 28px; background: ${accentBg};
        border: 1px solid #e4e6ec; border-left: 3px solid ${accent};
        border-radius: 10px;
      }
      .exp-deepdive h3 {
        font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #1a1c24;
      }
      .exp-deepdive p {
        font-size: 14px; line-height: 1.6; color: #2c3038; margin: 0;
      }
      .exp-deepdive-btn {
        padding: 12px 22px; background: #1a1a2e; color: #4a9eff;
        font-size: 11px; letter-spacing: 2.5px; font-weight: bold;
        border-radius: 8px; text-decoration: none; flex-shrink: 0;
        border-top: 3px solid ${accent};
      }
      .exp-qa { margin-top: 24px; }
      .exp-qa details {
        background: white; border: 1px solid #c4c8d0;
        border-radius: 8px; margin-bottom: 10px; overflow: hidden;
      }
      .exp-qa details[open] { border-color: ${accent}; }
      .exp-qa summary {
        padding: 18px 22px; font-size: 15px; font-weight: 700;
        color: #1a1c24; cursor: pointer; list-style: none;
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
        color: #1a1c24;
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
    `}</style>
  )
}