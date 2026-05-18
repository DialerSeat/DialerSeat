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
  { feature: 'Public pricing', dialerseat: '$35/week flat', competitor: '$140–$215 + add-ons' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Annual contract for best price', dialerseat: false, competitor: true },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: false },
  { feature: 'Single-line power dialer', dialerseat: true, competitor: true },
  { feature: 'Triple-line / multi-line dialer', dialerseat: true, competitor: false },
  { feature: 'True predictive dialer with pacing', dialerseat: true, competitor: false },
  { feature: 'Progressive dialer', dialerseat: true, competitor: false },
  { feature: 'Preview dialer', dialerseat: true, competitor: false },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (~1.8s)', dialerseat: 'Always on', competitor: true },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Voicemail drop', dialerseat: true, competitor: true },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: true },
  { feature: 'Local presence dialing', dialerseat: 'Included', competitor: 'Included' },
  { feature: 'Inbound numbers', dialerseat: 'Included', competitor: 'Premium tier only' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Single-contact calling (call one person)', dialerseat: true, competitor: false },
  { feature: 'Dial list flexible size (not forced 10/25/50)', dialerseat: true, competitor: false },
  { feature: 'See contact name during dial', dialerseat: true, competitor: 'Reported issue' },
  { feature: 'Calendar-aligned analytics', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
]

export default function VsPhoneBurnerView() {
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
            background: radial-gradient(circle at 50% 30%, rgba(74,158,255,0.15) 0%, transparent 50%);
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
          .switching-list li { font-size: 14px; color: ${T.text}; line-height: 1.55; display: flex; gap: 10px; align-items: flex-start; }
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
            <div className="vs-eyebrow">DIALERSEAT VS PHONEBURNER</div>
            <h1 className="vs-h1">
              PhoneBurner stops at single-line.<br />
              <span className="versus">We don't. $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              Solo agent or 50-rep team. Same Tier-1 carrier audio, same STIR/SHAKEN
              A-attestation — at <strong>just $35/week</strong> per seat. No single-line
              cap. No tier upgrades to unlock basic features. No annual contract. Multi-line
              predictive included, every device supported, weekly billing.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Everything PhoneBurner does — plus multi-line, plus mobile, plus weekly.</h2>
          <p className="vs-section-lede">
            PhoneBurner earned its 4.7/5 G2 rating with rock-solid single-line dialing,
            instant connections, and best-in-class call quality. Their reputation is real.
            The problem: they stop at single-line, gate critical features behind annual
            contracts and tier upgrades, and the headline $140/seat number lands at
            $200–$250 in practice. We charge $35/week. Solo or team. Everything included.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat</strong> for multi-line predictive speed,
              everything in one tier (no upgrades to unlock basics), weekly billing, and a
              dialer that works on every device. The single-line approach is here when you
              want it, and the multi-line approach is here when you need it.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE REAL COST OF PHONEBURNER</div>
          <h2 className="vs-section-h2">$140 advertised. $200+ once you upgrade tiers.</h2>
          <p className="vs-section-lede">
            PhoneBurner's three tiers (Standard, Professional, Premium) gate features behind
            upgrades. Inbound numbers, advanced reporting, and team-scale features all sit
            higher in the stack. Real customer bills land here:
          </p>

          <div className="cost-breakdown">
            <div className="cost-row"><span className="item">Professional plan (annual billing)</span><span className="price">$165.00/mo</span></div>
            <div className="cost-row"><span className="item">Premium tier upgrade (inbound, advanced)</span><span className="price">+$35.00/mo</span></div>
            <div className="cost-row"><span className="item">Tier-gated reporting + integrations</span><span className="price">+$20.00/mo</span></div>
            <div className="cost-row"><span className="item">Real PhoneBurner Premium total per seat</span><span className="price">$220.00/mo</span></div>
          </div>

          <div className="price-grid" style={{ marginTop: 32 }}>
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">Everything included, weekly</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">≈ $140/month equivalent</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Multi-line predictive dialer included</li>
                <li><span className="check">✓</span> All four modes (Predictive, Progressive, Power, Preview)</li>
                <li><span className="check">✓</span> Multiple scripts per campaign included</li>
                <li><span className="check">✓</span> Inbound numbers included</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Calendar-aligned analytics</li>
                <li><span className="check">✓</span> Flexible list sizes + single-contact calling</li>
                <li><span className="check">✓</span> Works on phone, tablet, desktop</li>
                <li><span className="check">✓</span> Weekly billing — no annual lock-in</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">PHONEBURNER</div>
              <div className="price-card-name">Tier upgrades</div>
              <div>
                <span className="price-card-big">$200–$250</span>
                <span className="price-card-suffix">/seat/month (real)</span>
              </div>
              <div className="price-card-monthly">Annual contract for best price. No weekly option.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> Single-line dialing only</li>
                <li className="bad"><span className="cross">✕</span> One script per session</li>
                <li className="bad"><span className="cross">✕</span> Inbound gated to Premium tier</li>
                <li className="bad"><span className="cross">✕</span> Forced 10/25/50 list increments</li>
                <li className="bad"><span className="cross">✕</span> No single-contact calling</li>
                <li className="bad"><span className="cross">✕</span> Reported contact-name visibility issues</li>
                <li className="bad"><span className="cross">✕</span> No mobile or tablet experience</li>
                <li className="bad"><span className="cross">✕</span> Annual contract for best price</li>
                <li className="bad"><span className="cross">✕</span> Rolling analytics windows</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where the tier-gating shows up.</h2>
          <p className="vs-section-lede">
            PhoneBurner's three tiers (Standard, Professional, Premium) gate features behind
            upgrades. We include everything for $35/week. Side-by-side scoring below —
            partial means "available but gated or tier-locked."
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
          <h2 className="vs-section-h2">Eight things PhoneBurner can't or won't do.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Weekly billing at $35/week — nobody else does this</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. PhoneBurner
                wants annual commitments to give you their best price. Different category of
                customer experience.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Multi-line dialing — predictive, triple-line, all of it</div>
              <p className="win-card-body">
                PhoneBurner is single-line only. For high-volume outbound, that's a 3x speed
                difference. Reviewers on Reddit and G2 cite "no multi-line" as their #1
                complaint. We have Predictive, Progressive, Power, and Preview, configurable
                per campaign.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Multiple scripts per campaign with live mid-call switching</div>
              <p className="win-card-body">
                Real estate script, health script, veterans script, IUL script — every team's
                go-to scripts on tabs, one tap away on every call. Add as many as you need
                per campaign. PhoneBurner expects one script per session.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Everything in one tier — no upgrades to unlock basics</div>
              <p className="win-card-body">
                Inbound numbers, advanced reporting, calendar-aligned analytics, public API —
                all included in our $35/week base. PhoneBurner gates these behind Professional
                and Premium tiers that push real bills from $140 to $250 per seat.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Works on phones and tablets — not just desktop</div>
              <p className="win-card-body">
                Solo agents closing from their phone between meetings. Field agents dialing
                from an iPad. Install DialerSeat to your home screen on iPhone, iPad, or
                Android and it behaves like a native app. PhoneBurner has no real mobile or
                tablet experience.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Compliance posture without shortcuts</div>
              <p className="win-card-body">
                Every outbound number is registered with the carrier registry (CNAM verified,
                FCR-clean). TCPA windows enforced server-side per lead state. Full
                STIR/SHAKEN A-attestation. We respect the laws so you don't get blocked,
                fined, or sued.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">7. Flexible dial-list size + single-contact calling</div>
              <p className="win-card-body">
                PhoneBurner forces dial lists into 10/25/50 increments and doesn't support
                single-contact calling — two of the most-cited frustrations in Capterra
                reviews. We support any list size and one-off contact calls.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">8. See contact name during the call</div>
              <p className="win-card-body">
                Multiple PhoneBurner reviewers flag that they "can't see the name of the
                person I'm calling" — a basic CRM visibility issue at a $165+/seat tool. We
                always show full contact context during the call.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SWITCHING FROM PHONEBURNER</div>
          <h2 className="vs-section-h2">Single-line loyalists — we've got you.</h2>
          <p className="vs-section-lede">
            Every reason teams stay on PhoneBurner has a clean answer on DialerSeat. Whether
            you're a solo agent or running a 50-rep team, here's how:
          </p>

          <div className="switching-card">
            <h3>Yes, even if you're sold on single-line.</h3>
            <p className="intro">
              We don't ask you to abandon what works. Use single-line if you prefer it.
              Migrate at your pace, solo or team-wide.
            </p>
            <ul className="switching-list">
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Believe single-line beats multi-line?</strong> Use Preview or Power
                  mode — same single-line approach. We don't force multi-line on you; we just
                  offer it when you want it.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Annual contract suits your procurement?</strong> Weekly is the
                  default, but we can batch invoicing annually for procurement teams that
                  need it.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>On Standard tier today?</strong> Everything PhoneBurner Premium
                  offers — inbound, advanced reporting, full integrations — is included in
                  our $35/week. No tier upgrade required.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Use a niche integration only PhoneBurner has?</strong> Build it via
                  our public API + webhooks. Most niche tools take a few hours to wire up.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need data migration?</strong> Bulk import your PhoneBurner contacts,
                  campaigns, and history. We handle the conversion — you keep your work.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Solo agent, not a team?</strong> $35/week, one seat. No team-only
                  features locked away, no minimum seat counts.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Trust PhoneBurner's Tier-1 audio?</strong> We run on SignalWire's
                  Tier-1 carrier network. Same call quality, same STIR/SHAKEN A-attestation.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Need flexible list sizes?</strong> Any size — 1 contact, 17, 4,000.
                  No forced 10/25/50 increments. Plus single-contact calling whenever you
                  need it.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Multi-line speed. Every device. $35 a week.</h2>
            <p className="vs-final-cta-p">
              $35/week per seat. Solo or team. Cancel any time. No tier upgrades, no annual
              procurement cycle, no corner-cutting on compliance. Just a modern dialer that
              works on every device.
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