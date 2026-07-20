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
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: 'Free trial exists; full pricing requires sales' },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: 'Billed quarterly; Trustpilot reviewers report lock-in at renewal' },
  { feature: 'Per-seat cost', dialerseat: '$35/wk, cancel anytime', competitor: '$35\u2013$95+/mo by tier' },
  { feature: 'Multi-line dialing included in base price', dialerseat: true, competitor: 'Requires PowerDialer tier, $95+/mo' },
  { feature: 'Predictive dialer', dialerseat: true, competitor: false },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Preview dialer', dialerseat: true, competitor: 'Not specified' },
  { feature: 'AI voice/answering-machine detection', dialerseat: true, competitor: '+$30/mo add-on' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Not specified' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Basic DNC tool only' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets', dialerseat: 'Full dialer, same as desktop', competitor: 'Native app, 2.05/5 on Android' },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsKixieView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS KIXIE</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              Kixie's multi-line tier starts near $95.<br />
              <span className="versus">Ours is $35/week, every mode included.</span>
            </h1>
            <p className="vs-subhead">
              Kixie PowerCall is a genuinely well-reviewed dialer for CRM-tied outbound teams. It's
              also structured in tiers — multi-line dialing, AI voice detection, and full call
              capacity each cost more. DialerSeat™ includes every dialer mode at{' '}
              <strong>$35 per seat per week</strong>, one price, weekly billing, no tier to climb.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A well-liked dialer, priced by how much dialing you need.</h2>
          <p className="vs-section-lede">
            Kixie holds a strong 4.8/5 on G2 across 800+ reviews, and its local presence and
            CRM-embedded workflow are real strengths for HubSpot- and Salesforce-native teams.
            Worth knowing going in: Kixie doesn't offer predictive dialing by design — their own
            content frames Multi-line PowerCall as an alternative that avoids predictive dialing's
            abandoned-call risk, a legitimate compliance-minded choice, not a gap. What is a gap is
            price structure: multi-line dialing, AI voice detection, and full minute allotments
            each add cost on top of the entry tier. DialerSeat™ includes predictive, power,
            progressive, and preview dialing in one flat price.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want predictive dialing and multi-line
              modes included at one price, not tiered by how much calling power you need. Stay on
              Kixie if your team is small, single-line power dialing is enough, and Kixie's HubSpot
              or Salesforce integration is a dealbreaker feature for your stack.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, flat, versus $35–$95+ a month by tier.</h2>
          <p className="vs-section-lede">
            Kixie's entry Integrated tier starts around $35/user/month, but that's single-line only
            with no power dialer. Multi-line PowerDialer — the tier comparable to DialerSeat's
            included dialing modes — runs roughly $95–$185/user/month depending on the source, and
            AI Human Voice Detection is a further $30/month add-on. Independent reviewers estimate
            real all-in cost lands 30–60% above the advertised entry price once add-ons are
            factored in. DialerSeat™ is $35/week, flat, with every mode included from the start.
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
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Predictive + multi-line included, no tier</li>
                <li><span className="check">✓</span> AMD included, no add-on</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">KIXIE</div>
              <div className="price-card-name">Tiered by dialing power</div>
              <div>
                <span className="price-card-big">$95+</span>
                <span className="price-card-suffix">/seat/month for multi-line</span>
              </div>
              <div className="price-card-monthly">Entry tier ($35) is single-line only. AI voice detection is $30/mo extra.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Multi-line dialing gated to top tier</li>
                <li className="bad"><span className="cross">✕</span> No predictive dialing offered, by design</li>
                <li className="bad"><span className="cross">✕</span> AI voice detection costs extra</li>
                <li className="bad"><span className="cross">✕</span> Quarterly billing; renewal lock-in reported</li>
                <li className="bad"><span className="cross">✕</span> Exact pricing not published — quote required</li>
                <li className="bad"><span className="cross">✕</span> Real cost often 30–60% above advertised rate</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Kixie's local presence dialing and CRM depth are real strengths,
            and its choice to skip predictive dialing is a legitimate design decision, not a flaw.
            Green ✓ = confirmed support, red ✕ = not available, amber = tier-gated, add-on priced,
            or a claim we couldn't independently confirm.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Kixie</th>
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
          <h2 className="vs-section-h2">Live coaching costs a tier upgrade. Whitelabel isn't offered at all.</h2>
          <p className="vs-section-lede">
            Kixie's Professional tier and up add live call coaching and team-facing tools, priced
            above the entry Integrated plan. We found no whitelabel or reseller program anywhere
            on Kixie's site. DialerSeat™ Manager+ is a flat $75/month add-on with full whitelabel
            included, on top of a per-seat price that never changes with team size.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, flat rate</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — same rate at any team size</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> Team performance + campaign oversight included</li>
                <li><span className="check">✓</span> No tier upgrade required for coaching tools</li>
                <li><span className="check">✓</span> Published price, not a custom quote</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">KIXIE PROFESSIONAL+</div>
              <div className="price-card-name">Where team tools start</div>
              <div>
                <span className="price-card-big">$65+</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Multi-line + full team tools run $95+/seat</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> Team/coaching tools require tier upgrade</li>
                <li className="bad"><span className="cross">✕</span> Exact tier pricing not published</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things that aren't a tier upgrade away.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Predictive dialing included</div>
              <p className="win-card-body">
                Kixie doesn't offer predictive dialing at any tier — a legitimate design choice on
                their part. DialerSeat includes it alongside power, progressive, and preview modes.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. One price, every dialer mode</div>
              <p className="win-card-body">
                No tier to climb for multi-line calling. Kixie's multi-line PowerDialer sits at the
                top tier, roughly $95+/seat/month.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Kixie bills
                quarterly, and Trustpilot reviewers report lock-in at renewal.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. AMD included, not an add-on</div>
              <p className="win-card-body">
                Answering-machine detection runs on every call at no extra cost. Kixie's AI Human
                Voice Detection is a $30/month add-on.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. The full dialer, on a phone or tablet</div>
              <p className="win-card-body">
                Install as a PWA with the same dialer modes as desktop. Kixie does have a native
                mobile app, but its Android release is rated 2.05/5 with limited recent downloads.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on Kixie's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Every dialer mode, one price, no tier to climb.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Predictive, power, progressive, and preview dialing, all
              included from day one — not gated behind a $95+/month tier. Self-serve signup means
              first dial in under 10 minutes.
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