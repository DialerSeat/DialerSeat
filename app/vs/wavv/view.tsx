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
  { feature: 'Public per-seat pricing', dialerseat: true, competitor: true },
  { feature: 'Every dialer mode at one price', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: true },
  { feature: 'Per-number fee', dialerseat: '$0 (unlimited)', competitor: '$1/mo per number' },
  { feature: 'Free trial', dialerseat: false, competitor: '7 days' },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: 'Top tier only' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: 'Inconsistent' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Variable' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: false },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
]

export default function VsWavvView() {
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
          .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; align-items: stretch; }
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
          .tier-rows { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
          .tier-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            padding: 10px 14px;
            background: ${T.bg};
            border: 1px solid ${T.border};
            border-radius: 8px;
          }
          .tier-row-name { font-size: 13px; font-weight: bold; color: ${T.text}; }
          .tier-row-desc { font-size: 11px; color: ${T.muted}; display: block; margin-top: 2px; }
          .tier-row-price { font-size: 17px; font-weight: 800; color: ${T.text}; white-space: nowrap; }
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
            <div className="vs-eyebrow">DIALERSEAT VS WAVV</div>
            <h1 className="vs-h1">
              WAVV charges more the harder you dial.<br />
              <span className="versus">We charge $35 a week. Every mode included.</span>
            </h1>
            <p className="vs-subhead">
              WAVV prices by dialer mode — pay more to unlock Single Line, pay more again for
              Multi Line predictive. DialerSeat™ is <strong>$35 a week per seat, flat</strong> —
              preview, power, and multi-line predictive dialing all included from day one. Weekly
              billing, cancel any time.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Same category of tool. Different pricing philosophy.</h2>
          <p className="vs-section-lede">
            WAVV is a legitimate dialer with a real trial and real month-to-month billing — this
            isn't the "opaque enterprise pricing" story. Where the two products diverge is
            structure: WAVV splits its dialer into three priced tiers, so the calling speed you get
            depends on which plan you're willing to pay for. DialerSeat™ doesn't tier the dialer —
            every seat gets every mode.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want multi-line predictive dialing
              without paying a premium tier to unlock it, or if different campaigns on your team
              need different dialer modes at the same time. Stay on WAVV if your whole team dials
              the same way, at the same speed, all the time, and the tiered structure genuinely
              fits how you work.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week. One price. Every mode.</h2>
          <p className="vs-section-lede">
            WAVV's published pricing starts at $59/user/month for manual preview dialing, $99 for
            single-line auto-dial, and $149 for multi-line dialing across up to three lines — plus
            $1/month per phone number. DialerSeat™ is $35 a week per seat, billed weekly, with
            unlimited numbers included and no separate tier to unlock predictive dialing.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">One price. Every mode.</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Billed weekly. Cancel any time — no contract.</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Preview, power, and multi-line predictive — all included</li>
                <li><span className="check">✓</span> Unlimited dial-out numbers, no per-number fee</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Self-serve signup, no demo required</li>
                <li><span className="check">✓</span> Per-campaign dialer mode, not account-locked</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">WAVV</div>
              <div className="price-card-name">Three tiers, three prices</div>
              <div className="tier-rows">
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">Preview Line</span>
                    <span className="tier-row-desc">Manual dialing, quick preview before calls</span>
                  </div>
                  <span className="tier-row-price">$59/mo</span>
                </div>
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">Single Line</span>
                    <span className="tier-row-desc">Automatic next-lead dialing</span>
                  </div>
                  <span className="tier-row-price">$99/mo</span>
                </div>
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">Multi Line</span>
                    <span className="tier-row-desc">Up to 3 lines simultaneously</span>
                  </div>
                  <span className="tier-row-price">$149/mo</span>
                </div>
              </div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Predictive dialing locked to the top tier</li>
                <li className="bad"><span className="cross">✕</span> $1/month per phone number, on top of the plan price</li>
                <li className="bad"><span className="cross">✕</span> Monthly billing, no weekly option</li>
                <li><span className="check">✓</span> 7-day free trial</li>
                <li><span className="check">✓</span> Unlimited minutes, call recording included</li>
                <li><span className="check">✓</span> Month-to-month, no long-term contract</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Green ✓ = full support, red ✕ = not available, amber = partial
            or tier-gated. WAVV's "competitor" column reflects its top Multi Line tier, since
            that's the plan comparable to what DialerSeat™ includes by default.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>WAVV</th>
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
          <h2 className="vs-section-h2">Six things WAVV's tiers won't do.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. No tier to climb for predictive</div>
              <p className="win-card-body">
                Every DialerSeat™ seat includes multi-line predictive dialing from day one. WAVV
                makes you pay for its top Multi Line plan to get there.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Unlimited numbers, no per-number fee</div>
              <p className="win-card-body">
                Unlimited dial-out numbers and multiple inbound numbers per seat, included. WAVV
                adds $1/month for every phone number on top of whichever plan you're paying for.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. WAVV bills
                monthly regardless of which tier you're on.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Per-campaign dialer mode</div>
              <p className="win-card-body">
                Cold list on Predictive, hot follow-ups on Preview, same account, same price.
                WAVV's dialer speed is tied to which plan you bought, not which campaign you're
                running.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Multiple scripts per campaign</div>
              <p className="win-card-body">
                Tabs for real estate, health, veterans, IUL — switch mid-call without leaving the
                campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Works on phones + tablets</div>
              <p className="win-card-body">
                Install as a PWA on iPhone, iPad, or Android — full-screen, home-screen icon, no
                app store required.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">$35 a week. Every mode included. Cancel any time.</h2>
            <p className="vs-final-cta-p">
              No tier to unlock predictive dialing, no per-number add-on, no monthly lock-in.
              Self-serve signup means first dial in under 10 minutes.
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
