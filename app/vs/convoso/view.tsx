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
  { feature: 'Public per-seat pricing', dialerseat: true, competitor: false },
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: 'Month-to-month exists, but priced above annual' },
  { feature: 'Per-seat cost', dialerseat: '$35/wk, cancel anytime', competitor: '$90+/mo, custom quote' },
  { feature: 'Minimum seat count', dialerseat: false, competitor: '~20 seats typical' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: 'Not published' },
  { feature: 'Predictive dialer', dialerseat: true, competitor: true },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Not specified' },
  { feature: 'AMD voicemail filter', dialerseat: true, competitor: '"97% accuracy" (vendor claim)' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Not specified' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: true },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: true },
  { feature: 'Carrier fees billed separately from seat price', dialerseat: false, competitor: true },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Not found' },
  { feature: 'Free trial without seat minimum', dialerseat: true, competitor: '40+ seats typically required' },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsConvosoView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS CONVOSO</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              Convoso wants a demo and a 20-seat minimum.<br />
              <span className="versus">We publish $35/week and let you start solo.</span>
            </h1>
            <p className="vs-subhead">
              Four dialer modes, AMD voicemail filtering, TCPA compliance, STIR/SHAKEN — Convoso's
              core dialing engine is genuinely well-regarded. DialerSeat™ matches the dialer-mode
              lineup at <strong>$35 per seat per week</strong>, with no seat minimum, no custom
              quote, and no demo required to see the price.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A genuinely strong dialer, built for a different scale.</h2>
          <p className="vs-section-lede">
            Convoso earns its reputation with high-volume outbound teams — four dialer modes,
            claimed 97% AMD accuracy, and dedicated caller ID reputation management (their "Ignite"
            tooling). It's built for contact centers with 20+ agents running custom-quoted,
            usage-billed campaigns. DialerSeat™ offers the same four dialer modes at a flat,
            published price with no seat minimum — built for teams that want to start with one
            seat and grow, not commit to a call-center-scale contract up front.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want the same dialer-mode lineup without
              a seat minimum, a custom quote, or carrier fees billed separately from your seat
              price. Stay on Convoso if you're already running a 20+ agent operation and have
              negotiated volume pricing that beats a flat per-seat rate at your scale.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, published, versus a custom quote starting near $90.</h2>
          <p className="vs-section-lede">
            Convoso doesn't publish pricing — you fill out a form and get a custom quote. Third-party
            sources consistently cite roughly $90/user/month as the floor, not the ceiling: carrier
            fees and DID management are billed separately from the base subscription, so the real
            bill moves with call volume. Free trials are typically restricted to teams of 40+ seats,
            and most accounts run on annual contracts. DialerSeat™ publishes $35/week on the
            homepage — no form, no seat minimum, no custom quote.
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
                <li><span className="check">✓</span> No seat minimum</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> All dialer modes included</li>
                <li><span className="check">✓</span> No separate carrier/DID billing</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">CONVOSO</div>
              <div className="price-card-name">Custom quote, usage-billed</div>
              <div>
                <span className="price-card-big">$90+</span>
                <span className="price-card-suffix">/seat/month (cited floor)</span>
              </div>
              <div className="price-card-monthly">Carrier fees + DID management billed separately, on top</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No published pricing — custom quote only</li>
                <li className="bad"><span className="cross">✕</span> ~20-seat minimum typical</li>
                <li className="bad"><span className="cross">✕</span> Free trial usually requires 40+ seats</li>
                <li className="bad"><span className="cross">✕</span> Annual contracts standard</li>
                <li className="bad"><span className="cross">✕</span> Usage-based billing on top of seat price</li>
                <li className="bad"><span className="cross">✕</span> Demo required to see any number</li>
                <li className="bad"><span className="cross">✕</span> No mobile app found</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Convoso's dialer engine is genuinely capable — the two platforms
            share the same four dialer modes. Green ✓ = confirmed support, red ✕ = not available
            or not found, amber = a vendor claim we couldn't independently verify, or a real
            structural difference worth knowing about before you sign.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Convoso</th>
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
          <h2 className="vs-section-h2">Convoso is built for teams that already have 20+ seats.</h2>
          <p className="vs-section-lede">
            Convoso does offer real admin/agent permission management through its Admin Portal, and
            "white-glove" onboarding is a genuine, reviewer-praised strength. What we found no
            evidence of anywhere on Convoso's site is a whitelabel or reseller program — their
            partner integrations page routes to a quote request, not a rebranding option.
            DialerSeat™ Manager+ is a flat $75/month add-on with full whitelabel included, and no
            seat minimum to access it.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, no seat minimum</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — works the same at 1 seat or 50</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> No 20-seat minimum to get started</li>
                <li><span className="check">✓</span> Team performance + campaign oversight</li>
                <li><span className="check">✓</span> Published price, not a custom quote</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">CONVOSO</div>
              <div className="price-card-name">Admin Portal, custom quoted</div>
              <div>
                <span className="price-card-big">Custom</span>
                <span className="price-card-suffix">quote required</span>
              </div>
              <div className="price-card-monthly">Real admin/agent permissions, no whitelabel found</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> ~20-seat minimum before you can meaningfully start</li>
                <li className="bad"><span className="cross">✕</span> Pricing not published at any tier</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things Convoso gates behind scale.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. No seat minimum</div>
              <p className="win-card-body">
                Start with one seat. Convoso's structure is built around 20+ agent operations, with
                free trials typically restricted to teams of 40 or more.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Published pricing, no demo required</div>
              <p className="win-card-body">
                $35/week is on the homepage. Convoso requires a sales call and custom quote before
                you see a real number.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Convoso runs
                primarily on annual contracts.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. No separate carrier/DID billing</div>
              <p className="win-card-body">
                $35/week covers calling. Convoso bills carrier fees and DID number management
                separately from the base subscription, so real cost moves with call volume.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. The full dialer, on a phone or tablet</div>
              <p className="win-card-body">
                Install as a PWA on iPhone, iPad, or Android with the same dialer modes as desktop.
                We found no native mobile app for Convoso; some reviewers report functionality
                issues using it on iOS.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on Convoso's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Same dialer modes. No seat minimum, no demo, no custom quote.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Predictive, power, progressive, and preview dialing, all
              included. Self-serve signup means first dial in under 10 minutes — not after a
              sales call.
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