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
  { feature: 'No annual contract required', dialerseat: true, competitor: 'Monthly billing costs more per seat' },
  { feature: 'Seat price (Dialpad Connect)', dialerseat: '$35/wk, cancel anytime', competitor: '$15–$35/mo by tier' },
  { feature: 'Power dialer included in Connect at any tier', dialerseat: true, competitor: false },
  { feature: 'Power dialer available at all', dialerseat: true, competitor: 'Separate product, Dialpad Sell, $39+/mo' },
  { feature: 'CRM integrations on entry tier', dialerseat: true, competitor: 'Standard tier lacks CRM sync; requires Pro' },
  { feature: 'Minimum seats on Pro tier', dialerseat: false, competitor: '3-user minimum' },
  { feature: 'Predictive dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Progressive dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Preview dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Not specified' },
  { feature: 'AMD voicemail filter included', dialerseat: true, competitor: 'Not specified' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Not specified' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Not specified' },
  { feature: '"Unlimited calling" without regional restriction', dialerseat: true, competitor: 'US/Canada only, per multiple reports' },
  { feature: 'SMS overage fees', dialerseat: false, competitor: '$0.008/message after 250, per reports' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsDialpadView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS DIALPAD</div>
            <h1 className="vs-h1">
              Dialpad's phone plans don't have a power dialer.<br />
              <span className="versus">Ours does, on the first seat, at $35/week.</span>
            </h1>
            <p className="vs-subhead">
              Dialpad Connect — the $15–$35/user/month plan most people mean when they say
              "Dialpad" — doesn't include a power dialer at any tier. The dialer lives in a
              completely separate product, Dialpad Sell, starting around $39/user/month.
              DialerSeat™ includes every dialer mode at <strong>$35 per seat per week</strong>,
              one product, one price.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A well-liked phone system. Not a dialer, unless you buy the other product.</h2>
          <p className="vs-section-lede">
            Dialpad shows up frequently in "best dialer" roundups, largely on the strength of its
            AI transcription and coaching tools. Worth knowing before you sign up: those roundups
            are usually describing Dialpad's AI features, not its dialer. The core Dialpad Connect
            phone plans (Standard $15, Pro $25, Enterprise $35 per user/month) don't include a
            power dialer at any tier — multiple independent pricing breakdowns confirm it, listing
            "Power Dialer" as available only inside the separate Dialpad Sell product line, itself
            starting around $39/user/month. DialerSeat™ is one product with the dialer already in
            it.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want a dialer, not a phone system that
              requires buying a second, separate product to get one. Stay on Dialpad if your team
              genuinely needs its AI transcription and coaching across general business calling
              more than it needs outbound dialing specifically.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, one product, versus two products to add up.</h2>
          <p className="vs-section-lede">
            Dialpad Connect's advertised $15/user/month Standard plan is real, but it has no CRM
            integrations and no power dialer. Pro ($25/user/month) adds CRM sync but carries a
            3-user minimum — so a 2-person team pays for 3 seats. One detailed breakdown puts a
            real 2-person Pro team at roughly $46.75/month per active user once the 3-seat minimum
            and mandatory administrative fees are factored in, against a $25 headline. And none of
            this includes the dialer — that's Dialpad Sell, a separate purchase starting around
            $39/user/month. DialerSeat™ is $35/week, flat, one product, dialer included.
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
                <li><span className="check">✓</span> One product, dialer included</li>
                <li><span className="check">✓</span> No seat minimum</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">DIALPAD SELL</div>
              <div className="price-card-name">The separate product with the dialer</div>
              <div>
                <span className="price-card-big">$39+</span>
                <span className="price-card-suffix">/seat/month, separate purchase</span>
              </div>
              <div className="price-card-monthly">Dialpad Connect (the phone plan) has no power dialer at any tier</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Power dialer isn't in the phone-system product at all</li>
                <li className="bad"><span className="cross">✕</span> Two separate products to piece together</li>
                <li className="bad"><span className="cross">✕</span> Pro tier carries a 3-user minimum</li>
                <li className="bad"><span className="cross">✕</span> Mandatory admin fee reported on top of seat price</li>
                <li className="bad"><span className="cross">✕</span> "Unlimited calling" restricted to US/Canada</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Dialpad's AI transcription and call summaries are genuinely
            well-regarded. Green ✓ = confirmed support, red ✕ = not available in the product being
            compared, amber = requires a separate product/purchase, or a claim we couldn't
            independently confirm.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Dialpad</th>
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
          <h2 className="vs-section-h2">Enterprise exists. Whitelabel doesn't.</h2>
          <p className="vs-section-lede">
            Dialpad's Enterprise tier adds SSO, SCIM, and dedicated account management for larger
            orgs, on Dialpad Connect. We found no whitelabel or reseller program anywhere on
            Dialpad's site, across either Connect or Sell. DialerSeat™ Manager+ is a flat
            $75/month add-on with full whitelabel included, on the same product that already
            includes the dialer.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, one product</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — dialer and management in one place</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> Team performance + campaign oversight included</li>
                <li><span className="check">✓</span> No second product to purchase for the dialer</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">DIALPAD ENTERPRISE</div>
              <div className="price-card-name">Connect's top tier — still no dialer</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/month, phone system only</span>
              </div>
              <div className="price-card-monthly">No whitelabel found. Dialer still requires the separate Sell product.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> Top phone-system tier still has no dialer built in</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things that don't require a second product.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. The dialer is in the product</div>
              <p className="win-card-body">
                Not a separate purchase. Dialpad Connect's phone plans have no power dialer at any
                tier — it's exclusive to the separate Dialpad Sell product.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. One seat minimum</div>
              <p className="win-card-body">
                Start solo. Dialpad's Pro tier, the one with CRM integrations, carries a 3-user
                minimum — a 2-person team pays for a seat nobody uses.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Dialpad bills
                monthly, with lower rates reserved for annual commitment.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. No mandatory admin fee</div>
              <p className="win-card-body">
                $35/week is the whole price. Independent breakdowns report a mandatory
                administrative fee (roughly $4.50/user) added to Dialpad seats on top of the tier price.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. The full dialer, on a phone or tablet</div>
              <p className="win-card-body">
                Install as a PWA with the same dialer modes as desktop. Dialpad's dialer, when
                purchased separately through Sell, is a distinct product from its mobile phone app.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on Dialpad's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">One product. The dialer's actually in it.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Predictive, power, progressive, and preview dialing, included —
              not a separate $39+/month product you have to discover and buy on top. Self-serve
              signup means first dial in under 10 minutes.
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
