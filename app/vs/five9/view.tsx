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
  { feature: 'Public pricing on website', dialerseat: true, competitor: false },
  { feature: 'Self-serve signup (no demo required)', dialerseat: true, competitor: false },
  { feature: 'Time from signup to first dial', dialerseat: '< 10 min', competitor: '1–4 weeks' },
  { feature: 'Per-seat price', dialerseat: '$35/wk ($140/mo)', competitor: '$175+/mo' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: 'Variable, often $5K+' },
  { feature: 'Annual contract', dialerseat: false, competitor: 'Typical' },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'Cancel any time', dialerseat: true, competitor: 'Contract terms apply' },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (~1.8s)', dialerseat: 'Always on', competitor: true },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'Custom build' },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Partial' },
  { feature: 'All outbound numbers carrier-registered', dialerseat: true, competitor: 'Variable' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: true },
  { feature: 'Local presence dialing', dialerseat: true, competitor: true },
  { feature: 'Inbound team numbers', dialerseat: 'Included', competitor: 'Tier upgrade' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: false },
  { feature: 'Workforce management (WFM)', dialerseat: false, competitor: true },
  { feature: 'Dedicated implementation team', dialerseat: false, competitor: true },
  { feature: 'Calendar-aligned analytics (Sun/1st)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
]

export default function VsFive9View() {
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
          .timeline-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 24px;
          }
          .timeline-card {
            background: white;
            border: 1px solid ${T.border};
            border-radius: 12px;
            padding: 28px;
          }
          .timeline-card.ds { border-left: 4px solid ${T.blue}; }
          .timeline-card.f9 { border-left: 4px solid ${T.amber}; }
          .timeline-card h3 {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 3px;
            color: ${T.text};
            margin: 0 0 16px 0;
          }
          .timeline-step {
            display: flex;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px dashed ${T.border};
            font-size: 13px;
            line-height: 1.5;
          }
          .timeline-step:last-child { border-bottom: none; }
          .timeline-step .num {
            min-width: 32px;
            height: 24px;
            font-size: 10px;
            font-weight: bold;
            color: ${T.muted};
            font-family: monospace;
            letter-spacing: 0.5px;
          }
          .timeline-step.ds .num { color: ${T.blue}; }
          .timeline-step.f9 .num { color: ${T.amber}; }
          .timeline-step .text { color: ${T.text}; }
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

          @media (max-width: 768px) {
            .vs-hero { padding: 56px 20px 64px; }
            .vs-h1 { font-size: 36px; }
            .vs-subhead { font-size: 16px; }
            .vs-section { padding: 56px 20px; }
            .vs-section-h2 { font-size: 28px; }
            .price-grid, .win-grid, .timeline-grid { grid-template-columns: 1fr; }
            .switching-list { grid-template-columns: 1fr; }
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
              Five9 wants a demo.<br />
              <span className="versus">We just want you dialing. $35 a week.</span>
            </h1>
            <p className="vs-subhead">
              Same multi-line predictive dialing. Same STIR/SHAKEN compliance. Same scale
              capacity — solo agent or 500-seat team. At <strong>$35/week per seat</strong>,
              not $175+/month. Public pricing. Self-serve signup. Dialing in under 10
              minutes — not after a four-week sales cycle.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Enterprise dialer capability without the enterprise sales cycle.</h2>
          <p className="vs-section-lede">
            Five9 built the legacy contact-center platform for enterprise call operations.
            Their feature surface is deep — workforce management, dedicated implementation
            teams, decades of integrations. The cost is everything that comes with that:
            opaque pricing requiring a sales call, weeks of demos and procurement, annual
            commitments, implementation fees. DialerSeat is the modern alternative for
            teams that want the core outbound dialer at a fraction of the price with
            self-serve setup.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat</strong> if you want public pricing, self-serve
              signup, weekly billing, and a modern dialer that runs on every device — at
              a flat $35/week instead of Five9's $175+ per seat with annual contracts.
              Stay on Five9 if you need workforce management or dedicated implementation
              services.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">TIME-TO-DIAL</div>
          <h2 className="vs-section-h2">Under 10 minutes vs four weeks.</h2>
          <p className="vs-section-lede">
            Five9's sales cycle is the cost most teams underestimate. Two reps spending
            a week each in demos is two reps not closing deals. Solo agents and small
            teams typically can't afford that opportunity cost. DialerSeat is built for
            the opposite — sign up, configure, dial.
          </p>

          <div className="timeline-grid">
            <div className="timeline-card ds">
              <h3>DIALERSEAT</h3>
              <div className="timeline-step ds">
                <span className="num">0:00</span>
                <span className="text">Visit /sign-up</span>
              </div>
              <div className="timeline-step ds">
                <span className="num">1:00</span>
                <span className="text">Email + password, card on file</span>
              </div>
              <div className="timeline-step ds">
                <span className="num">3:00</span>
                <span className="text">Create campaign, set dialer mode</span>
              </div>
              <div className="timeline-step ds">
                <span className="num">5:00</span>
                <span className="text">Upload CSV of leads</span>
              </div>
              <div className="timeline-step ds">
                <span className="num">7:00</span>
                <span className="text">Add your script</span>
              </div>
              <div className="timeline-step ds">
                <span className="num">8:00</span>
                <span className="text">First outbound dial</span>
              </div>
            </div>

            <div className="timeline-card f9">
              <h3>FIVE9 (TYPICAL)</h3>
              <div className="timeline-step f9">
                <span className="num">DAY 1</span>
                <span className="text">Request a demo via contact form</span>
              </div>
              <div className="timeline-step f9">
                <span className="num">DAY 2–5</span>
                <span className="text">Discovery call with SDR</span>
              </div>
              <div className="timeline-step f9">
                <span className="num">DAY 5–10</span>
                <span className="text">Technical demo with sales engineer</span>
              </div>
              <div className="timeline-step f9">
                <span className="num">DAY 10–14</span>
                <span className="text">Custom quote, contract negotiation</span>
              </div>
              <div className="timeline-step f9">
                <span className="num">DAY 14–21</span>
                <span className="text">Procurement, legal review, signoff</span>
              </div>
              <div className="timeline-step f9">
                <span className="num">DAY 21–28</span>
                <span className="text">Implementation, training, first dial</span>
              </div>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35/week public vs $175+ per seat behind a sales call.</h2>
          <p className="vs-section-lede">
            Five9 doesn't publish per-seat pricing — quotes are custom and require a
            discovery call. Independent industry reports consistently cite $175+ per seat
            per month as the floor, with most quotes landing higher once annual commitment
            and implementation are factored in. DialerSeat publishes pricing on the
            homepage.
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
                <li><span className="check">✓</span> $0 implementation</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Self-serve signup, no demo</li>
                <li><span className="check">✓</span> All dialer modes included</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">FIVE9</div>
              <div className="price-card-name">Enterprise sales cycle</div>
              <div>
                <span className="price-card-big">$175+</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Quote required. Annual contracts typical.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No public pricing</li>
                <li className="bad"><span className="cross">✕</span> Implementation fees variable, often $5K+</li>
                <li className="bad"><span className="cross">✕</span> Annual contract for best price</li>
                <li className="bad"><span className="cross">✕</span> Sales call required to get a quote</li>
                <li className="bad"><span className="cross">✕</span> 1–4 week sales cycle typical</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
                <li className="bad"><span className="cross">✕</span> Inbound + advanced features may be tier-gated</li>
                <li className="bad"><span className="cross">✕</span> Desktop-focused interface</li>
                <li className="bad"><span className="cross">✕</span> Multi-week implementation typical</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Green ✓ = full support, red ✕ = not available, amber =
            partial, tier-gated, or requires custom build. Five9 wins on workforce
            management and white-glove implementation. DialerSeat wins on price, speed,
            transparency, and modern UX.
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
          <h2 className="vs-section-h2">Eight things Five9 won't or can't do.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Public pricing</div>
              <p className="win-card-body">
                $35/week is on the homepage. No demo required to find out the price. Five9
                requires a sales call to get a quote — and quotes vary widely by team size,
                contract length, and which features you need unlocked.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Self-serve signup, no sales cycle</div>
              <p className="win-card-body">
                Visit /sign-up, enter card, start dialing. No discovery call, no demo, no
                procurement loop. Five9's sales cycle averages 1–4 weeks before the first
                dial.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. Weekly billing — unique in the category</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Five9
                wants annual commitments for best pricing. Different relationship with
                customer flexibility.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Multiple scripts per campaign with live switching</div>
              <p className="win-card-body">
                Real estate script, health script, veterans script, IUL script — every
                team's go-to scripts on tabs, one tap away on every call. Five9 supports
                scripting but it's typically a custom build, not a configurable per-campaign
                option.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Per-campaign dialer mode</div>
              <p className="win-card-body">
                Your cold list runs Predictive. Your hot follow-ups run Preview. Same
                agent, same session, different modes per campaign. Five9 typically locks
                dialer mode to account-level configuration.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Works on phones and tablets</div>
              <p className="win-card-body">
                Install DialerSeat to your home screen on iPhone, iPad, or Android — it
                behaves like a native app. Field agents on iPad, solo reps on their phone.
                Five9 is desktop-focused; mobile support is limited.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">7. Calendar-aligned analytics</div>
              <p className="win-card-body">
                "This week" means Sunday through now. "This month" means the 1st through
                now. Matches how sales people actually think about pipeline. Most
                enterprise dialers including Five9 show rolling windows that don't line
                up with team cadence.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">8. Lapsed-user data preservation</div>
              <p className="win-card-body">
                Pause your subscription, keep your campaigns, leads, recordings, and call
                history. Resubscribe and pick up where you left off. Five9 contracts
                typically don't survive cancellation this way.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SWITCHING FROM FIVE9</div>
          <h2 className="vs-section-h2">Outgrew the enterprise treatment? We've got you.</h2>
          <p className="vs-section-lede">
            Most teams on Five9 don't actually use the enterprise features they're paying
            for — they signed years ago when self-serve at this quality didn't exist.
            Here's how to think about the move:
          </p>

          <div className="switching-card">
            <h3>The honest case for staying on Five9.</h3>
            <p className="intro">
              We don't pretend to do everything Five9 does. Some operations genuinely
              need what they provide.
            </p>
            <ul className="switching-list">
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You need workforce management.</strong> Forecasting, agent
                  scheduling, real-time adherence tracking — that's Five9's domain. We
                  don't build it.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You need dedicated CSM + implementation team.</strong> Five9
                  provides white-glove migration and ongoing customer success contacts.
                  We provide email support.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You need a niche enterprise integration.</strong> Five9 has
                  20+ years of pre-built connectors. We integrate via public API.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You operate a 500+ seat contact center.</strong> At that scale,
                  enterprise features and dedicated support are usually worth the
                  premium.
                </span>
              </li>
            </ul>

            <h3 style={{ marginTop: 32 }}>The honest case for switching to DialerSeat.</h3>
            <ul className="switching-list">
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You're paying for features you don't use.</strong> Most outbound
                  teams use the dialer, scripts, dispositions, and reports — not the WFM
                  layer. We charge for the dialer.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>Your contract is up for renewal.</strong> Best time to evaluate.
                  Run DialerSeat in parallel for two weeks; switch if it covers your real
                  workflow.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You're a 1–100 seat operation.</strong> Five9's pricing model
                  assumes you'll grow into enterprise. At sub-100 seats, you're typically
                  overpaying.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You want modern UX.</strong> Five9's interface accumulated UI
                  debt over two decades. DialerSeat is built fresh this year.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You need data migration.</strong> Bulk import your contacts,
                  campaigns, and dispositions. We handle the conversion.
                </span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>
                  <strong>You want public API + webhooks.</strong> Push call results to
                  any CRM via our API. No enterprise integration team required.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Skip the demo cycle. Dial today.</h2>
            <p className="vs-final-cta-p">
              $35/week per seat. Solo or team. Public pricing, no contract, no demo
              required, no implementation fees. Self-serve signup means first dial in
              under 10 minutes — not after a month of sales calls.
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