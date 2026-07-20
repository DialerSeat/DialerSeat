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
  { feature: 'Built for outbound sales campaigns', dialerseat: true, competitor: false },
  { feature: 'Lead lists with dispositions', dialerseat: true, competitor: false },
  { feature: 'Predictive dialer for cold outbound', dialerseat: true, competitor: false },
  { feature: 'Preview / power / progressive dialer', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: false },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Per-seat pricing, no capacity planning', dialerseat: true, competitor: false },
  { feature: 'SIP trunk / carrier included', dialerseat: true, competitor: false },
  { feature: 'Hosting decision required', dialerseat: false, competitor: true },
  { feature: 'General office PBX (extensions, ring groups)', dialerseat: false, competitor: true },
  { feature: 'Video conferencing / team chat', dialerseat: false, competitor: true },
  { feature: 'Public per-unit pricing', dialerseat: true, competitor: true },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Softphone app' },
]

export default function Vs3cxView() {
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
          .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; align-items: stretch; }
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
          .tier-rows { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
          .tier-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            padding: 10px 14px;
            background: ${T.bg};
            border: 1px solid ${T.border};
            border-radius: 8px;
          }
          .tier-row-name { font-size: 13px; font-weight: bold; color: ${T.text}; }
          .tier-row-desc { font-size: 11px; color: ${T.muted}; display: block; margin-top: 2px; }
          .tier-row-price { font-size: 15px; font-weight: 800; color: ${T.text}; white-space: nowrap; text-align: right; }
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
            <div className="vs-eyebrow">DIALERSEAT VS 3CX</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              3CX runs your phones.<br />
              <span className="versus">DialerSeat runs your outbound sales.</span>
            </h1>
            <p className="vs-subhead">
              3CX is a real PBX and it does that job well. It isn't built for cold-outbound sales
              campaigns — no lead lists, no dispositions, no predictive dialer for sales, no AMD.
              If you're comparing the two for a sales team, here's what that actually means.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">Different tools, honestly. Not a fair fight either way.</h2>
          <p className="vs-section-lede">
            3CX is priced and built around business phone infrastructure — extensions, ring groups,
            video conferencing, a PBX for the whole office — licensed by simultaneous call capacity,
            not by seat. DialerSeat™ is built for one job: running outbound sales campaigns, with
            lead lists, dispositions, compliance, and a dialer that speeds up or slows down per
            campaign. Neither product is trying to be the other.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Use DialerSeat™</strong> if you're running outbound sales campaigns — cold
              lists, dispositions, follow-ups, compliance windows. <strong>Use 3CX</strong> if you
              need a general business phone system for the whole office. Plenty of teams
              legitimately run both: 3CX for company-wide phone infrastructure, DialerSeat for the
              sales floor's outbound dialing.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, all-in versus a capacity-planning exercise.</h2>
          <p className="vs-section-lede">
            3CX licenses by simultaneous call (SC) capacity per system, per year — not per seat —
            so pricing depends on estimating concurrent call volume, then adding separate SIP
            trunk, hosting, and support costs on top. DialerSeat™ is $35 a week per seat, billed
            weekly, with the phone lines, carrier registration, and support already included.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">One number. No planning.</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Billed weekly. Cancel any time — no contract.</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Carrier lines, hosting, and support all included</li>
                <li><span className="check">✓</span> No capacity/SC planning required</li>
                <li><span className="check">✓</span> Self-serve signup, dialing in under 10 minutes</li>
                <li><span className="check">✓</span> Built-in lead lists, dispositions, compliance</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">3CX</div>
              <div className="price-card-name">Licensed by call capacity, per year</div>
              <div className="tier-rows">
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">Basic / PRO</span>
                    <span className="tier-row-desc">8 simultaneous calls, ~40 users</span>
                  </div>
                  <span className="tier-row-price">~$350–395/yr</span>
                </div>
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">PRO</span>
                    <span className="tier-row-desc">64 simultaneous calls, mid-market</span>
                  </div>
                  <span className="tier-row-price">~$2,495/yr</span>
                </div>
                <div className="tier-row">
                  <div>
                    <span className="tier-row-name">Enterprise / AI</span>
                    <span className="tier-row-desc">Adds AI transcription, sentiment</span>
                  </div>
                  <span className="tier-row-price">Higher still</span>
                </div>
              </div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> SIP trunk billed separately (~$15–30/channel/mo)</li>
                <li className="bad"><span className="cross">✕</span> Hosting billed separately (~$25–250+/mo)</li>
                <li className="bad"><span className="cross">✕</span> Support tickets ~$75 each</li>
                <li className="bad"><span className="cross">✕</span> Even the entry tier has no lead lists or dispositions</li>
                <li className="bad"><span className="cross">✕</span> No outbound sales campaign tooling at any tier</li>
              </ul>
            </div>
          </div>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            3CX figures are typical published ranges as of 2026 for illustration — 3CX itself notes
            that pricing shifts with promotions and licensing changes, and quotes a custom price
            per deployment.
          </p>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            This table is scoped to outbound sales campaign work, which is what DialerSeat™ is
            built for. On general office PBX features — extensions, video conferencing, ring
            groups — 3CX is the more complete product, and that's noted honestly below too.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>3CX</th>
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
          <h2 className="vs-section-h2">3CX has a reseller ecosystem. It doesn't have whitelabel.</h2>
          <p className="vs-section-lede">
            3CX's Channel Partner Program is built for IT/MSPs to sell and host 3CX systems for
            their clients — but the product itself stays 3CX-branded to whoever's using it. There's
            no option to run it under your own name. DialerSeat™ Manager+ is a flat $75/month
            add-on that puts your brand on the platform, no MSP partnership required.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT MANAGER+</div>
              <div className="price-card-name">Whitelabel, direct</div>
              <div>
                <span className="price-card-big">$75</span>
                <span className="price-card-suffix">/month flat</span>
              </div>
              <div className="price-card-monthly">Plus $35/week per seat — no partner program to join first</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Full whitelabel — your brand, your domain</li>
                <li><span className="check">✓</span> No reseller tier or revenue targets to hit</li>
                <li><span className="check">✓</span> Team performance + campaign oversight included</li>
                <li><span className="check">✓</span> One flat fee, sold direct</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">3CX CHANNEL PARTNER</div>
              <div className="price-card-name">Resell 3CX-branded systems</div>
              <div>
                <span className="price-card-big">1,000+</span>
                <span className="price-card-suffix">EUR/USD/GBP per year</span>
              </div>
              <div className="price-card-monthly">Five partner tiers with revenue targets — product stays 3CX-branded</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel — end product carries 3CX branding</li>
                <li className="bad"><span className="cross">✕</span> Partner tier requires ongoing revenue targets</li>
                <li className="bad"><span className="cross">✕</span> Built for hosting/reselling, not sales-team management</li>
                <li className="bad"><span className="cross">✕</span> Separate cost from the underlying license/SC pricing</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things 3CX isn't built to do.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Built for sales campaigns, not just calls</div>
              <p className="win-card-body">
                Lead lists, dispositions, and per-campaign tracking. 3CX has queues and ring
                groups — general office routing, not a sales pipeline.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. AMD voicemail filtering, always on</div>
              <p className="win-card-body">
                Every outbound call gets answering-machine detection automatically. 3CX has no
                equivalent — it's not built to dial cold lists in the first place.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. TCPA windows enforced server-side</div>
              <p className="win-card-body">
                Calling-hour compliance per lead's state, enforced automatically. A general PBX
                has no concept of this.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. One price, nothing to plan</div>
              <p className="win-card-body">
                $35/seat/week, carrier lines and hosting included. No estimating simultaneous-call
                capacity, no separate SIP trunk shopping, no hosting decision.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. No per-ticket support fees</div>
              <p className="win-card-body">
                Support is part of the price. 3CX's support model can run about $75 per ticket on
                top of the license.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Weekly billing, self-serve signup</div>
              <p className="win-card-body">
                Sign up and dial within minutes. 3CX licensing is annual, and getting a system live
                means sizing capacity, choosing a hosting model, and configuring SIP trunks first.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Running outbound sales? $35 a week gets you dialing today.</h2>
            <p className="vs-final-cta-p">
              No capacity planning, no SIP trunk to configure, no separate hosting decision.
              Self-serve signup means first dial in under 10 minutes.
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
