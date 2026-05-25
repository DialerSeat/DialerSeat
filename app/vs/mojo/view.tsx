'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'
import WLCallout from '@/components/wl-callout'

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
  { feature: 'Per-seat cost', dialerseat: '$35/wk', competitor: '$99–$149/mo' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Self-serve signup', dialerseat: true, competitor: true },
  { feature: 'No annual contract', dialerseat: true, competitor: true },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Triple-line dialer', dialerseat: '4 modes (Preview, Power, Progressive, Predictive)', competitor: '3-line (Mojo Dialer)' },
  { feature: 'Single-line dialer', dialerseat: 'Preview mode', competitor: 'Mojo Express ($10/mo)' },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: 'Voicemail drop only' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Scripts feature' },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Variable' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: 'Real estate CRM focus' },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Desktop-focused' },
  { feature: 'Industry-agnostic', dialerseat: true, competitor: 'Real estate niche' },
  { feature: 'Calendar-aligned analytics (Sun/1st)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
  { feature: 'Modern UI', dialerseat: true, competitor: 'Legacy real-estate-focused UI' },
]

export default function VsMojoView() {
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
          .vs-section { max-width: 1080px; margin: 0 auto; padding: 80px 32px; }
          .vs-section-eyebrow { font-size: 11px; letter-spacing: 4px; color: ${T.muted}; font-weight: bold; margin-bottom: 12px; }
          .vs-section-h2 { font-size: 36px; letter-spacing: -0.5px; line-height: 1.15; font-weight: 800; margin: 0 0 16px 0; color: ${T.text}; }
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
          .feature-table th:nth-child(2), .feature-table th:nth-child(3) { text-align: center; width: 22%; }
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
          .vs-final-cta {
            background: linear-gradient(135deg, ${T.dark}, ${T.darker});
            color: white;
            padding: 80px 32px;
            text-align: center;
          }
          .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
          .vs-final-cta-h2 { font-size: 42px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 16px 0; line-height: 1.15; }
          .vs-final-cta-p { font-size: 17px; color: #c4c8d8; line-height: 1.6; margin: 0 0 32px 0; }

          @media (max-width: 768px) {
            .vs-hero { padding: 56px 20px 64px; }
            .vs-h1 { font-size: 36px; }
            .vs-subhead { font-size: 16px; }
            .vs-section { padding: 56px 20px; }
            .vs-section-h2 { font-size: 28px; }
            .price-grid, .win-grid { grid-template-columns: 1fr; }
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
              Mojo is built for real estate.<br />
              <span className="versus">DialerSeat is built for everyone — at $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              Mojo carved out a niche in real estate prospecting and serves it well. If you're
              outside real estate — insurance, financial services, B2B, mortgage, solar — you're
              paying for a tool tuned to someone else's workflow. DialerSeat™ is industry-agnostic
              with the same multi-line predictive dialing, at a fraction of the price.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">If you're not in real estate, you're paying for someone else's workflow.</h2>
          <p className="vs-section-lede">
            Mojo Dialer ($149/mo) gives you their 3-line dialer plus a real-estate-tuned interface
            and integrations. Mojo Express ($10/mo) is single-line only. The product is solid but
            its DNA is real estate prospecting — neighborhood searches, FSBO/expired tools, MLS
            integrations. DialerSeat™ is built for any outbound team in any industry.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you're not in real estate, want
              industry-agnostic dialing at a lower price, or need modern mobile/tablet support.
              <strong> Stay on Mojo</strong> if you're a real estate prospector deeply embedded
              in their FSBO/expired/neighborhood data tools — those are genuinely good and we
              don't replicate them.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week versus $149 a month.</h2>
          <p className="vs-section-lede">
            Mojo Dialer (their 3-line predictive) is $149/seat/month. Mojo Express (single-line) is
            $10/month but you lose multi-line predictive entirely. DialerSeat™ is $35/week
            (≈$140/month) with all four dialer modes included.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">Flat weekly billing</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">≈ $140/month equivalent</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> All 4 dialer modes included</li>
                <li><span className="check">✓</span> Industry-agnostic</li>
                <li><span className="check">✓</span> Works on phones + tablets (PWA)</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Multiple scripts per campaign</li>
                <li><span className="check">✓</span> Live mid-call script switching</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">MOJO DIALER</div>
              <div className="price-card-name">Monthly, real estate focused</div>
              <div>
                <span className="price-card-big">$149</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Mojo Express (single-line) $10/mo. Data add-ons separate.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Single-line at $10 tier only</li>
                <li className="bad"><span className="cross">✕</span> Real estate niche tooling</li>
                <li className="bad"><span className="cross">✕</span> Desktop-focused interface</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
                <li className="bad"><span className="cross">✕</span> Data/lead packages cost extra</li>
                <li className="bad"><span className="cross">✕</span> Real estate CRM focus</li>
                <li className="bad"><span className="cross">✕</span> Static scripts per campaign</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Mojo's real-estate-specific features are not in this table because they're not
            comparable — they're an entirely different value proposition. If you need FSBO/expired
            data, neighborhood prospecting, or MLS integration, Mojo wins. If you need a general-
            purpose outbound dialer, DialerSeat™ wins on every axis.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Mojo Dialer</th>
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
          <h2 className="vs-section-h2">Six advantages for non-real-estate teams.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Lower price</div>
              <p className="win-card-body">
                $140/mo equivalent vs Mojo's $149 — and you get triple-line predictive included.
                On Mojo, the cheaper $10 tier is single-line only.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Industry-agnostic</div>
              <p className="win-card-body">
                Insurance, financial services, B2B, mortgage, solar, recruiting — DialerSeat™
                serves all of them. Mojo's UI and workflows are built around real estate prospecting.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Mobile + tablet support</div>
              <p className="win-card-body">
                Install as a PWA on iPhone, iPad, or Android — behaves like a native app. Mojo is
                desktop-focused; mobile support is limited.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Multiple scripts per campaign with live switching</div>
              <p className="win-card-body">
                Real estate script, health script, veterans script, IUL — every team's go-to scripts
                on tabs, switchable mid-call. Mojo treats scripts as static per-campaign assets.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Public API + webhooks for any CRM</div>
              <p className="win-card-body">
                Push call results to Salesforce, HubSpot, Pipedrive, or your custom CRM via our API.
                Mojo's integrations are real-estate-CRM-centric.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Weekly billing, no contract</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Mojo wants
                monthly subscriptions; no weekly option.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Dialing is dialing. Pay less for the same thing.</h2>
            <p className="vs-final-cta-p">
              If you're not running a real estate prospecting operation, you're paying Mojo for
              tools you'll never use. DialerSeat™ is the industry-agnostic alternative — same
              multi-line predictive engine, weekly billing, no contract, mobile support.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  )
}