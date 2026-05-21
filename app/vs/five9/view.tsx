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
  { feature: 'Per-seat cost', dialerseat: '$35/wk ($140/mo)', competitor: '$175–$325/mo' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Public per-seat pricing', dialerseat: true, competitor: false },
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: false },
  { feature: 'First dial under 10 minutes', dialerseat: true, competitor: 'Weeks of onboarding typical' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: 'Variable, often substantial' },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Configurable per-tenant' },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: true },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Custom build' },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: true },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: false },
  { feature: 'Calendar-aligned analytics (Sun/1st)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
  { feature: 'Suited for solo / small teams', dialerseat: true, competitor: 'Enterprise-focused' },
]

export default function VsFive9View() {
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
            <div className="vs-eyebrow">DIALERSEAT VS FIVE9</div>
            <h1 className="vs-h1">
              Five9 is built for the Fortune 500.<br />
              <span className="versus">DialerSeat is built for you — at $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              Five9 is a serious enterprise contact-center platform with a serious enterprise sales
              cycle, custom quotes, and annual contracts. If you're a solo agent, small team, or
              high-volume sales shop that doesn't need a 200-page implementation plan, DialerSeat™
              gives you the same compliance posture and multi-line predictive dialing at
              <strong> $35 per seat per week</strong> — with self-serve signup.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Enterprise platform vs. self-serve dialer.</h2>
          <p className="vs-section-lede">
            Five9 is a market leader in enterprise contact-center-as-a-service. They serve large
            call centers with hundreds or thousands of seats, complex IVR routing, multi-channel
            engagement, and deep workforce management. That's a real product for a real audience.
            But for solo agents and small-to-mid sales teams that just need outbound dialing, it's
            overbuilt — and overpriced. DialerSeat™ is the outbound dialer without the enterprise
            tax.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want a working outbound dialer in 10
              minutes with weekly billing, no contract, and a flat $35/week per seat.
              <strong> Stay on Five9</strong> if you genuinely need full omnichannel
              contact-center functionality, advanced workforce management, IVR design tools, or
              deep integrations with enterprise systems like Salesforce Service Cloud at scale.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week versus $175+ a month with custom quotes.</h2>
          <p className="vs-section-lede">
            Five9's published starting price is around $175/seat/month, but real-world quotes for
            full features and proper line counts typically land at $200–$325 per seat per month
            depending on tier, plus annual commitments. You won't see a working price until you
            sit through a demo and submit a custom quote request. DialerSeat™ publishes pricing
            on the homepage and charges weekly.
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
                <li><span className="check">✓</span> Public pricing on website</li>
                <li><span className="check">✓</span> $0 setup fee</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Self-serve signup, no demo required</li>
                <li><span className="check">✓</span> All dialer modes included</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">FIVE9</div>
              <div className="price-card-name">Enterprise contract</div>
              <div>
                <span className="price-card-big">$175+</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Real quotes commonly $200–$325/seat. Annual commits typical.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Pricing requires sales call</li>
                <li className="bad"><span className="cross">✕</span> Annual contracts typical</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
                <li className="bad"><span className="cross">✕</span> Multi-week onboarding</li>
                <li className="bad"><span className="cross">✕</span> Custom implementation often required</li>
                <li className="bad"><span className="cross">✕</span> Built around enterprise CCaaS, not pure outbound</li>
                <li className="bad"><span className="cross">✕</span> Desktop-focused agent application</li>
                <li className="bad"><span className="cross">✕</span> Per-feature tier gating</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Five9 wins on omnichannel breadth (inbound IVR, chat, email, workforce management,
            quality assurance suites) — features that genuinely matter if you're running a 500-seat
            contact center. They are NOT in this table because DialerSeat™ doesn't try to replicate
            them. This table is purely about outbound dialing for sales teams.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Five9</th>
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
          <h2 className="vs-section-h2">Six advantages for non-enterprise teams.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Public, predictable pricing</div>
              <p className="win-card-body">
                $35 per seat per week on the homepage. No demo, no custom quote, no
                back-and-forth with a sales engineer. Five9 prices are negotiated, vary wildly
                by tier, and rarely match the headline.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Weekly billing, no annual lock-in</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Five9 wants
                annual commitments for best pricing and any kind of meaningful service level.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Self-serve signup, dialing in 10 minutes</div>
              <p className="win-card-body">
                Sign up, enter card, start dialing. Five9 implementations routinely run weeks —
                between demos, procurement, contracts, custom configuration, and agent training.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Built for sales teams, not contact centers</div>
              <p className="win-card-body">
                Five9 is omnichannel CCaaS — they want to be your inbound IVR, chat, email,
                workforce management platform too. DialerSeat™ does outbound dialing and does it
                well. If you don't need the rest, you shouldn't pay for it.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Works on phones + tablets</div>
              <p className="win-card-body">
                Install as a PWA on iPhone, iPad, or Android — behaves like a native app. Five9's
                agent application is desktop-focused with limited mobile experience.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Multiple scripts per campaign with live switching</div>
              <p className="win-card-body">
                Tabs for every script your team uses — health, IUL, veterans, real estate — switch
                mid-call. Five9 supports scripts but typically requires custom build/integration
                for the same flexibility.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Skip the enterprise sales cycle.</h2>
            <p className="vs-final-cta-p">
              You don't need to sit through three demos and sign a 12-month contract to make
              outbound calls. $35/week per seat, all dialer modes, full compliance, modern UI,
              cancel anytime. Self-serve signup means first dial in under 10 minutes.
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