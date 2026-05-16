'use client'
import Link from 'next/link'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  surface2: '#d4d7df',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const features = [
  { feature: 'Public pricing', dialerseat: '$35/week ($140/mo) flat', competitor: '$99 + add-ons stack to $250+' },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'Required Agent Access fee', dialerseat: '$0 (included)', competitor: '+$10/user/mo' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Free trial', dialerseat: '7 days, full access', competitor: '14 days' },
  { feature: 'Annual contract required', dialerseat: false, competitor: false },
  { feature: 'Industry focus', dialerseat: 'Every industry', competitor: 'Real estate primarily' },
  { feature: 'Single-line dialer', dialerseat: true, competitor: true },
  { feature: 'Triple-line dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (true pacing)', dialerseat: true, competitor: false },
  { feature: 'Progressive dialer (auto-advance)', dialerseat: true, competitor: 'Partial' },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (drops in 1.8s)', dialerseat: 'Always on', competitor: 'Optional' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Voicemail drop', dialerseat: true, competitor: true },
  { feature: 'Live call monitoring', dialerseat: true, competitor: false },
  { feature: 'Whisper + barge coaching', dialerseat: true, competitor: false },
  { feature: 'AI call transcription', dialerseat: true, competitor: false },
  { feature: 'AI call summaries', dialerseat: true, competitor: false },
  { feature: 'AI sentiment analysis', dialerseat: true, competitor: false },
  { feature: 'DNC scrubbing on upload', dialerseat: true, competitor: true },
  { feature: 'Local presence dialing', dialerseat: true, competitor: true },
  { feature: 'Spam monitoring + auto-rotation', dialerseat: true, competitor: 'Partial' },
  { feature: 'SMS / A2P 10DLC', dialerseat: true, competitor: false },
  { feature: 'CRM integrations (Salesforce, HubSpot, Pipedrive, Zoho)', dialerseat: true, competitor: 'Follow Up Boss only' },
  { feature: 'Public API + webhooks', dialerseat: true, competitor: false },
  { feature: 'Inbound team numbers', dialerseat: true, competitor: 'Add-on' },
  { feature: 'Real estate data (FSBO, Expired)', dialerseat: false, competitor: '$25–$49/mo add-ons' },
  { feature: 'Skip tracing', dialerseat: 'API integration', competitor: '$49/mo add-on' },
  { feature: 'Calendar-aligned analytics', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
  { feature: 'PWA + native iOS/Android/macOS/Windows apps', dialerseat: true, competitor: 'Mobile web only' },
  { feature: 'TCPA window pre-flight (server-side)', dialerseat: true, competitor: 'Partial' },
  { feature: '99.9% uptime SLA', dialerseat: true, competitor: true },
  { feature: 'SOC 2 Type II', dialerseat: true, competitor: false },
]

export default function VsMojoView() {
  return (
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
          background: radial-gradient(circle at 70% 30%, rgba(74,158,255,0.15) 0%, transparent 50%);
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
        .vs-cta-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
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
        .vs-btn-secondary {
          padding: 16px 32px;
          background: transparent;
          color: white;
          font-size: 13px;
          letter-spacing: 2.5px;
          font-weight: bold;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.3);
          text-decoration: none;
          display: inline-block;
        }
        .vs-section { max-width: 1080px; margin: 0 auto; padding: 80px 32px; }
        .vs-section-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 12px; }
        .vs-section-h2 {
          font-size: 36px;
          letter-spacing: -0.5px;
          line-height: 1.15;
          font-weight: 800;
          margin: 0 0 16px 0;
          color: ${T.text};
        }
        .vs-section-lede {
          font-size: 16px;
          color: ${T.muted};
          line-height: 1.65;
          max-width: 720px;
          margin: 0 0 48px 0;
        }
        .verdict-card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 48px;
          border-left: 4px solid ${T.blue};
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .verdict-title { font-size: 14px; font-weight: bold; letter-spacing: 3px; color: ${T.blue}; margin-bottom: 12px; }
        .verdict-text { font-size: 17px; line-height: 1.7; color: ${T.text}; margin: 0; }
        .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .price-card {
          padding: 32px;
          border-radius: 12px;
          background: white;
          border: 1px solid ${T.border};
          position: relative;
        }
        .price-card.winner {
          border: 2px solid ${T.blue};
          box-shadow: 0 8px 32px rgba(74,158,255,0.12);
        }
        .price-card-label { font-size: 11px; letter-spacing: 3px; font-weight: bold; color: ${T.muted}; margin-bottom: 8px; }
        .price-card.winner .price-card-label { color: ${T.blue}; }
        .price-card-name { font-size: 24px; font-weight: 800; color: ${T.text}; margin-bottom: 16px; }
        .price-card-big { font-size: 44px; font-weight: 800; letter-spacing: -1px; color: ${T.text}; line-height: 1; }
        .price-card-suffix { font-size: 14px; color: ${T.muted}; margin-left: 4px; letter-spacing: 1px; }
        .price-card-monthly { margin-top: 8px; font-size: 13px; color: ${T.muted}; letter-spacing: 0.5px; }
        .price-card-list {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid ${T.border};
          list-style: none;
          padding-left: 0;
        }
        .price-card-list li {
          padding: 6px 0;
          font-size: 13px;
          color: ${T.text};
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .price-card-list li.bad { color: ${T.muted}; }
        .check, .cross { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; }
        .check { color: ${T.green}; }
        .cross { color: ${T.red}; }
        .feature-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid ${T.border};
          margin-top: 24px;
        }
        .feature-table th {
          padding: 16px 20px;
          background: ${T.dark};
          color: white;
          font-size: 11px;
          letter-spacing: 2px;
          text-align: left;
          font-weight: bold;
        }
        .feature-table th:nth-child(2), .feature-table th:nth-child(3) { text-align: center; width: 18%; }
        .feature-table td {
          padding: 14px 20px;
          border-top: 1px solid ${T.border};
          font-size: 14px;
        }
        .feature-table td:nth-child(2), .feature-table td:nth-child(3) { text-align: center; font-weight: bold; }
        .feature-table tr:nth-child(even) td { background: ${T.bg}; }
        .feature-table .yes { color: ${T.green}; font-size: 18px; }
        .feature-table .no { color: ${T.red}; font-size: 18px; }
        .feature-table .partial { color: ${T.amber}; font-style: italic; font-size: 12px; }
        .feature-table .ds-cell { background: rgba(74,158,255,0.04) !important; }
        .win-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 24px; }
        .win-card {
          padding: 28px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          border-left: 4px solid ${T.green};
        }
        .win-card-title { font-size: 17px; font-weight: 800; color: ${T.text}; margin-bottom: 10px; }
        .win-card-body { font-size: 14px; line-height: 1.65; color: ${T.muted}; margin: 0; }
        .honest-gap {
          background: rgba(138,106,26,0.05);
          border: 1px solid rgba(138,106,26,0.3);
          border-radius: 12px;
          padding: 28px;
          margin-top: 24px;
        }
        .decision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
        .decision-card { padding: 28px; background: white; border: 1px solid ${T.border}; border-radius: 12px; }
        .decision-card.ours { border-top: 4px solid ${T.blue}; }
        .decision-card.theirs { border-top: 4px solid ${T.muted}; }
        .decision-card-title { font-size: 11px; letter-spacing: 3px; font-weight: bold; color: ${T.muted}; margin-bottom: 16px; }
        .decision-card.ours .decision-card-title { color: ${T.blue}; }
        .decision-card-h3 { font-size: 22px; font-weight: 800; color: ${T.text}; margin-bottom: 16px; }
        .decision-list { list-style: none; padding: 0; margin: 0; }
        .decision-list li { padding: 8px 0; font-size: 14px; color: ${T.text}; line-height: 1.5; display: flex; gap: 10px; }
        .vs-final-cta {
          background: linear-gradient(135deg, ${T.dark}, ${T.darker});
          color: white;
          padding: 80px 32px;
          text-align: center;
        }
        .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
        .vs-final-cta-h2 {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 0 16px 0;
          line-height: 1.15;
        }
        .vs-final-cta-p {
          font-size: 17px;
          color: #c4c8d8;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }
        .vs-incentive-strip {
          background: rgba(74,158,255,0.06);
          border: 1px dashed rgba(74,158,255,0.4);
          border-radius: 8px;
          padding: 20px 24px;
          margin: 40px 0;
          font-size: 14px;
          color: ${T.text};
          line-height: 1.6;
        }
        .vs-incentive-strip strong { color: ${T.blue}; letter-spacing: 1px; }
        .cost-breakdown {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }
        .cost-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px dashed ${T.border};
          font-size: 14px;
        }
        .cost-row:last-child {
          border-bottom: none;
          border-top: 2px solid ${T.text};
          margin-top: 6px;
          font-weight: 800;
          font-size: 17px;
          padding-top: 14px;
        }
        .cost-row .item { color: ${T.text}; }
        .cost-row .price { color: ${T.muted}; font-family: monospace; }

        @media (max-width: 768px) {
          .vs-hero { padding: 56px 20px 64px; }
          .vs-h1 { font-size: 36px; }
          .vs-subhead { font-size: 16px; }
          .vs-section { padding: 56px 20px; }
          .vs-section-h2 { font-size: 28px; }
          .price-grid, .win-grid, .decision-grid { grid-template-columns: 1fr; }
          .feature-table th, .feature-table td { padding: 10px 12px; font-size: 12px; }
          .vs-final-cta { padding: 56px 20px; }
          .vs-final-cta-h2 { font-size: 30px; }
          .vs-btn-primary, .vs-btn-secondary { width: 100%; }
        }
      `}</style>

      <div className="vs-hero">
        <div className="vs-hero-inner">
          <div className="vs-eyebrow">DIALERSEAT VS MOJO DIALER</div>
          <h1 className="vs-h1">
            Mojo charges à la carte.<br />
            <span className="versus">We charge once. Weekly.</span>
          </h1>
          <p className="vs-subhead">
            Same triple-line speed. Same DNC scrubbing. Same voicemail drop. At
            <strong> just $35/week</strong> ($140/mo) — without the $10/mo Agent Access fee, the
            $49 skip tracer add-on, the $49 pre-foreclosure add-on, the $25/county FSBO data
            add-on. And without being locked into real estate. Every industry, every team size,
            one flat weekly price.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">SEE PLANS</Link>
          </div>
        </div>
      </div>

      <div className="vs-section">
        <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
        <h2 className="vs-section-h2">Mojo is great. If you're a real estate agent. With a budget for add-ons.</h2>
        <p className="vs-section-lede">
          Mojo built the best triple-line dialer for real estate prospecting. They've earned that
          reputation. But the moment you need anything outside their core — CRM integrations,
          live coaching, AI summaries, modern UI, or anything for an industry other than real
          estate — you start paying add-ons that double the bill. We just charge $35/week. Done.
        </p>

        <div className="verdict-card">
          <div className="verdict-title">▸ BOTTOM LINE</div>
          <p className="verdict-text">
            <strong>Pick DialerSeat</strong> if you want all features in one flat $35/week price
            across any industry, with modern software and full CRM integrations.{' '}
            <strong>Pick Mojo</strong> if you're a real estate solo agent who lives in expired
            listings and FSBOs and only needs a fast triple-line dialer.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">THE REAL COST OF MOJO</div>
        <h2 className="vs-section-h2">$139 advertised. $250+ in practice.</h2>
        <p className="vs-section-lede">
          Mojo's pricing is à la carte. The headline number is misleading — most teams spend
          80–150% more once they assemble a functional package. Here's what a real Mojo bill looks
          like for one agent doing real estate prospecting:
        </p>

        <div className="cost-breakdown">
          <div className="cost-row"><span className="item">Triple Line Dialer license</span><span className="price">$139.00/mo</span></div>
          <div className="cost-row"><span className="item">Required Agent Access fee</span><span className="price">$10.00/mo</span></div>
          <div className="cost-row"><span className="item">FSBO Data (2 counties × $25)</span><span className="price">$50.00/mo</span></div>
          <div className="cost-row"><span className="item">Pre-Foreclosure data add-on</span><span className="price">$49.00/mo</span></div>
          <div className="cost-row"><span className="item">Skip Tracer add-on</span><span className="price">$49.00/mo</span></div>
          <div className="cost-row"><span className="item">Neighborhood Search add-on</span><span className="price">$49.00/mo</span></div>
          <div className="cost-row"><span className="item">Real Mojo total per agent</span><span className="price">$346.00/mo</span></div>
        </div>

        <div className="price-grid" style={{ marginTop: 32 }}>
          <div className="price-card winner">
            <div className="price-card-label">DIALERSEAT</div>
            <div className="price-card-name">All features included</div>
            <div>
              <span className="price-card-big">$35</span>
              <span className="price-card-suffix">/seat/week</span>
            </div>
            <div className="price-card-monthly">≈ $140/month — pick weekly or monthly billing</div>
            <ul className="price-card-list">
              <li><span className="check">✓</span> No Agent Access fee — included</li>
              <li><span className="check">✓</span> Triple-line + Predictive + Progressive + Preview</li>
              <li><span className="check">✓</span> Multiple scripts per campaign</li>
              <li><span className="check">✓</span> Live monitoring + coaching</li>
              <li><span className="check">✓</span> AI transcription + summaries</li>
              <li><span className="check">✓</span> Salesforce, HubSpot, Pipedrive, Zoho native</li>
              <li><span className="check">✓</span> SMS + inbound numbers included</li>
              <li><span className="check">✓</span> Unlimited outbound minutes</li>
              <li><span className="check">✓</span> Skip tracing via API integration</li>
            </ul>
          </div>

          <div className="price-card">
            <div className="price-card-label">MOJO DIALER</div>
            <div className="price-card-name">À la carte stacking</div>
            <div>
              <span className="price-card-big">$346</span>
              <span className="price-card-suffix">/agent/month (real)</span>
            </div>
            <div className="price-card-monthly">Monthly billing only. No weekly option.</div>
            <ul className="price-card-list">
              <li className="bad"><span className="cross">✕</span> $10/mo mandatory access fee</li>
              <li className="bad"><span className="cross">✕</span> No true predictive (triple-line only)</li>
              <li className="bad"><span className="cross">✕</span> One script per campaign</li>
              <li className="bad"><span className="cross">✕</span> No live monitoring or coaching</li>
              <li className="bad"><span className="cross">✕</span> No AI transcription</li>
              <li className="bad"><span className="cross">✕</span> CRM: Follow Up Boss only</li>
              <li className="bad"><span className="cross">✕</span> SMS not included</li>
              <li className="bad"><span className="cross">✕</span> Data add-ons stack monthly</li>
              <li className="bad"><span className="cross">✕</span> Real estate framing throughout</li>
            </ul>
          </div>
        </div>

        <div className="vs-incentive-strip">
          <strong>FOR TEAMS:</strong> 10-rep team on Mojo Triple Line + add-ons = ~$3,460/mo.
          10-rep team on DialerSeat = $1,400/mo ($350/week). <strong>Save $24,720/year.</strong>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
        <h2 className="vs-section-h2">Where Mojo's industry focus shows.</h2>
        <p className="vs-section-lede">
          Mojo is purpose-built for real estate prospecting. That's a strength when you're doing
          exactly that, and a limitation when you want anything else. Side-by-side scoring below.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="feature-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>DialerSeat</th>
                <th>Mojo</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
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
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
        <h2 className="vs-section-h2">Six advantages Mojo can't match.</h2>

        <div className="win-grid">
          <div className="win-card">
            <div className="win-card-title">1. Weekly billing — nobody else does this</div>
            <p className="win-card-body">
              $35 this week. Cancel before next Monday and you owe nothing more. Mojo wants
              monthly billing with multiple add-ons. We charge once, weekly, and you get
              everything.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">2. Every industry, not just real estate</div>
            <p className="win-card-body">
              Mojo is built around FSBO, expired, and neighborhood data. If you sell insurance,
              financial services, B2B SaaS, debt resolution, fundraising, or anything else, you're
              fighting the product. DialerSeat is industry-agnostic from day one.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">3. Multiple scripts per campaign + live switching</div>
            <p className="win-card-body">
              Cold open, voicemail leave-behind, three objection handlers, closer — all on tabs,
              one tap away mid-call. Mojo gives you one script per campaign and expects you to
              memorize the rest.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">4. Real predictive dialer + 4 modes per campaign</div>
            <p className="win-card-body">
              Triple-line is fast for prospecting but it's not true predictive — there's no pacing
              algorithm with abandon-rate caps. We have Predictive, Progressive, Power, and
              Preview, configurable per campaign.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">5. Live monitoring + whisper + barge</div>
            <p className="win-card-body">
              Coach reps in real time, whisper advice mid-call, barge in when needed. Mojo doesn't
              have any of this. For team-based selling, this is non-negotiable.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">6. AI transcription, summaries, and sentiment</div>
            <p className="win-card-body">
              Every call transcribed automatically. AI-generated summary in your CRM. Sentiment
              flagged on each call. Mojo has none of this. By 2027 these will be table stakes —
              we're already there.
            </p>
          </div>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHERE MOJO WINS</div>
        <h2 className="vs-section-h2">Where their real-estate focus is genuinely better.</h2>
        <p className="vs-section-lede">
          We're not going to pretend. Two real advantages Mojo has if you're specifically in real
          estate.
        </p>

        <div className="honest-gap">
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ BUILT-IN REAL ESTATE DATA MARKETPLACE
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            Mojo sells FSBO data, expired listing data, and pre-foreclosure data directly inside
            their platform. If you specifically prospect those audiences and don't have a data
            source, the convenience is real (even if the cost stacks up). DialerSeat integrates
            with skip tracing APIs but doesn't bundle data — bring your list, we'll dial it.
          </p>
        </div>

        <div className="honest-gap" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ COPPER-BASED TELECOM INFRASTRUCTURE
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            Mojo emphasizes their copper-based infrastructure for call quality. We run on
            SignalWire's Tier-1 carrier network — also high-quality, but a different stack. In
            practical terms, both deliver clean audio. If your buying decision hinges on telecom
            architecture preference, both will perform.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHICH ONE IS RIGHT FOR YOU</div>
        <h2 className="vs-section-h2">Be honest about your industry and stack.</h2>

        <div className="decision-grid">
          <div className="decision-card ours">
            <div className="decision-card-title">▸ PICK DIALERSEAT IF</div>
            <h3 className="decision-card-h3">You're in any industry that needs serious team dialing.</h3>
            <ul className="decision-list">
              <li>✓ You're not strictly real estate</li>
              <li>✓ You want $35/week flat pricing without add-on creep</li>
              <li>✓ Your team uses Salesforce, HubSpot, Pipedrive, or Zoho</li>
              <li>✓ You need live coaching for newer reps</li>
              <li>✓ You want AI transcription and summaries</li>
              <li>✓ Your team is 5+ reps and you need predictive dialing</li>
              <li>✓ You want SMS as a 2-touch channel</li>
              <li>✓ Modern UI matters for rep onboarding and retention</li>
            </ul>
          </div>

          <div className="decision-card theirs">
            <div className="decision-card-title">▸ PICK MOJO IF</div>
            <h3 className="decision-card-h3">You're a solo real estate agent who lives in expired and FSBO.</h3>
            <ul className="decision-list">
              <li>○ Real estate is 100% of your business</li>
              <li>○ You don't have your own lead source</li>
              <li>○ You use Follow Up Boss as your CRM</li>
              <li>○ You're a solo agent, not a team manager</li>
              <li>○ You don't need AI features yet</li>
              <li>○ You don't need live coaching</li>
              <li>○ Triple-line speed is enough — true predictive isn't needed</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="vs-final-cta">
        <div className="vs-final-cta-inner">
          <h2 className="vs-final-cta-h2">Same speed. Half the price. Every industry. $35 a week.</h2>
          <p className="vs-final-cta-p">
            7-day free trial with full features unlocked. No credit card. After trial: just
            $35/week ($140/mo) per seat. Cancel any time — even mid-week. No contract, no
            recovery call, no hard sell.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">TALK TO US</Link>
          </div>
        </div>
      </div>
    </div>
  )
}