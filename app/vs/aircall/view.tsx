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
  { feature: 'Public per-seat pricing', dialerseat: true, competitor: 'Numbers only on third-party blogs, not their own pricing page' },
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: 'Monthly costs ~33% more per seat' },
  { feature: 'Minimum seats required', dialerseat: false, competitor: '3-license minimum, every plan' },
  { feature: 'Seat price', dialerseat: '$35/wk, cancel anytime', competitor: '$30–$50/seat/mo by tier' },
  { feature: 'Power Dialer included in entry tier', dialerseat: true, competitor: false },
  { feature: 'Power Dialer requires tier upgrade', dialerseat: false, competitor: 'Professional tier, $50/seat/mo' },
  { feature: 'Salesforce integration requires tier upgrade', dialerseat: false, competitor: 'Professional tier required' },
  { feature: 'Live call monitoring / whisper', dialerseat: true, competitor: 'Professional tier required' },
  { feature: 'Predictive dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Progressive dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Preview dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Not specified' },
  { feature: 'AMD voicemail filter included', dialerseat: true, competitor: 'Not specified' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Not specified' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Pricing negotiable / not fixed at list', dialerseat: false, competitor: 'Median buyer saves 23% off list (Vendr data)' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsAircallView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS AIRCALL</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              The dialer is a Professional-tier upsell.<br />
              <span className="versus">Ours dials on the first seat, at $35/week.</span>
            </h1>
            <p className="vs-subhead">
              Aircall's advertised $30/seat Essentials plan doesn't include the Power Dialer,
              Salesforce integration, or live call monitoring — all three require upgrading to
              Professional at $50/seat, plus a 3-license minimum on every plan. DialerSeat™
              includes every dialer mode at <strong>$35 per seat per week</strong>, no tier
              upgrade required.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A real phone system. The sales dialer costs extra to unlock.</h2>
          <p className="vs-section-lede">
            Aircall is a well-established, CRM-friendly business phone system, and its Power
            Dialer — confirmed directly from Aircall's own product content — is a genuine power
            dialer that queues and cycles leads automatically. The catch, sourced from Aircall's
            own blog and independently corroborated across multiple vendor-pricing analyses: that
            dialer sits on the Professional plan, $50/seat/month, not the advertised $30/seat
            Essentials entry. One G2 reviewer put it plainly — they signed up specifically for
            the power dialer, found it wasn't on the basic plan, and called the product
            "unusable" without the paid upgrade. DialerSeat™ includes the dialer at the price
            you're quoted.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want the dialer included in your
              starting price, not a Professional-tier unlock with a 3-seat floor. Stay on Aircall
              if its broader helpdesk-style integrations and support-team features matter more to
              your stack than a cost-predictable outbound dialer.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, dialer included, versus $50 a month for the dialer alone.</h2>
          <p className="vs-section-lede">
            Aircall's own pricing page doesn't render dollar figures directly — multiple
            independent sources confirm the numbers live on Aircall's blog instead: Essentials
            from $30/user/month, Professional from $50/user/month, both billed annually and both
            carrying a 3-license minimum. The Power Dialer, Salesforce integration, and live call
            monitoring all require Professional. Vendr's transaction data, drawn from real
            purchases, shows the median buyer negotiates 23% off list price — meaning the "real"
            price isn't even the one Aircall advertises. For a mid-size team, real monthly cost is
            commonly documented in the $2,500–$4,000 range once add-ons are included. DialerSeat™
            is $35/week, flat, one price, no license minimum.
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
                <li><span className="check">✓</span> Public pricing on the pricing page itself</li>
                <li><span className="check">✓</span> $0 setup fee</li>
                <li><span className="check">✓</span> No seat minimum</li>
                <li><span className="check">✓</span> Power dialer included, no tier upgrade</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">AIRCALL PROFESSIONAL</div>
              <div className="price-card-name">Where the dialer actually lives</div>
              <div>
                <span className="price-card-big">$50</span>
                <span className="price-card-suffix">/seat/month, 3-seat minimum</span>
              </div>
              <div className="price-card-monthly">Essentials ($30) has no Power Dialer, no Salesforce, no monitoring</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Power Dialer requires Professional tier</li>
                <li className="bad"><span className="cross">✕</span> 3-license minimum on every plan</li>
                <li className="bad"><span className="cross">✕</span> Pricing not shown on Aircall's own pricing page</li>
                <li className="bad"><span className="cross">✕</span> Monthly billing runs ~33% above annual</li>
                <li className="bad"><span className="cross">✕</span> Real mid-team cost often $2,500–$4,000/mo</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Aircall's CRM sync and reliability are genuinely well-regarded by
            reviewers. Green ✓ = confirmed support, red ✕ = not available at the entry tier or
            not found, amber = tier-gated, negotiable, or a claim we couldn't independently
            confirm.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Aircall</th>
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
          <h2 className="vs-section-h2">A Custom tier exists. Whitelabel doesn't.</h2>
          <p className="vs-section-lede">
            Aircall's Custom tier (quote-based, typically 25+ licenses) adds unlimited outbound
            calling and custom SLAs. We found no whitelabel or reseller program anywhere on
            Aircall's site. DialerSeat™ Manager+ is a flat $75/month add-on with full whitelabel
            included, on top of a per-seat price that already includes the dialer, with no license
            minimum to reach it.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, no license minimum</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — dialer never a tier upgrade</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> No 3-license minimum to get started</li>
                <li><span className="check">✓</span> Team performance + campaign oversight included</li>
                <li><span className="check">✓</span> Published price, not negotiated per deal</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">AIRCALL CUSTOM</div>
              <div className="price-card-name">Quote-based, 25+ licenses</div>
              <div>
                <span className="price-card-big">Custom</span>
                <span className="price-card-suffix">quote required</span>
              </div>
              <div className="price-card-monthly">No whitelabel found. Price varies by negotiation, per Vendr data.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> Typically requires 25+ licenses</li>
                <li className="bad"><span className="cross">✕</span> List price isn't the real price — 23% median discount reported</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things that aren't a Professional-tier unlock.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Power dialer at the entry price</div>
              <p className="win-card-body">
                No upgrade needed. Aircall's Power Dialer requires the Professional plan,
                $50/seat/month — the $30 Essentials tier doesn't include it at all.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. No seat minimum</div>
              <p className="win-card-body">
                Start with one seat. Aircall requires a minimum of 3 licenses on every published
                plan, Essentials or Professional.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Aircall's
                monthly billing runs roughly 33% above its annual rate.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Price on the pricing page</div>
              <p className="win-card-body">
                $35/week is right there. Multiple independent reports note Aircall's own pricing
                page doesn't render dollar figures directly — the numbers live on their blog.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. The full dialer, on a phone or tablet</div>
              <p className="win-card-body">
                Install as a PWA with the same dialer modes as desktop. Aircall's dialer gating
                applies regardless of which device you're using.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on Aircall's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">The dialer isn't a tier away. It's already here.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Predictive, power, progressive, and preview dialing, included
              from your first seat — not a $50/month Professional-tier unlock. Self-serve signup
              means first dial in under 10 minutes.
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
