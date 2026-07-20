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
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'No annual contract required', dialerseat: true, competitor: true },
  { feature: 'Per-seat cost', dialerseat: '$35/wk, cancel anytime', competitor: '$129–$169/mo' },
  { feature: 'AI add-on stacks on top of seat price', dialerseat: false, competitor: '+$59–$79/seat' },
  { feature: 'Setup fee', dialerseat: '$0', competitor: 'Not published' },
  { feature: 'Named dialer modes (power/predictive/etc.)', dialerseat: 'Preview, Power, Progressive, Predictive', competitor: 'Not specified anywhere on their site' },
  { feature: 'Predictive dialer (multi-line)', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Per-campaign dialer mode', dialerseat: true, competitor: false },
  { feature: 'AMD voicemail filter always on', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: false },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Not specified' },
  { feature: 'STIR/SHAKEN A-attestation', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Built-in CRM with lead profiles', dialerseat: true, competitor: true },
  { feature: 'AI-assisted call notes', dialerseat: false, competitor: 'Tacklebox AI add-on' },
  { feature: 'Live call monitor / whisper / barge', dialerseat: true, competitor: true },
  { feature: 'Per-minute call charges on top of seat price', dialerseat: false, competitor: 'From $0.042/min' },
  { feature: 'Per-number charges', dialerseat: false, competitor: 'From $4.60/mo' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: true },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Not found' },
  { feature: 'Lapsed-user data preservation', dialerseat: true, competitor: 'Not specified' },
]

export default function VsHookedCrmView() {
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
            <div className="vs-eyebrow">DIALERSEAT VS HOOKED CRM</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Pricing and features last verified 7/19/26</div>
            <h1 className="vs-h1">
              They call themselves a dialer.<br />
              <span className="versus">We actually list our dialer modes.</span>
            </h1>
            <p className="vs-subhead">
              Hooked CRM markets itself as "The All-in-One Dialer & CRM," but their own product
              pages never name a single dialer mode — no power, predictive, or progressive dialing
              anywhere in their documentation. DialerSeat™ gives you all four, configurable per
              campaign, at <strong>$35 per seat per week</strong> with weekly billing and zero
              contract.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A real CRM and calling workspace. An unclear dialer.</h2>
          <p className="vs-section-lede">
            Hooked CRM's calling workspace, CRM platform, and Tacklebox AI product pages are
            genuinely strong on inbound call handling, automatic lead creation, AI-assisted notes,
            and supervisor tools like monitor, whisper, and barge. What none of their public pages
            describe is a named outbound dialing mode — no predictive, power, or progressive dialer
            terminology anywhere on their site, unlike every other dialer in this category.
            DialerSeat™ is built specifically for outbound: four dialer modes, lead lists, and
            dispositions, all included.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if outbound cold-calling volume is the job —
              you want a specific, named dialer mode for a specific campaign, not a generalized
              calling workspace. Stay on Hooked CRM if your priority is inbound lead handling, an
              AI-assisted CRM layer, and supervisor coaching tools, and outbound dialing mode is a
              secondary concern.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, flat, versus $129–$169 a month plus add-ons.</h2>
          <p className="vs-section-lede">
            Hooked CRM's published pricing is genuinely more transparent than most legacy dialers —
            real numbers, no demo required to see them. Their per-seat price actually drops as your
            team grows: $169/seat at 1–20 seats, $149/seat at 21–49, $129/seat at 50–99, custom
            above that. The catch is what's not in the base price: Tacklebox AI (their AI coaching
            and reporting layer) is a separate $59–$79/seat add-on, and calls, phone numbers, API
            requests, and recording storage are all billed on top by usage. DialerSeat™ is $35/week,
            flat, cancel anytime — every dialer mode, AI or not, included at that one price.
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
                <li><span className="check">✓</span> All dialer modes included, no add-on</li>
                <li><span className="check">✓</span> No per-minute or per-number charges</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> Works on every device (PWA install)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">HOOKED CRM</div>
              <div className="price-card-name">Seat tiers + usage + AI add-on</div>
              <div>
                <span className="price-card-big">$129+</span>
                <span className="price-card-suffix">/seat/month</span>
              </div>
              <div className="price-card-monthly">Starter tier is $169/seat. Tacklebox AI is $59–$79/seat extra.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> AI features cost extra, per seat</li>
                <li className="bad"><span className="cross">✕</span> Per-minute call charges from $0.042/min</li>
                <li className="bad"><span className="cross">✕</span> Per-number charges from $4.60/mo</li>
                <li className="bad"><span className="cross">✕</span> No weekly billing option</li>
                <li className="bad"><span className="cross">✕</span> Demo required to sign up</li>
                <li className="bad"><span className="cross">✕</span> No named dialer mode published</li>
                <li className="bad"><span className="cross">✕</span> Setup fees not published</li>
                <li className="bad"><span className="cross">✕</span> No mobile app found on their site</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side, checked directly against Hooked CRM's own product pages. Green
            ✓ = confirmed support, red ✕ = not available or not found, amber = present but
            structured as an add-on, or a claim we couldn't independently confirm. Hooked CRM's
            CRM automation and AI notes are real strengths — their outbound dialer specifics
            are the gap.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Hooked CRM</th>
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
          <h2 className="vs-section-h2">Credit where it's due — growing your team doesn't cost you more per seat.</h2>
          <p className="vs-section-lede">
            Unlike ReadyMode or Five9, Hooked CRM's per-seat price goes down as headcount grows,
            not up — $169 at 1–20 seats, down to $129 at 50–99. That's a genuinely fair structure
            for a growing team. What it doesn't include is whitelabel: we found no whitelabel or
            reseller program anywhere on their site. DialerSeat™ Manager+ is a flat $75/month
            add-on with full whitelabel included, on top of a price that never changes with seats
            either way — no bulk discount to chase, but no per-seat penalty to hit.
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
                <li><span className="check">✓</span> No per-seat AI upsell — included at every tier</li>
                <li><span className="check">✓</span> Team performance + campaign oversight</li>
                <li><span className="check">✓</span> No usage-based call/number charges</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">HOOKED CRM</div>
              <div className="price-card-name">Cheaper per seat at scale</div>
              <div>
                <span className="price-card-big">$129+</span>
                <span className="price-card-suffix">/seat/month at 50+ seats</span>
              </div>
              <div className="price-card-monthly">No whitelabel found. Tacklebox AI still $59/seat extra even at scale.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No whitelabel or reseller program found</li>
                <li className="bad"><span className="cross">✕</span> AI coaching/reporting still a per-seat add-on at every tier</li>
                <li className="bad"><span className="cross">✕</span> Usage fees (minutes, numbers, API) apply regardless of tier</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things Hooked CRM doesn't publish.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Named, configurable dialer modes</div>
              <p className="win-card-body">
                Preview, Power, Progressive, Predictive — pick per campaign. Hooked CRM's own
                product pages describe call handling and monitoring but never name a specific
                outbound dialing mode.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Weekly billing</div>
              <p className="win-card-body">
                $35 this week. Cancel before next Monday and you owe nothing more. Hooked CRM
                bills monthly per seat with no weekly option published.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. No usage-based charges</div>
              <p className="win-card-body">
                Flat $35/week covers calling. Hooked CRM adds per-minute call charges, per-number
                fees, API request fees, and recording storage fees on top of the seat price.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. AI features included, not upsold</div>
              <p className="win-card-body">
                No separate AI tier to unlock. Hooked CRM's Tacklebox AI is a $59–$79/seat add-on
                stacked on top of every plan, including their top published tier.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Self-serve signup</div>
              <p className="win-card-body">
                Sign up, enter card, start dialing in under 10 minutes. Hooked CRM's site routes
                every plan through "Book a demo" or "Talk to sales."
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel available</div>
              <p className="win-card-body">
                Manager+ adds full whitelabel for $75/month flat. We found no whitelabel or
                reseller program anywhere on Hooked CRM's site.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Actually see the dialer modes before you buy.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. Preview, Power, Progressive, and Predictive dialing, named and
              included — not a mystery you find out about on a sales call. Self-serve signup means
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