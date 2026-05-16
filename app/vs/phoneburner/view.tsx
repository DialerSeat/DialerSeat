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
  { feature: 'Public pricing', dialerseat: '$35/week ($140/mo) flat', competitor: '$140–$215 + add-ons' },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'Annual contract for best price', dialerseat: false, competitor: true },
  { feature: 'Monthly billing option', dialerseat: 'Available', competitor: 'Premium upcharge' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Free trial', dialerseat: '7 days, full access', competitor: '60 calling minutes' },
  { feature: 'Single-line power dialer', dialerseat: true, competitor: true },
  { feature: 'Triple-line / multi-line dialer', dialerseat: true, competitor: false },
  { feature: 'True predictive dialer with pacing', dialerseat: true, competitor: false },
  { feature: 'Progressive dialer', dialerseat: true, competitor: false },
  { feature: 'Preview dialer', dialerseat: true, competitor: false },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter (drops in 1.8s)', dialerseat: 'Always on', competitor: true },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Voicemail drop', dialerseat: true, competitor: true },
  { feature: 'Live call monitoring', dialerseat: 'Included', competitor: 'Professional+ only' },
  { feature: 'Whisper + barge coaching', dialerseat: 'Included', competitor: 'Premium only' },
  { feature: 'AI call transcription', dialerseat: 'Included', competitor: 'Add-on' },
  { feature: 'AI call summaries', dialerseat: 'Included', competitor: false },
  { feature: 'AI sentiment analysis', dialerseat: 'Included', competitor: false },
  { feature: 'DNC scrubbing on upload', dialerseat: true, competitor: true },
  { feature: 'Local presence dialing', dialerseat: 'Included', competitor: 'Included' },
  { feature: 'Spam monitoring + auto-rotation', dialerseat: 'Included', competitor: 'ARMOR ~$35/seat add-on' },
  { feature: 'Connect score / pickup probability', dialerseat: 'Included', competitor: 'Connect Scores ~$20/seat add-on' },
  { feature: 'SMS / A2P 10DLC', dialerseat: 'Included', competitor: 'Premium tier only' },
  { feature: 'Inbound numbers', dialerseat: 'Included', competitor: 'Premium tier only' },
  { feature: 'CRM integrations', dialerseat: 'Salesforce, HubSpot, Pipedrive, Zoho native', competitor: '150+ integrations' },
  { feature: 'Public API + webhooks', dialerseat: true, competitor: true },
  { feature: 'Single-contact calling (call one person)', dialerseat: true, competitor: false },
  { feature: 'Dial list flexible size (not forced 10/25/50)', dialerseat: true, competitor: false },
  { feature: 'See contact name during dial', dialerseat: true, competitor: 'Reported issue' },
  { feature: 'Calendar-aligned analytics', dialerseat: true, competitor: false },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: false },
  { feature: 'PWA + native iOS/Android/macOS/Windows apps', dialerseat: true, competitor: false },
  { feature: 'TCPA window pre-flight (server-side)', dialerseat: true, competitor: 'Partial' },
  { feature: '99.9% uptime SLA', dialerseat: true, competitor: true },
  { feature: 'SOC 2 Type II', dialerseat: true, competitor: true },
]

export default function VsPhoneBurnerView() {
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
        .honest-gap {
          background: rgba(138,106,26,0.05);
          border: 1px solid rgba(138,106,26,0.3);
          border-radius: 12px;
          padding: 28px;
          margin-top: 24px;
        }
        .decision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
        .decision-card { padding: 28px; background: white; border: 1px solid ${T.border}; border-radius: 12px; }
        .decision-card.ours { border-top: 4px solid ${T.blue}; }
        .decision-card.theirs { border-top: 4px solid ${T.muted}; }
        .decision-card-title { font-size: 11px; letter-spacing: 3px; font-weight: bold; color: ${T.muted}; margin-bottom: 16px; }
        .decision-card.ours .decision-card-title { color: ${T.blue}; }
        .decision-card-h3 { font-size: 22px; font-weight: 800; color: ${T.text}; margin-bottom: 16px; }
        .decision-list { list-style: none; padding: 0; margin: 0; }
        .decision-list li { padding: 8px 0; font-size: 14px; color: ${T.text}; line-height: 1.5; display: flex; gap: 10px; }
        .vs-final-cta {
          background: linear-gradient(135deg, ${T.dark}, ${T.darker});
          color: white;
          padding: 80px 32px;
          text-align: center;
        }
        .vs-final-cta-inner { max-width: 720px; margin: 0 auto; }
        .vs-final-cta-h2 { font-size: 42px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 16px 0; line-height: 1.15; }
        .vs-final-cta-p { font-size: 17px; color: #c4c8d8; line-height: 1.6; margin: 0 0 32px 0; }
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
          .price-grid, .win-grid, .decision-grid { grid-template-columns: 1fr; }
          .feature-table th, .feature-table td { padding: 10px 12px; font-size: 12px; }
          .vs-final-cta { padding: 56px 20px; }
          .vs-final-cta-h2 { font-size: 30px; }
          .vs-btn-primary, .vs-btn-secondary { width: 100%; }
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
            Same Tier-1 carrier audio. Same spam protection. Same CRM integrations.
            At <strong>just $35/week</strong> ($140/mo) — without being capped at single-line.
            Without ARMOR as a $35/seat add-on. Without Connect Scores as a $20/seat add-on.
            Without an annual contract for the best price. Multi-line predictive included,
            weekly billing default.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">SEE PLANS</Link>
          </div>
        </div>
      </div>

      <div className="vs-section">
        <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
        <h2 className="vs-section-h2">PhoneBurner is the gold standard for single-line. We're the standard for everything else.</h2>
        <p className="vs-section-lede">
          PhoneBurner earned its 4.7/5 G2 rating with rock-solid single-line dialing, instant
          connections, and the best-in-class ARMOR spam protection. Their reputation is real. The
          problem: they stop at single-line, they hide their best features behind annual
          contracts, and the headline $140/seat number lands at $200–$250 once add-ons stack up.
          We charge $35/week. Everything is included.
        </p>

        <div className="verdict-card">
          <div className="verdict-title">▸ BOTTOM LINE</div>
          <p className="verdict-text">
            <strong>Pick DialerSeat</strong> if you need multi-line predictive speed, want spam
            protection and AI features included (not stacked as add-ons), and prefer weekly
            billing over annual lock-in.{' '}
            <strong>Pick PhoneBurner</strong> if you're committed to single-line dialing for
            quality reasons and your team is happy on an annual contract with their ecosystem.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">THE REAL COST OF PHONEBURNER</div>
        <h2 className="vs-section-h2">$140 advertised. $200–$250 when ARMOR + Connect Scores land.</h2>
        <p className="vs-section-lede">
          PhoneBurner's two most-mentioned features in their own marketing — ARMOR spam protection
          and Connect Scores pickup probability — aren't included in the base price. Independent
          analysts estimate them at ~$35/seat and ~$20/seat respectively. Real customer bills land
          here:
        </p>

        <div className="cost-breakdown">
          <div className="cost-row"><span className="item">Professional plan (annual billing)</span><span className="price">$165.00/mo</span></div>
          <div className="cost-row"><span className="item">ARMOR spam protection add-on</span><span className="price">~$35.00/mo</span></div>
          <div className="cost-row"><span className="item">Connect Scores add-on</span><span className="price">~$20.00/mo</span></div>
          <div className="cost-row"><span className="item">SMS add-on (Premium tier requirement)</span><span className="price">+$18.00/mo</span></div>
          <div className="cost-row"><span className="item">Real PhoneBurner total per seat</span><span className="price">$238.00/mo</span></div>
        </div>

        <div className="price-grid" style={{ marginTop: 32 }}>
          <div className="price-card winner">
            <div className="price-card-label">DIALERSEAT</div>
            <div className="price-card-name">Everything included, weekly</div>
            <div>
              <span className="price-card-big">$35</span>
              <span className="price-card-suffix">/seat/week</span>
            </div>
            <div className="price-card-monthly">≈ $140/month — pick weekly or monthly billing</div>
            <ul className="price-card-list">
              <li><span className="check">✓</span> Multi-line predictive dialer included</li>
              <li><span className="check">✓</span> Spam protection + reputation monitoring included</li>
              <li><span className="check">✓</span> Connect probability scoring included</li>
              <li><span className="check">✓</span> AI transcription + summaries included</li>
              <li><span className="check">✓</span> SMS + inbound numbers included</li>
              <li><span className="check">✓</span> Live monitoring + coaching included</li>
              <li><span className="check">✓</span> Native CRM integrations included</li>
              <li><span className="check">✓</span> Weekly billing default — no annual lock-in</li>
              <li><span className="check">✓</span> Unlimited outbound minutes</li>
            </ul>
          </div>

          <div className="price-card">
            <div className="price-card-label">PHONEBURNER</div>
            <div className="price-card-name">Add-on stack</div>
            <div>
              <span className="price-card-big">$200–$250</span>
              <span className="price-card-suffix">/seat/month (real)</span>
            </div>
            <div className="price-card-monthly">Annual contract for best price. No weekly option.</div>
            <ul className="price-card-list">
              <li className="bad"><span className="cross">✕</span> Single-line dialing only</li>
              <li className="bad"><span className="cross">✕</span> ARMOR as ~$35/seat add-on</li>
              <li className="bad"><span className="cross">✕</span> Connect Scores as ~$20/seat add-on</li>
              <li className="bad"><span className="cross">✕</span> SMS gated to Premium tier</li>
              <li className="bad"><span className="cross">✕</span> Inbound gated to Premium tier</li>
              <li className="bad"><span className="cross">✕</span> Live monitoring gated to Professional</li>
              <li className="bad"><span className="cross">✕</span> Coaching gated to Premium</li>
              <li className="bad"><span className="cross">✕</span> Annual contract for best price</li>
              <li className="bad"><span className="cross">✕</span> Add-on prices hidden from website</li>
            </ul>
          </div>
        </div>

        <div className="vs-incentive-strip">
          <strong>FOR TEAMS:</strong> 10-rep team on PhoneBurner real-bill = ~$2,380/mo. 10-rep
          team on DialerSeat = $1,400/mo ($350/week). <strong>Save $11,760/year</strong> — plus
          get multi-line dialing PhoneBurner doesn't offer.
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
        <h2 className="vs-section-h2">Where the tier-gating shows up.</h2>
        <p className="vs-section-lede">
          PhoneBurner's three tiers (Standard, Professional, Premium) gate critical features
          behind upgrades. We include everything for $35/week. Side-by-side scoring below —
          partial means "available but gated or add-on."
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
        <h2 className="vs-section-h2">Six things PhoneBurner can't or won't do.</h2>

        <div className="win-grid">
          <div className="win-card">
            <div className="win-card-title">1. Weekly billing at $35/week — nobody else does this</div>
            <p className="win-card-body">
              $35 this week. Cancel before next Monday and you owe nothing more. PhoneBurner wants
              annual commitments to give you their best price. Different category of customer
              experience.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">2. Multi-line dialing — predictive, triple-line, all of it</div>
            <p className="win-card-body">
              PhoneBurner is single-line only. For high-volume outbound, that's a 3x speed
              difference. Reviewers on Reddit and G2 cite "no multi-line" as their #1 complaint.
              We have Predictive, Progressive, Power, and Preview, configurable per campaign.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">3. Everything included, no add-on stacking</div>
            <p className="win-card-body">
              ARMOR, Connect Scores, SMS, inbound, live monitoring, coaching — all included in our
              $35/week base. PhoneBurner stacks them into separate add-ons and tiers that push
              real bills from $140 to $250 per seat.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">4. Multiple scripts per campaign + live switching</div>
            <p className="win-card-body">
              Cold open, voicemail leave-behind, objection handlers, closer — tabs in your dialer,
              one tap away on every call. PhoneBurner expects one script per session.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">5. Flexible dial-list size + single-contact calling</div>
            <p className="win-card-body">
              PhoneBurner forces dial lists into 10/25/50 increments and doesn't support
              single-contact calling — two of the most-cited frustrations in Capterra reviews. We
              support any list size and one-off contact calls.
            </p>
          </div>
          <div className="win-card">
            <div className="win-card-title">6. See contact name during the call</div>
            <p className="win-card-body">
              Multiple PhoneBurner reviewers flag that they "can't see the name of the person I'm
              calling" — a basic CRM visibility issue at a $165+/seat tool. We always show full
              contact context during the call.
            </p>
          </div>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHERE PHONEBURNER WINS</div>
        <h2 className="vs-section-h2">Genuine credit where it's due.</h2>
        <p className="vs-section-lede">
          PhoneBurner has 15+ years of category leadership for a reason. Two real strengths.
        </p>

        <div className="honest-gap">
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ ARMOR SPAM PROTECTION IS GENUINELY BEST-IN-CLASS
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            ARMOR monitors number reputation across AT&T, Verizon, and T-Mobile and automatically
            handles remediation when numbers get flagged. Their 15 years of carrier relationships
            give them an edge here. Our spam monitoring and auto-rotation match feature parity,
            but PhoneBurner's carrier remediation depth is real. We're closing the gap.
          </p>
        </div>

        <div className="honest-gap" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: T.amber }}>
            ▸ INTEGRATION ECOSYSTEM BREADTH (150+)
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: 0 }}>
            PhoneBurner has 150+ integrations — every major CRM, plus dozens of niche tools. We
            have native two-way sync with Salesforce, HubSpot, Pipedrive, and Zoho, plus a public
            API. For 95% of teams that's enough. If you need a niche obscure integration that
            PhoneBurner has and we don't, you can build it via our API.
          </p>
        </div>
      </div>

      <div className="vs-section" style={{ paddingTop: 0 }}>
        <div className="vs-section-eyebrow">WHICH ONE IS RIGHT FOR YOU</div>
        <h2 className="vs-section-h2">Honest decision framework.</h2>

        <div className="decision-grid">
          <div className="decision-card ours">
            <div className="decision-card-title">▸ PICK DIALERSEAT IF</div>
            <h3 className="decision-card-h3">You want multi-line speed and everything included.</h3>
            <ul className="decision-list">
              <li>✓ Your team needs multi-line predictive dialing</li>
              <li>✓ You don't want to stack add-ons to get core features</li>
              <li>✓ Weekly or monthly billing fits your finance team better than annual</li>
              <li>✓ You want AI transcription + summaries included</li>
              <li>✓ Live monitoring matters from day one (not tier upgrade later)</li>
              <li>✓ SMS as a 2-touch channel is part of your strategy</li>
              <li>✓ Modern UI matters for rep retention</li>
              <li>✓ Your stack is Salesforce, HubSpot, Pipedrive, or Zoho</li>
            </ul>
          </div>

          <div className="decision-card theirs">
            <div className="decision-card-title">▸ PICK PHONEBURNER IF</div>
            <h3 className="decision-card-h3">Single-line + ARMOR's spam protection is your top priority.</h3>
            <ul className="decision-list">
              <li>○ You believe single-line beats multi-line for quality reasons</li>
              <li>○ You're already on a PhoneBurner annual contract</li>
              <li>○ ARMOR's carrier remediation depth is non-negotiable</li>
              <li>○ Your team uses a niche integration only PhoneBurner has</li>
              <li>○ You don't need AI transcription / summaries yet</li>
              <li>○ Your team is happy on Standard tier without live monitoring</li>
              <li>○ Annual contract terms suit your procurement</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="vs-final-cta">
        <div className="vs-final-cta-inner">
          <h2 className="vs-final-cta-h2">Multi-line speed. $35 a week. No annual lock-in.</h2>
          <p className="vs-final-cta-p">
            7-day free trial with full features unlocked. No 60-minute calling cap. After trial:
            just $35/week ($140/mo) per seat. Cancel any time — even mid-week. No recovery call
            from Customer Success.
          </p>
          <div className="vs-cta-row">
            <Link href="/" className="vs-btn-primary">START FREE TRIAL →</Link>
            <Link href="/contact" className="vs-btn-secondary">TALK TO US</Link>
          </div>
        </div>
      </div>
    </div>
  )
}