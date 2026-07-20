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
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: true },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: 'Monthly exists but costs more' },
  { feature: 'Per-seat cost', dialerseat: '$35/wk, cancel anytime', competitor: '$19–$89/mo by tier' },
  { feature: 'Minimum seats on standard plans', dialerseat: false, competitor: '2-seat minimum' },
  { feature: 'Power/predictive dialer included in entry tier', dialerseat: true, competitor: false },
  { feature: 'Predictive dialer', dialerseat: true, competitor: 'Pro tier ($49+/mo) and up' },
  { feature: 'Power dialer', dialerseat: true, competitor: 'Pro tier ($49+/mo) and up' },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Sales dialer and general calling in one app', dialerseat: true, competitor: 'Two separate apps' },
  { feature: 'HIPAA compliance available', dialerseat: 'Not specified', competitor: 'Business tier, 10-seat minimum' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Not specified' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Not specified' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Unlimited calling with no overage risk', dialerseat: true, competitor: 'Fair Usage Policy applies' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: true },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsJustcallView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS JUSTCALL</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              $29 gets you calling. Not dialing.<br />
              <span className="versus">$35/week gets you both, from day one.</span>
            </h1>
            <p className="vs-subhead">
              JustCall's advertised $29/user/month is real — but the power and predictive dialer
              sit behind their Pro tier, $49/month and up, plus a 2-seat minimum on every standard
              plan. DialerSeat™ includes every dialer mode at{' '}
              <strong>$35 per seat per week</strong>, one seat minimum: one.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A genuinely useful phone system. A dialer, once you upgrade.</h2>
          <p className="vs-section-lede">
            JustCall's $29/user/month Team plan is real and gets you unlimited calling, SMS, and
            100+ CRM integrations — but power and predictive dialing aren't included at that price;
            you need the Pro tier ($49/user/month) or higher. JustCall also runs the sales dialer
            as a genuinely separate mobile app from its general calling app — their own help
            center flags the two aren't interchangeable. DialerSeat™ is one app, one price, dialer
            modes included from the first seat.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want the dialer itself included at your
              starting price, not a Pro-tier upgrade. Stay on JustCall if general business calling,
              SMS, and WhatsApp across a wider country list matter more to your team than outbound
              dialing specifically.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, dialer included, versus $29 a month, dialer extra.</h2>
          <p className="vs-section-lede">
            JustCall's Team plan is $29/user/month — genuinely published, genuinely transparent
            pricing, credit where due. The catch: every standard plan carries a 2-seat minimum
            (so a solo user's real floor is closer to $58/month), and the power/predictive dialer
            isn't available until the Pro tier at $49/user/month or higher. "Unlimited" calling
            and transcription are also subject to an unpublished Fair Usage Policy. DialerSeat™ is
            $35/week, flat, with the dialer included from a single seat.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">Flat weekly billing</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Cancel anytime — no monthly lock-in</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Public pricing on website</li>
                <li><span className="check">✓</span> $0 setup fee</li>
                <li><span className="check">✓</span> One seat minimum: one</li>
                <li><span className="check">✓</span> Dialer modes included, no tier</li>
                <li><span className="check">✓</span> One app for calling and dialing</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">JUSTCALL</div>
              <div className="price-card-name">Dialer gated to Pro tier</div>
              <div>
                <span className="price-card-big">$49+</span>
                <span className="price-card-suffix">/seat/month for the dialer</span>
              </div>
              <div className="price-card-monthly">Team tier ($29) has no power/predictive dialer. 2-seat minimum applies.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Power/predictive dialer requires Pro tier upgrade</li>
                <li className="bad"><span className="cross">✕</span> 2-seat minimum on Team through Pro Plus</li>
                <li className="bad"><span className="cross">✕</span> Sales Dialer is a separate app from general calling</li>
                <li className="bad"><span className="cross">✕</span> "Unlimited" usage still subject to Fair Usage Policy</li>
                <li className="bad"><span className="cross">✕</span> HIPAA compliance requires Business tier, 10-seat minimum</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. JustCall's published pricing and broad country coverage for
            numbers are real strengths. Green ✓ = confirmed support, red ✕ = not available,
            amber = tier-gated, structurally different, or a claim we couldn't independently
            confirm.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>JustCall</th>
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
          <div className="vs-section-eyebrow">SCALING A TEAM</div>
          <h2 className="vs-section-h2">Adding a team means a 2-seat floor before you even start.</h2>
          <p className="vs-section-lede">
            JustCall's advanced analytics and AI review features are genuinely priced add-ons on
            top of Team and Pro plans, and HIPAA compliance is locked to the Business tier with a
            10-seat minimum. We found no whitelabel or reseller program anywhere on JustCall's
            site. DialerSeat™ Manager+ is a flat $75/month add-on with full whitelabel included,
            with no seat minimum to access it.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, no seat minimum</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — works the same for one seat or fifty</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> No seat minimum to unlock anything</li>
                <li><span className="check">✓</span> Team performance + campaign oversight</li>
                <li><span className="check">✓</span> Published price, not a custom quote</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">JUSTCALL BUSINESS</div>
              <div className="price-card-name">Where HIPAA and full features live</div>
              <div>
                <span className="price-card-big">$89+</span>
                <span className="price-card-suffix">/seat/month, 10-seat minimum</span>
              </div>
              <div className="price-card-monthly">No whitelabel found. AI analytics still a separate add-on.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> 10-seat minimum for the top tier</li>
                <li className="bad"><span className="cross">✕</span> AI analytics add-on ~$100/month on top</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things that don't need a tier upgrade or a second app.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Dialer included at the entry price</div>
              <p className="win-card-body">
                Power and predictive dialing from your first seat. JustCall gates both behind the
                Pro tier, $49/user/month and up.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. One seat minimum</div>
              <p className="win-card-body">
                Start solo. JustCall's Team through Pro Plus plans carry a 2-seat minimum, so the
                real floor is roughly double the advertised per-seat price.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. One app for calling and dialing</div>
              <p className="win-card-body">
                No app-switching. JustCall runs its Sales Dialer as a separate mobile app from
                general calling — their own help center says the two aren't interchangeable.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. JustCall bills
                monthly, with annual billing required for the lowest advertised rate.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. No Fair Usage Policy fine print</div>
              <p className="win-card-body">
                $35/week covers your calling. JustCall's "unlimited" minutes and transcription are
                subject to an unpublished Fair Usage Policy that can trigger overage billing.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on JustCall's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">The dialer isn't an upsell here.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Predictive, power, progressive, and preview dialing, included
              from your first seat — not a Pro-tier unlock. Self-serve signup means first dial in
              under 10 minutes.
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