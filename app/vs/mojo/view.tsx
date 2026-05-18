'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'

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
  { feature: 'Public pricing', dialerseat: '$35/week flat', competitor: '$99 + add-ons stack to $250+' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Required Agent Access fee', dialerseat: '$0 (included)', competitor: '+$10/user/mo' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Annual contract required', dialerseat: false, competitor: false },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Mobile web only' },
  { feature: 'Industry focus', dialerseat: 'Every industry', competitor: 'Real estate primarily' },
  { feature: 'Single-line dialer', dialerseat: true, competitor: true },
  { feature: 'Triple-line dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (true pacing)', dialerseat: true, competitor: false },
  { feature: 'Progressive dialer (auto-advance)', dialerseat: true, competitor: 'Partial' },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (~1.8s)', dialerseat: 'Always on', competitor: 'Optional' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Voicemail drop', dialerseat: true, competitor: true },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Inconsistent' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Variable' },
  { feature: 'Local presence dialing', dialerseat: true, competitor: true },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: false },
  { feature: 'Inbound team numbers', dialerseat: true, competitor: 'Add-on' },
  { feature: 'Real estate data (FSBO, Expired)', dialerseat: 'Via integrations', competitor: '$25–$49/mo add-ons' },
  { feature: 'Calendar-aligned analytics', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
]

export default function VsMojoView() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      <SiteHeader />
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
          .vs-section-lede { font-size: 16px; color: ${T.muted}; line-height: 1.65; max-width: 720px; margin: 0 0 48px 0; }
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
          .price-card { padding: 32px; border-radius: 12px; background: white; border: 1px solid ${T.border}; position: relative; }
          .price-card.winner { border: 2px solid ${T.blue}; box-shadow: 0 8px 32px rgba(74,158,255,0.12); }
          .price-card-label { font-size: 11px; letter-spacing: 3px; font-weight: bold; color: ${T.muted}; margin-bottom: 8px; }
          .price-card.winner .price-card-label { color: ${T.blue}; }
          .price-card-name { font-size: 24px; font-weight: 800; color: ${T.text}; margin-bottom: 16px; }
          .price-card-big { font-size: 44px; font-weight: 800; letter-spacing: -1px; color: ${T.text}; line-height: 1; }
          .price-card-suffix { font-size: 14px; color: ${T.muted}; margin-left: 4px; letter-spacing: 1px; }
          .price-card-monthly { margin-top: 8px; font-size: 13px; color: ${T.muted}; letter-spacing: 0.5px; }
          .price-card-list { margin-top: 20px; padding-top: 20px; border-top: 1px solid ${T.border}; list-style: none; padding-left: 0; }
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
          .feature-table td { padding: 14px 20px; border-top: 1px solid ${T.border}; font-size: 14px; }
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
          .switching-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 36px;
            margin-top: 24px;
            border-top: 4px solid ${T.blue};
          }
          .switching-card h3 { font-size: 22px; font-weight: 800; color: ${T.text}; margin: 0 0 12px 0; }
          .switching-card p.intro { font-size: 14px; color: ${T.muted}; line-height: 1.65; margin: 0 0 24px 0; }
          .switching-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px 28px;
          }
          .switching-list li {
            font-size: 14px;
            color: ${T.text};
            line-height: 1.55;
            display: flex;
            gap: 10px;
            align-items: flex-start;
          }
          .switching-list .check-icon { color: ${T.green}; font-weight: bold; flex-shrink: 0; }
          .switching-list strong { color: ${T.text}; font-weight: 800; }
          .vs-final-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
          .vs-final-cta-h2 { font-size: 42px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 16px 0; line-height: 1.15; }
          .vs-final-cta-p { font-size: 17px; color: #c4c8d8; line-height: 1.6; margin: 0 0 32px 0; }
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
            .price-grid, .win-grid { grid-template-columns: 1fr; }
            .switching-list { grid-template-columns: 1fr; }
            .feature-table th, .feature-table td { padding: 10px 12px; font-size: 12px; }
            .vs-final-cta { padding: 56px 20px; }
            .vs-final-cta-h2 { font-size: 30px; }
            .vs-btn-primary { width: 100%; }
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
              Solo agent or 50-rep team. Real estate, insurance, financial services — any
              industry. Same triple-line speed, same voicemail drop, at
              <strong> just $35/week</strong> per seat. No $10/mo Agent Access fee, no $49
              skip tracer add-on, no $25/county FSBO data add-on. One flat weekly price.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Same triple-line speed. Every industry. Every device.</h2>
          <p className="vs-section-lede">
            Mojo built the best triple-line dialer for real estate prospecting. They've earned
            that reputation. But the moment you need anything outside their core — true
            predictive dialing, modern UI, calendar-aligned analytics, or anything other than
            real estate — you start paying add-ons that double the bill. We just charge
            $35/week. Solo agent or team, real estate or anything else.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat</strong> for triple-line speed across any industry,
              modern software, a public API that works with any CRM, and a dialer that works
              on every device. Everything Mojo does for real estate, we do for every industry
              — at $35/week instead of $350+/month.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE REAL COST OF MOJO</div>
          <h2 className="vs-section-h2">$139 advertised. $250+ in practice.</h2>
          <p className="vs-section-lede">
            Mojo's pricing is à la carte. The headline number is misleading — most teams spend
            80–150% more once they assemble a functional package. Here's what a real Mojo bill
            looks like for one agent:
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
              <div className="price-card-monthly">≈ $140/month equivalent</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> No Agent Access fee — included</li>
                <li><span className="check">✓</span> Triple-line + Predictive + Progressive + Preview</li>
                <li><span className="check">✓</span> Multiple scripts per campaign</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Inbound numbers included</li>
                <li><span className="check">✓</span> Calendar-aligned analytics</li>
                <li><span className="check">✓</span> Lapsed-user data preservation</li>
                <li><span className="check">✓</span> Works on phone, tablet, desktop</li>
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
                <li className="bad"><span className="cross">✕</span> Mobile web only — no install</li>
                <li className="bad"><span className="cross">✕</span> CRM coverage: Follow Up Boss focus</li>
                <li className="bad"><span className="cross">✕</span> Inbound numbers as add-on</li>
                <li className="bad"><span className="cross">✕</span> Data feeds stack separately</li>
                <li className="bad"><span className="cross">✕</span> Real estate framing throughout</li>
                <li className="bad"><span className="cross">✕</span> Rolling analytics windows</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where Mojo's industry focus shows.</h2>
          <p className="vs-section-lede">
            Mojo is purpose-built for real estate prospecting. That's a strength when you're
            doing exactly that, and a limitation when you want anything else. Side-by-side
            scoring below.
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
          <h2 className="vs-section-h2">Eight advantages Mojo can't match.</h2>

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
                Mojo is built around FSBO, expired, and neighborhood data. If you sell
                insurance, IUL, health, veterans benefits, financial services, B2B SaaS, debt
                resolution, fundraising, or anything else — you're fighting the product.
                DialerSeat is industry-agnostic from day one.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Multiple scripts per campaign with live mid-call switching</div>
              <p className="win-card-body">
                Real estate script, health script, veterans script, IUL script — every team's
                go-to scripts on tabs, one tap away on every call. Add as many as you need
                per campaign. Mojo gives you one script per campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Real predictive dialer + 4 modes per campaign</div>
              <p className="win-card-body">
                Triple-line is fast for prospecting but it's not true predictive — there's no
                pacing algorithm with abandon-rate caps. We have Predictive, Progressive,
                Power, and Preview, configurable per campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Works on phones and tablets — not just mobile web</div>
              <p className="win-card-body">
                Field agents dialing from an iPad. Solo agents closing from their phone in the
                car between showings. Install DialerSeat to your home screen on iPhone, iPad,
                or Android and it behaves like a native app. Mojo offers mobile web only —
                slow, clunky, not built for serious mobile dialing.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Compliance posture without shortcuts</div>
              <p className="win-card-body">
                Every outbound number is registered with the carrier registry (CNAM verified,
                FCR-clean). TCPA windows enforced server-side per lead state. STIR/SHAKEN
                A-attestation. We respect the laws so you don't get blocked, fined, or sued.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">7. Public API + webhooks — works with any CRM</div>
              <p className="win-card-body">
                Push call results, dispositions, and lead updates to any CRM via our public
                API and webhooks. No vendor lock-in to Follow Up Boss or any other single
                CRM. If your CRM has an API, it works with DialerSeat.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">8. Calendar-aligned analytics + data preservation</div>
              <p className="win-card-body">
                "This week" means Sunday through now. "This month" means the 1st through now.
                Matches how sales people actually track quota. Plus — pause your subscription
                and keep your campaigns, leads, and history. Mojo has neither.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SWITCHING FROM MOJO</div>
          <h2 className="vs-section-h2">Real estate? Solo agent? We've got you covered.</h2>
          <p className="vs-section-lede">
            Yes, even if Mojo is your daily driver for FSBO and expired prospecting — here's
            how DialerSeat handles every reason teams stay on Mojo:
          </p>

          <div className="switching-card">
            <h3>Even if real estate is 100% of your business.</h3>
            <p className="intro">
              Every advantage Mojo is known for — we match natively or integrate cleanly. Solo
              agents, full teams, real estate, or any other industry — same product, same
              price per seat.
            </p>
            <ul className="switching-list">
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need FSBO / expired data?</strong> Integrate with the same data
                  providers Mojo resells — via our API or skip-tracing partners. You keep your
                  preferred data source.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Use Follow Up Boss?</strong> Push call results and dispositions via
                  our public API + webhooks. Same workflow, same lead routing.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Solo agent, not a team?</strong> $35/week, one seat. No per-seat
                  creep, no Agent Access fee, no team-only features locked away.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Triple-line is enough?</strong> Triple-line is one click in any
                  campaign. We don't force you into Predictive.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Like Mojo's neighborhood search?</strong> We integrate with public
                  APIs that surface the same data — without the $49/mo subscription per
                  dataset.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need data migration?</strong> Bulk import your Mojo contact lists
                  and campaign history. We handle the conversion — you keep your work.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need real predictive dialing?</strong> Multi-line with proper
                  pacing — not just triple-line. Configure per campaign.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need calendar-aligned reporting?</strong> Sunday weeks, 1st-of-month
                  resets. Matches how reps actually think about quota.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Same speed. Every industry. $35 a week.</h2>
            <p className="vs-final-cta-p">
              $35/week per seat. Solo or team. Real estate or anything else. Cancel any time.
              No add-on bills, no mandatory data subscriptions, no industry lock-in, no
              corner-cutting on compliance. Just a modern dialer that works.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}