'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'

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
  { feature: 'Per-seat cost', dialerseat: '$35/wk ($140/mo)', competitor: '$149+/mo' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Self-serve signup', dialerseat: true, competitor: true },
  { feature: 'No annual contract', dialerseat: true, competitor: true },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Single-line dialer', dialerseat: true, competitor: true },
  { feature: 'Multi-line predictive dialing', dialerseat: '4 modes incl. predictive', competitor: 'Single-line philosophy' },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: 'Voicemail drop' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Single script' },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Variable' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Desktop-focused' },
  { feature: 'Calendar-aligned analytics (Sun/1st)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
]

export default function VsPhoneBurnerView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS PHONEBURNER</div>
            <h1 className="vs-h1">
              PhoneBurner sticks to single-line.<br />
              <span className="versus">DialerSeat gives you all four modes — at $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              PhoneBurner built its reputation on power dialing — single-line, no abandon risk,
              voicemail drop. Solid for low-volume one-rep teams. If you need multi-line predictive,
              configurable per-campaign dialer modes, or weekly billing, you're outside their
              philosophy. DialerSeat™ covers all four modes at <strong>$35 per seat per week</strong>.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Single-line philosophy vs the full toolkit.</h2>
          <p className="vs-section-lede">
            PhoneBurner is deliberately single-line: agents dial through a list one at a time with
            voicemail drop and click-to-dial. That's a feature for solo agents who want maximum
            control. It's a limitation for teams that want predictive multi-line dialing on
            high-volume cold lists. DialerSeat™ gives you all four modes — Preview, Power,
            Progressive, Predictive — configurable per campaign.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want multi-line predictive dialing,
              configurable per-campaign modes, weekly billing, or mobile support. <strong>Stay
              on PhoneBurner</strong> if you're a solo agent who deliberately wants single-line
              power dialing only and you're happy with their CRM-integrated workflow.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week versus $149+ a month.</h2>
          <p className="vs-section-lede">
            PhoneBurner starts at $149/seat/month for their standard plan. Higher tiers reach
            $169–$199/seat/month for advanced features. DialerSeat™ is $35/week (≈$140/month)
            with all features included.
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
                <li><span className="check">✓</span> Multi-line predictive available</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Multiple scripts per campaign</li>
                <li><span className="check">✓</span> Per-campaign dialer mode</li>
                <li><span className="check">✓</span> Works on phones + tablets</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">PHONEBURNER</div>
              <div className="price-card-name">Single-line monthly</div>
              <div>
                <span className="price-card-big">$149+</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Higher tiers up to $199/seat for advanced features.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Single-line philosophy only</li>
                <li className="bad"><span className="cross">✕</span> No multi-line predictive</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
                <li className="bad"><span className="cross">✕</span> Single script per campaign</li>
                <li className="bad"><span className="cross">✕</span> Dialer mode not configurable</li>
                <li className="bad"><span className="cross">✕</span> Desktop-focused interface</li>
                <li className="bad"><span className="cross">✕</span> Advanced features tier-gated</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            PhoneBurner's strength is the polished single-line power-dialing experience plus
            CRM-integrated workflow tools. DialerSeat™'s strength is multi-mode flexibility,
            pricing transparency, and modern mobile/tablet support.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>PhoneBurner</th>
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
          <h2 className="vs-section-h2">Six advantages for multi-mode teams.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Multi-line predictive available</div>
              <p className="win-card-body">
                Predictive mode dials multiple leads simultaneously across a team and connects the
                first live human to the available agent. PhoneBurner deliberately stays single-line.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Per-campaign dialer mode</div>
              <p className="win-card-body">
                Your cold list runs Predictive. Your hot follow-ups run Preview. Same agent, same
                session, different modes per campaign. PhoneBurner locks the dialing approach.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Multiple scripts per campaign with live switching</div>
              <p className="win-card-body">
                Tabs for every script your team uses — health, IUL, veterans, real estate — switch
                mid-call as the conversation goes. PhoneBurner treats scripts as a single asset per
                campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Lower price</div>
              <p className="win-card-body">
                $140/mo equivalent vs PhoneBurner's $149+. Plus you get four modes instead of one.
                Plus weekly billing if you want it.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Works on phones + tablets</div>
              <p className="win-card-body">
                Install as a PWA on iPhone, iPad, or Android — behaves like a native app.
                PhoneBurner is desktop-focused.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Weekly billing, no contract</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. PhoneBurner
                wants monthly subscriptions; no weekly option.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">More modes. Less money. Same compliance.</h2>
            <p className="vs-final-cta-p">
              PhoneBurner is great if you exclusively want single-line power dialing. If you want
              all four dialer modes — Preview, Power, Progressive, Predictive — configurable per
              campaign, at a lower price with weekly billing, that's DialerSeat™.
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