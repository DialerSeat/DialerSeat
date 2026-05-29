import Link from 'next/link'

// Bottom-of-page cross-link grid linking the seven explainer pages together.
// The `current` page is dimmed and non-clickable so visitors aren't sent
// back to the page they're already on.
//
// `compliance-why` → /faq/why-is-compliance-important (the rationale)
// `compliance-how` → /faq/how-we-keep-compliance     (the mechanisms)

type Explainer = 'preview' | 'power' | 'progressive' | 'predictive' | 'compliance-why' | 'compliance-how' | 'amd'

interface Props {
  current: Explainer
}

export default function ExplainerCrossLinks({ current }: Props) {
  return (
    <>
      <style>{`
        .exp-xlinks { background: #f0f1f4; padding: 56px 32px; }
        .exp-xlinks-inner { max-width: 980px; margin: 0 auto; }
        .exp-xlinks h2 {
          font-size: 18px; font-weight: 800; margin: 0 0 18px 0;
          text-align: center; color: #1a1c24;
        }
        .exp-xlinks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .exp-xlink {
          padding: 16px 18px; background: white;
          border: 1px solid #d8dce4; border-radius: 8px;
          text-decoration: none; color: #1a1c24;
          font-size: 13px; line-height: 1.4; font-weight: 600;
          transition: transform 0.12s;
        }
        .exp-xlink:hover { transform: translateY(-2px); }
        .exp-xlink.current { opacity: 0.45; pointer-events: none; }
        .exp-xlink .pill {
          display: inline-block; font-size: 9px; letter-spacing: 2px;
          font-weight: bold; padding: 2px 7px; border-radius: 3px;
          margin-bottom: 6px;
        }
        .exp-xlink.preview .pill { background: #f0f0f4; color: #5a5e6a; border: 1px solid #5a5e6a; }
        .exp-xlink.power .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }
        .exp-xlink.progressive .pill { background: #e8f5e8; color: #1a6a1a; border: 1px solid #1a6a1a; }
        .exp-xlink.predictive .pill { background: #f8e8e8; color: #8a1a1a; border: 1px solid #8a1a1a; }
        .exp-xlink.compliance-why .pill { background: #fdf4e8; color: #8a6a1a; border: 1px solid #8a6a1a; }
        .exp-xlink.compliance-how .pill { background: #fdf4e8; color: #8a6a1a; border: 1px solid #8a6a1a; }
        .exp-xlink.amd .pill { background: #e8eef8; color: #2a4a8a; border: 1px solid #2a4a8a; }

        @media (max-width: 768px) {
          .exp-xlinks { padding: 40px 20px; }
          .exp-xlinks-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="exp-xlinks">
        <div className="exp-xlinks-inner">
          <h2>Other explainers</h2>
          <div className="exp-xlinks-grid">
            <Link href="/faq/what-is-a-preview-dialer" className={`exp-xlink preview ${current === 'preview' ? 'current' : ''}`}>
              <span className="pill">PREVIEW</span>
              <div>What is a preview dialer?</div>
            </Link>
            <Link href="/faq/what-is-a-power-dialer" className={`exp-xlink power ${current === 'power' ? 'current' : ''}`}>
              <span className="pill">POWER</span>
              <div>What is a power dialer?</div>
            </Link>
            <Link href="/faq/what-is-a-progressive-dialer" className={`exp-xlink progressive ${current === 'progressive' ? 'current' : ''}`}>
              <span className="pill">PROGRESSIVE</span>
              <div>What is a progressive dialer?</div>
            </Link>
            <Link href="/faq/what-is-a-predictive-dialer" className={`exp-xlink predictive ${current === 'predictive' ? 'current' : ''}`}>
              <span className="pill">PREDICTIVE</span>
              <div>What is a predictive dialer?</div>
            </Link>
            <Link href="/faq/why-is-compliance-important" className={`exp-xlink compliance-why ${current === 'compliance-why' ? 'current' : ''}`}>
              <span className="pill">COMPLIANCE · WHY</span>
              <div>Why is compliance important?</div>
            </Link>
            <Link href="/faq/how-we-keep-compliance" className={`exp-xlink compliance-how ${current === 'compliance-how' ? 'current' : ''}`}>
              <span className="pill">COMPLIANCE · HOW</span>
              <div>How we keep compliance.</div>
            </Link>
            <Link href="/faq/how-does-amd-work" className={`exp-xlink amd ${current === 'amd' ? 'current' : ''}`}>
              <span className="pill">AMD</span>
              <div>How does AMD work?</div>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}