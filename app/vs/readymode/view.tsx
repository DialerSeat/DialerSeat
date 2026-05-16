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
  { feature: 'Self-serve signup (no demo required)', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: 'Default', competitor: false },
  { feature: 'Monthly billing option', dialerseat: true, competitor: true },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$500–$2,000' },
  { feature: 'Annual contract required', dialerseat: false, competitor: 'Typical' },
  { feature: 'Free trial', dialerseat: '7 days, full access', competitor: 'None' },
  { feature: 'Power dialer', dialerseat: true, competitor: true },
  { feature: 'Preview dialer', dialerseat: true, competitor: true },
  { feature: 'Progressive dialer', dialerseat: true, competitor: true },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: true },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (drops in 1.8s)', dialerseat: 'Always on', competitor: 'Optional' },
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
  { feature: 'Modern UI (built 2026)', dialerseat: true, competitor: 'Dated' },
  { feature: 'TCPA window pre-flight (server-side)', dialerseat: true, competitor: 'Partial' },
  { feature: '99.9% uptime SLA', dialerseat: true, competitor: true },
  { feature: 'SOC 2 Type II', dialerseat: true, competitor: true },
]

export default function VsReadyModeView() {
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
        .vs-btn-secondary {
          padding: 16px 32px;
          background: transparent;
          color: white;
          font-size: 13px;
          letter-spacing: 2.5px;
          font-weight: bold;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.3);
          text-decoration: none;
          display: inline-block;
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
        .honest-gap {
          background: rgba(138,106,26,0.05);
          border: 1px solid rgba(138,106,26,0.3);
          border-radius: 12px;
          padding: 28px;
          margin-top: 24px;
        }
        .decision-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }
        .decision-card {
          padding: 28px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 12px;
        }
        .decision-card.ours { border-top: 4px solid ${T.blue}; }
        .decision-card.theirs { border-top: 4px solid ${T.muted}; }
        .decision-card-title {
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
          color: ${T.muted};
          margin-bottom: 16px;
        }
        .decision-card.ours .decision-card-title { color: ${T.blue}; }
        .decision-card-h3 {
          font-size: 22px;
          font-weight: 800;
          color: ${T.text};
          margin-bottom: 16px;
        }
        .decision-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .decision-list li {
          padding: 8px 0;
          font-size: 14px;
          color: ${T.text};
          line-height: 1.5;
          display: flex;
          gap: 10px;
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
        .vs-incentive-strip {
          background: rgba(74,158,255,0.06);
          border: 1px dashed rgba(74,158,255,0.4);
          border-radius: 8px;
          padding: 20px 24px;
          margin: 40px 0;
          font-size: 14px;
          color: ${T.text};
          line-height: 1.6;
        }
        .vs-incentive-strip strong { color: ${T.blue}; letter-spacing: 1px; }

        @media (max-width: 768px) {
          .vs-hero { padding: 56px 20px 64px; }
          .vs-h1 { font-size: 36px; }
          .vs-subhead { font-size: 16px; }
          .vs-section { padding: 56px 20px; }
          .vs-section-h2 { font-size: 28px; }
          .price-grid, .win-grid, .decision-grid { grid-template-columns: 1fr; }
          .feature-table th, .feature-table td { padding: 10px 12px; font-size: 12px; }
          .vs-final-cta { padding: 56px 20px; }
          .vs-final-cta-h2 { font-size: 30px; }
          .vs-btn-primary, .vs-btn-secondary { width: 100%; }
        }
      `}</style>

      <div className="vs-hero">
        <div className="vs-hero-inner">
          <div className="vs-eyebrow">DIALERSEAT VS READYMODE</div>
          <h1 className="vs-h1">
            ReadyMode is built for 2014.<br />
            <span className="versus">DialerSeat is built for 2026.</span>
          </h1>
          <p className="vs-subhead">
            Same multi-line predictive dialing, live coaching, and CRM integrations — at
            <strong> just $35/week</strong> ($140/mo). No $500–$2,000 setup fee, no mandatory
            demo call, no annual contract, no dated UI agents complain about. Sign up, configure
            your team, and dial in under 10 minutes.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">TALK TO A HUMAN</Link>
          </div>
        </div>
      </div>

      <div className="vs-section">
        <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
        <h2 className="vs-section-h2">If you have 5+ reps and budget for $200/seat, you have two options.</h2>
        <p className="vs-section-lede">
          ReadyMode is the legacy choice — comprehensive, customizable, and proven. DialerSeat is
          the modern choice — same feature set, half the friction, none of the contract lock-in,
          and the only dialer in the category that bills weekly. Here's how they actually stack
          up in 2026.
        </p>

        <div className="verdict-card">
          <div className="verdict-title">▸ BOTTOM LINE</div>
          <p className="verdict-text">
            <strong>Pick DialerSeat</strong> if you want to onboard 50 reps in a day, pay
            $35/week per seat with no add-on creep, and skip the enterprise sales cycle.{' '}
            <strong>Pick ReadyMode</strong> if your buying committee requires a 60-day RFP, a
            white-glove implementation manager, and a CFO who insists on annual commitments.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">PRICING IN 2026</div>
        <h2 className="vs-section-h2">$35/week flat vs $200–$300/seat once the add-ons land.</h2>
        <p className="vs-section-lede">
          ReadyMode publishes a $165 starting price. Every customer we've spoken to ends up at
          $200–$249 after implementation fees, custom reports, and the features ReadyMode hides
          behind tier upgrades. We don't have tier upgrades. We bill weekly. No one else in the
          category does.
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
              <li className="bad"><span className="cross">✕</span> Mandatory sales demo</li>
              <li className="bad"><span className="cross">✕</span> Pricing only revealed after demo</li>
              <li className="bad"><span className="cross">✕</span> Features gated behind iQ tier</li>
              <li className="bad"><span className="cross">✕</span> Inbound minutes billed extra</li>
              <li className="bad"><span className="cross">✕</span> Custom reports = upcharge</li>
            </ul>
          </div>
        </div>

        <div className="vs-incentive-strip">
          <strong>BONUS:</strong> DialerSeat pays YOU to spread the word. Our referral program
          rewards teams who bring in other paying customers — up to $7,500 per power user, or
          equivalent in free seats. ReadyMode doesn't. Details on our incentives page.
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
        <h2 className="vs-section-h2">Every feature ReadyMode advertises — plus the ones they don't have.</h2>
        <p className="vs-section-lede">
          We did the comparison so you don't have to sit through their demo. Honest scoring below;
          green ✓ = full support, red ✕ = not available, amber = partial or paywalled.
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
        <h2 className="vs-section-h2">Six things ReadyMode literally cannot do.</h2>

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
            <div className="win-card-title">2. Multiple scripts per campaign with live mid-call switching</div>
            <p className="win-card-body">
              Cold open, voicemail leave-behind, three objection handlers, closing script — all one
              tap away on every call. ReadyMode forces you into one script per campaign. We don't.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">3. Per-campaign dialer mode (Preview, Power, Progressive, Predictive)</div>
            <p className="win-card-body">
              Your cold list runs Predictive. Your hot follow-ups run Preview. Same agent, same
              session, different modes per campaign. ReadyMode locks you to one mode account-wide.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">4. Calendar-aligned analytics (Sunday + 1st-of-month resets)</div>
            <p className="win-card-body">
              "This week" means Sunday through now, not a rolling 7-day window. "This month" means
              the 1st through now. Matches how sales managers actually think about pipeline.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">5. Lapsed-user data preservation</div>
            <p className="win-card-body">
              Pause your subscription, keep your campaigns, leads, recordings, and call history.
              Resubscribe and pick up where you left off. ReadyMode deletes or charges storage fees.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">6. Modern UI built in 2026</div>
            <p className="win-card-body">
              ReadyMode reviewers consistently describe the UI as "Windows 8" or "dated." We built
              DialerSeat from scratch in 2026 with a modern design system. Your reps will notice.
            </p>
          </div>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHERE READYMODE WINS</div>
        <h2 className="vs-section-h2">Honest about where they're still ahead.</h2>
        <p className="vs-section-lede">
          We don't lie about competitors. Two areas where ReadyMode has a real edge — and what
          we're doing about it.
        </p>

        <div className="honest-gap">
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ DEPTH OF CUSTOMIZATION FOR 100+ SEAT CALL CENTERS
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            ReadyMode has 10+ years of feature accumulation aimed at traditional 100+ seat call
            centers — custom inbound queues, deeply branched IVR flows, agent scoring rubrics with
            7 weighted dimensions. If your operation needs that depth of custom config, ReadyMode
            still wins. We're building toward parity, prioritizing the features 80% of teams
            actually use.
          </p>
        </div>

        <div className="honest-gap" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ WHITE-GLOVE IMPLEMENTATION MANAGER
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            ReadyMode assigns a dedicated implementation manager who runs your rollout. Helpful if
            you've never used a dialer. Our self-serve setup is built so you don't need one, but if
            you want a human walking you through, our team is available — it's just not packaged
            as a $2,000 line item.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHICH ONE IS RIGHT FOR YOU</div>
        <h2 className="vs-section-h2">Two clear pictures.</h2>

        <div className="decision-grid">
          <div className="decision-card ours">
            <div className="decision-card-title">▸ PICK DIALERSEAT IF</div>
            <h3 className="decision-card-h3">You want to dial today, not next month.</h3>
            <ul className="decision-list">
              <li>✓ You'd rather configure software than sit through demos</li>
              <li>✓ Your team size is 5–500 reps</li>
              <li>✓ $35/week is more predictable than $200–$249 + add-ons</li>
              <li>✓ You want weekly or monthly billing, not annual lock-in</li>
              <li>✓ Modern UI matters for rep retention and morale</li>
              <li>✓ You need to onboard new reps in hours, not weeks</li>
              <li>✓ You use Salesforce / HubSpot / Pipedrive and want native sync</li>
              <li>✓ You want AI transcription and call summaries on every call</li>
            </ul>
          </div>

          <div className="decision-card theirs">
            <div className="decision-card-title">▸ PICK READYMODE IF</div>
            <h3 className="decision-card-h3">You're a traditional 100+ seat call center.</h3>
            <ul className="decision-list">
              <li>○ You have budget for $2,000 setup + $200+/seat ongoing</li>
              <li>○ Your buying committee requires a 60-day RFP process</li>
              <li>○ Annual contracts work for your procurement</li>
              <li>○ You need 7-dimension agent scoring with custom weights</li>
              <li>○ You want a dedicated implementation manager</li>
              <li>○ Custom inbound IVR flow is a core requirement</li>
              <li>○ Your reps are already trained on ReadyMode</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="vs-final-cta">
        <div className="vs-final-cta-inner">
          <h2 className="vs-final-cta-h2">Skip the demo. Start dialing today.</h2>
          <p className="vs-final-cta-p">
            7-day free trial with full team features unlocked. No credit card required. After
            trial: just $35/week per seat ($140/mo). Cancel any time. No contract, no obligation,
            no recovery call from a "Customer Success" rep.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">QUESTIONS? TALK TO US</Link>
          </div>
        </div>
      </div>
    </div>
  )
}