'use client'
import Link from 'next/link'

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
  { feature: 'Self-serve signup', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: 'Default', competitor: false },
  { feature: 'Monthly billing option', dialerseat: true, competitor: true },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$500–$2,000' },
  { feature: 'Annual contract required', dialerseat: false, competitor: 'Typical' },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD that reliably drops voicemails (~1.8s)', dialerseat: 'Always on', competitor: 'Users report misses' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Live call monitoring', dialerseat: true, competitor: true },
  { feature: 'Whisper + barge coaching', dialerseat: true, competitor: true },
  { feature: 'AI call transcription', dialerseat: true, competitor: 'Partial' },
  { feature: 'AI call summaries', dialerseat: true, competitor: false },
  { feature: 'AI sentiment analysis', dialerseat: true, competitor: false },
  { feature: 'DNC scrubbing on upload', dialerseat: true, competitor: true },
  { feature: 'Local presence dialing', dialerseat: true, competitor: true },
  { feature: 'Spam monitoring + auto-rotation', dialerseat: true, competitor: true },
  { feature: 'SMS / A2P 10DLC', dialerseat: true, competitor: true },
  { feature: 'CRM integrations (Salesforce, HubSpot, Pipedrive)', dialerseat: true, competitor: 'Salesforce only' },
  { feature: 'Public API + webhooks', dialerseat: true, competitor: false },
  { feature: 'Inbound team numbers', dialerseat: true, competitor: true },
  { feature: 'Calendar-aligned analytics (Sun reset, 1st reset)', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
  { feature: 'PWA + native iOS/Android/macOS/Windows apps', dialerseat: true, competitor: false },
  { feature: 'TCPA window pre-flight (server-side)', dialerseat: true, competitor: 'Partial' },
  { feature: '99.9% uptime SLA', dialerseat: true, competitor: true },
  { feature: 'SOC 2 Type II', dialerseat: true, competitor: true },
]

export default function VsReadyModeView() {
  const currentYear = new Date().getFullYear()

  return (
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
        .vs-cta-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
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
        .vs-section {
          max-width: 1080px;
          margin: 0 auto;
          padding: 80px 32px;
        }
        .vs-section-eyebrow {
          font-size: 11px;
          letter-spacing: 4px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 12px;
        }
        .vs-section-h2 {
          font-size: 36px;
          letter-spacing: -0.5px;
          line-height: 1.15;
          font-weight: 800;
          margin: 0 0 16px 0;
          color: ${T.text};
        }
        .vs-section-lede {
          font-size: 16px;
          color: ${T.muted};
          line-height: 1.65;
          max-width: 720px;
          margin: 0 0 48px 0;
        }
        .verdict-card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          padding: 32px;
          margin-bottom: 48px;
          border-left: 4px solid ${T.blue};
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .verdict-title {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 3px;
          color: ${T.blue};
          margin-bottom: 12px;
        }
        .verdict-text {
          font-size: 17px;
          line-height: 1.7;
          color: ${T.text};
          margin: 0;
        }
        .price-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        .price-card {
          padding: 32px;
          border-radius: 12px;
          background: white;
          border: 1px solid ${T.border};
          position: relative;
        }
        .price-card.winner {
          border: 2px solid ${T.blue};
          box-shadow: 0 8px 32px rgba(74,158,255,0.12);
        }
        .price-card-label {
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
          color: ${T.muted};
          margin-bottom: 8px;
        }
        .price-card.winner .price-card-label { color: ${T.blue}; }
        .price-card-name {
          font-size: 24px;
          font-weight: 800;
          color: ${T.text};
          margin-bottom: 16px;
        }
        .price-card-big {
          font-size: 44px;
          font-weight: 800;
          letter-spacing: -1px;
          color: ${T.text};
          line-height: 1;
        }
        .price-card-suffix {
          font-size: 14px;
          color: ${T.muted};
          margin-left: 4px;
          letter-spacing: 1px;
        }
        .price-card-monthly {
          margin-top: 8px;
          font-size: 13px;
          color: ${T.muted};
          letter-spacing: 0.5px;
        }
        .price-card-list {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid ${T.border};
          list-style: none;
          padding-left: 0;
        }
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
        .check, .cross {
          display: inline-block;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }
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
        .feature-table td {
          padding: 14px 20px;
          border-top: 1px solid ${T.border};
          font-size: 14px;
        }
        .feature-table td:nth-child(2), .feature-table td:nth-child(3) {
          text-align: center;
          font-weight: bold;
        }
        .feature-table tr:nth-child(even) td { background: ${T.bg}; }
        .feature-table .yes { color: ${T.green}; font-size: 18px; }
        .feature-table .no { color: ${T.red}; font-size: 18px; }
        .feature-table .partial { color: ${T.amber}; font-style: italic; font-size: 12px; }
        .feature-table .ds-cell { background: rgba(74,158,255,0.04) !important; }
        .win-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 24px;
        }
        .win-card {
          padding: 28px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          border-left: 4px solid ${T.green};
        }
        .win-card-title {
          font-size: 17px;
          font-weight: 800;
          color: ${T.text};
          margin-bottom: 10px;
        }
        .win-card-body {
          font-size: 14px;
          line-height: 1.65;
          color: ${T.muted};
          margin: 0;
        }
        .switching-card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
          padding: 36px;
          margin-top: 24px;
          border-top: 4px solid ${T.blue};
        }
        .switching-card h3 {
          font-size: 22px;
          font-weight: 800;
          color: ${T.text};
          margin: 0 0 12px 0;
        }
        .switching-card p.intro {
          font-size: 14px;
          color: ${T.muted};
          line-height: 1.65;
          margin: 0 0 24px 0;
        }
        .switching-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 28px;
        }
        .switching-list li {
          font-size: 14px;
          color: ${T.text};
          line-height: 1.55;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .switching-list .check-icon {
          color: ${T.green};
          font-weight: bold;
          flex-shrink: 0;
        }
        .switching-list strong {
          color: ${T.text};
          font-weight: 800;
        }
        .vs-final-cta {
          background: linear-gradient(135deg, ${T.dark}, ${T.darker});
          color: white;
          padding: 80px 32px;
          text-align: center;
        }
        .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
        .vs-final-cta-h2 {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 0 16px 0;
          line-height: 1.15;
        }
        .vs-final-cta-p {
          font-size: 17px;
          color: #c4c8d8;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }

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
          <div className="vs-eyebrow">DIALERSEAT VS READYMODE</div>
          <h1 className="vs-h1">
            ReadyMode is built for 2014.<br />
            <span className="versus">DialerSeat is built for {currentYear}.</span>
          </h1>
          <p className="vs-subhead">
            Same multi-line predictive dialing, live coaching, and CRM integrations — at
            <strong> just $35/week</strong> ($140/mo). No $500–$2,000 setup fee, no annual
            contract, no dated UI agents complain about. Sign up, configure your team, dial
            in under 10 minutes.
          </p>
          <div className="vs-cta-row">
            <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
          </div>
        </div>
      </div>

      <div className="vs-section">
        <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
        <h2 className="vs-section-h2">If you have 5+ reps and budget for $200/seat, you have two options.</h2>
        <p className="vs-section-lede">
          ReadyMode is the legacy choice — comprehensive, customizable, proven. DialerSeat is
          the modern choice — same feature set, half the friction, none of the contract lock-in,
          and the only dialer in the category that bills weekly. Here's how they actually stack
          up in {currentYear}.
        </p>

        <div className="verdict-card">
          <div className="verdict-title">▸ BOTTOM LINE</div>
          <p className="verdict-text">
            <strong>Switch to DialerSeat</strong> if you want to onboard 50 reps in a day, pay
            $35/week per seat with no add-on creep, and dial without the enterprise sales cycle.
            Everything ReadyMode does, we do — modern, flat-priced, weekly billing, $0 setup.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">PRICING IN {currentYear}</div>
        <h2 className="vs-section-h2">$35/week flat vs $200–$300/seat once the add-ons land.</h2>
        <p className="vs-section-lede">
          ReadyMode publishes a $165 starting price. Real customer bills end up at
          $200–$249 once you add implementation fees, custom reports, and the features
          ReadyMode hides behind tier upgrades. We don't have tier upgrades. We bill weekly.
          No one else in the category does.
        </p>

        <div className="price-grid">
          <div className="price-card winner">
            <div className="price-card-label">DIALERSEAT</div>
            <div className="price-card-name">Flat weekly billing</div>
            <div>
              <span className="price-card-big">$35</span>
              <span className="price-card-suffix">/seat/week</span>
            </div>
            <div className="price-card-monthly">≈ $140/month — pick weekly or monthly billing</div>
            <ul className="price-card-list">
              <li><span className="check">✓</span> $0 setup fee</li>
              <li><span className="check">✓</span> $0 implementation</li>
              <li><span className="check">✓</span> Cancel any time — even mid-week</li>
              <li><span className="check">✓</span> All dialer modes included</li>
              <li><span className="check">✓</span> Live monitoring + coaching included</li>
              <li><span className="check">✓</span> AI transcription + summaries included</li>
              <li><span className="check">✓</span> CRM integrations included</li>
              <li><span className="check">✓</span> SMS + inbound numbers included</li>
              <li><span className="check">✓</span> Unlimited outbound minutes</li>
            </ul>
          </div>

          <div className="price-card">
            <div className="price-card-label">READYMODE</div>
            <div className="price-card-name">Standard → iQ tiers</div>
            <div>
              <span className="price-card-big">$165–$249</span>
              <span className="price-card-suffix">/seat/month</span>
            </div>
            <div className="price-card-monthly">Annual billing preferred. No weekly option.</div>
            <ul className="price-card-list">
              <li className="bad"><span className="cross">✕</span> $500–$2,000 setup fee</li>
              <li className="bad"><span className="cross">✕</span> Annual contract typical</li>
              <li className="bad"><span className="cross">✕</span> Pricing only revealed after sales call</li>
              <li className="bad"><span className="cross">✕</span> Features gated behind iQ tier</li>
              <li className="bad"><span className="cross">✕</span> Inbound minutes billed extra</li>
              <li className="bad"><span className="cross">✕</span> Custom reports = upcharge</li>
              <li className="bad"><span className="cross">✕</span> Voicemail detection users say misses calls</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
        <h2 className="vs-section-h2">Every feature ReadyMode advertises — plus the ones they don't have.</h2>
        <p className="vs-section-lede">
          Honest side-by-side scoring. Green ✓ = full support, red ✕ = not available, amber =
          partial or paywalled.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="feature-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>DialerSeat</th>
                <th>ReadyMode</th>
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
        <h2 className="vs-section-h2">Seven things ReadyMode literally cannot do.</h2>

        <div className="win-grid">
          <div className="win-card">
            <div className="win-card-title">1. Weekly billing — nobody else in the category does this</div>
            <p className="win-card-body">
              $35 this week. Cancel before next Monday and you owe nothing more. Want to skip a
              slow week? Pause. ReadyMode wants a 12-month commitment with a 60-day cancellation
              clause. Different universe.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">2. AMD that actually drops voicemails in 1.8 seconds</div>
            <p className="win-card-body">
              ReadyMode users frequently report voicemail detection failures — calls routing to
              agents that turn out to be machines, wasted minutes, frustrated reps. Our AMD is
              hardcoded on, server-side, and drops every voicemail in ~1.8s. No agent ever hears
              a beep.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">3. Multiple scripts per campaign with live mid-call switching</div>
            <p className="win-card-body">
              Cold open, voicemail leave-behind, three objection handlers, closing script — all
              one tap away on every call. ReadyMode forces you into one script per campaign.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">4. Per-campaign dialer mode (Preview, Power, Progressive, Predictive)</div>
            <p className="win-card-body">
              Your cold list runs Predictive. Your hot follow-ups run Preview. Same agent, same
              session, different modes per campaign. ReadyMode locks you to one mode account-wide.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">5. Calendar-aligned analytics (Sunday + 1st-of-month resets)</div>
            <p className="win-card-body">
              "This week" means Sunday through now. "This month" means the 1st through now.
              Matches how sales managers actually think about pipeline. ReadyMode shows rolling
              windows that never line up with your team's cadence.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">6. Lapsed-user data preservation</div>
            <p className="win-card-body">
              Pause your subscription, keep your campaigns, leads, recordings, and call history.
              Resubscribe and pick up where you left off. ReadyMode deletes or charges storage
              fees.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">7. Modern UI built in {currentYear}</div>
            <p className="win-card-body">
              ReadyMode reviewers consistently describe the UI as "Windows 8" or "dated." We
              built DialerSeat from scratch in {currentYear} with a modern design system. Your
              reps will notice.
            </p>
          </div>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">SWITCHING FROM READYMODE</div>
        <h2 className="vs-section-h2">Even traditional call centers — we've got you covered.</h2>
        <p className="vs-section-lede">
          Bigger operation? Niche workflows? Existing rep training on ReadyMode? Every common
          reason teams stay on ReadyMode has a clean answer on DialerSeat. Here's how:
        </p>

        <div className="switching-card">
          <h3>Yes, even for 100+ seat traditional call centers.</h3>
          <p className="intro">
            Every advantage ReadyMode is known for — we either match it natively or have a
            cleaner path to the same outcome. Worth a short conversation if your team is
            considering the switch.
          </p>
          <ul className="switching-list">
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need 7-dimension agent scoring?</strong> Our custom dispositions, call
                metrics, and reports cover the same scoring rubrics — configure them per team.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need an implementation manager?</strong> Our team walks you through
                rollout end-to-end. No $2,000 line item — included.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need custom inbound IVR flow?</strong> Tell us your routing logic, we
                build it. Inbound numbers, IVR menus, queue handling — all supported.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Reps already trained on ReadyMode?</strong> The transition is faster
                than you'd guess. Our UI is intentional where it matters — most reps are
                productive in under an hour.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need annual procurement?</strong> We support annual billing too — the
                weekly model is the default but it's not the only option.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need data migration?</strong> Bulk import your existing leads, campaigns,
                and dispositions. We handle the conversion — you keep your history.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need SOC 2 + uptime SLA?</strong> We're SOC 2 Type II with a 99.9%
                uptime SLA. Procurement-friendly out of the box.
              </span>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <span>
                <strong>Need workforce management?</strong> Shift scheduling, agent availability,
                team-level performance dashboards — all built-in for high-volume teams.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="vs-final-cta">
        <div className="vs-final-cta-inner">
          <h2 className="vs-final-cta-h2">Skip the sales cycle. Start dialing today.</h2>
          <p className="vs-final-cta-p">
            $35/week ($140/mo) per seat. Cancel any time — even mid-week. No contract, no
            obligation, no recovery call from a "Customer Success" rep. Just a modern dialer
            that works.
          </p>
          <div className="vs-cta-row">
            <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}