'use client'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import BackToVsButton from '@/components/back-to-vs-button'


const T = {
  bg: '#0a0a14',
  surface: '#1a1a2e',
  surface2: '#2a2a4a',
  border: '#2a2a4a',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#ffffff',
  muted: '#8888aa',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
}

const features = [
  { feature: 'Public per-seat pricing', dialerseat: true, competitor: 'Request-a-quote only' },
  { feature: 'Self-serve signup, no demo required', dialerseat: true, competitor: false },
  { feature: 'Weekly billing option', dialerseat: true, competitor: false },
  { feature: 'Annual contract required', dialerseat: false, competitor: true },
  { feature: 'Per-seat cost', dialerseat: '$35/wk, cancel anytime', competitor: '~$250–$800/mo, billed annually' },
  { feature: 'Seat minimum', dialerseat: '1', competitor: '3 (~$9,000/yr floor)' },
  { feature: 'Dialer modes included in base price', dialerseat: true, competitor: 'Power dialer only; parallel tier costs more' },
  { feature: 'Multi-line / parallel dialing', dialerseat: 'Triple-line + true Predictive mode', competitor: '5–10 lines (AI parallel dialing)' },
  { feature: 'Connection lag on answer', dialerseat: 'Not applicable at triple-line', competitor: 'Widely reported 1–2 sec lag on parallel tier' },
  { feature: 'AMD / voicemail filtering', dialerseat: true, competitor: true },
  { feature: 'AI call coaching / review', dialerseat: 'Not specified', competitor: '$50–200/mo add-on' },
  { feature: 'Implementation / onboarding fee', dialerseat: '$0', competitor: 'Reported $1,000–$5,000+' },
  { feature: 'TCPA windows enforced server-side', dialerseat: true, competitor: 'Not specified' },
  { feature: 'STIR/SHAKEN A-attestation + carrier registration', dialerseat: true, competitor: 'Not specified' },
  { feature: 'Industry-agnostic', dialerseat: true, competitor: 'B2B SDR / sales-team focus' },
  { feature: 'Public API + webhooks (any CRM)', dialerseat: true, competitor: 'Native Salesforce/HubSpot/Outreach sync' },
  { feature: 'Works on phones + tablets (PWA install)', dialerseat: true, competitor: 'Not specified' },
  { feature: 'First dial after signup', dialerseat: 'Under 10 minutes', competitor: 'Demo + sales process first' },
]

export default function VsOrumView() {
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
            background: ${T.surface};
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
          .price-card { padding: 32px; border-radius: 12px; background: ${T.surface}; border: 1px solid ${T.border}; position: relative; }
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
            background: ${T.surface};
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
          .feature-table th:nth-child(2), .feature-table th:nth-child(3) { text-align: center; width: 20%; }
          .feature-table td { padding: 14px 20px; border-top: 1px solid ${T.border}; font-size: 14px; }
          .feature-table td:nth-child(2), .feature-table td:nth-child(3) { text-align: center; font-weight: bold; }
          .feature-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
          .feature-table .yes { color: ${T.green}; font-size: 18px; }
          .feature-table .no { color: ${T.red}; font-size: 18px; }
          .feature-table .partial { color: ${T.amber}; font-style: italic; font-size: 12px; }
          .feature-table .ds-cell { background: rgba(74,158,255,0.04) !important; }
          .win-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 24px; }
          .win-card {
            padding: 28px;
            background: ${T.surface};
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


          /* ── DARK THEME OVERRIDES (vs/everyone style) ── */
          .verdict-card {
            background: ${T.surface} !important;
            border: 1px solid ${T.border} !important;
            border-radius: 4px !important;
            border-left: none !important;
            border-top: 3px solid ${T.blue} !important;
            box-shadow: none !important;
          }
          .verdict-title { color: ${T.blue} !important; }
          .verdict-text { color: ${T.muted} !important; }
          .price-card { background: ${T.surface} !important; border: 1px solid ${T.border} !important; border-radius: 4px !important; }
          .price-card.winner { border: 1px solid ${T.blue} !important; box-shadow: none !important; }
          .price-card-name { color: ${T.text} !important; }
          .price-card-big { color: ${T.text} !important; }
          .price-card-list { border-top-color: ${T.border} !important; }
          .price-card-list li { color: ${T.text} !important; }
          .price-card-list li.bad { color: ${T.muted} !important; }
          .feature-table { background: ${T.surface} !important; border-color: ${T.border} !important; border-radius: 4px !important; }
          .feature-table tr:nth-child(even) td { background: rgba(255,255,255,0.02) !important; }
          .win-card { background: ${T.surface} !important; border: 1px solid ${T.border} !important; border-radius: 4px !important; border-left: 3px solid ${T.green} !important; }
          .win-card-title { color: ${T.text} !important; }
          .win-card-body { color: ${T.muted} !important; }
          .check { color: ${T.green} !important; }
          .cross { color: ${T.red} !important; }
          .feature-table .yes { color: ${T.green} !important; }
          .feature-table .no { color: ${T.red} !important; }
          .feature-table .partial { color: ${T.amber} !important; }
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
            <div className="vs-eyebrow">DIALERSEAT VS ORUM</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Last Updated 07/28/2026</div>
            <h1 className="vs-h1">
              Orum won&apos;t tell you the price.<br />
              <span className="versus">We put ours on the homepage.</span>
            </h1>
            <p className="vs-subhead">
              Orum doesn&apos;t publish pricing — you sit through a demo and get a quote.
              Third-party pricing research consistently lands on{' '}
              <strong>around $250/user/month, billed annually, with a 3-seat minimum</strong>{' '}
              (roughly $9,000/year to start). DialerSeat™ is{' '}
              <strong>$35 per seat per week</strong>, published, self-serve, one seat minimum: one.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START DIALING →</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE QUICK VERDICT</div>
          <h2 className="vs-section-h2">A genuinely strong parallel dialer. Priced and gated like enterprise software.</h2>
          <p className="vs-section-lede">
            Credit where due: Orum&apos;s AI-driven parallel dialing — up to 5&ndash;10 lines at
            once — is a real, effective way to increase raw call volume for teams that can afford
            it. But it comes at a reported $250 to $800 per user per month, annual billing only,
            a 3-seat minimum, and pricing you can only get by requesting a demo. Reviewers also
            consistently flag a 1&ndash;2 second connection lag when a parallel-dialed call
            bridges to a rep, and numbers getting flagged &ldquo;Spam Likely&rdquo; over time.
            DialerSeat™ is self-serve, published pricing, one seat minimum, and every dialer mode
            included from day one.
          </p>

          <div className="verdict-card">
            <div className="verdict-title">▸ BOTTOM LINE</div>
            <p className="verdict-text">
              <strong>Switch to DialerSeat™</strong> if you want transparent, self-serve pricing
              without a 3-seat floor, an annual contract, or a sales call just to see what it
              costs. <strong>Stay on Orum</strong> if you&apos;re a well-funded SDR org running
              10+ reps at 200+ dials a day who specifically need Orum&apos;s raw parallel-line
              volume and can absorb the price, the annual lock-in, and the connection-lag tradeoff
              that comes with it.
            </p>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">$35 a week, published, versus a quote you have to ask for.</h2>
          <p className="vs-section-lede">
            Orum doesn&apos;t list prices on its site. Multiple independent pricing breakdowns
            (CloudTalk, Klenty, Prospeo, MarketBetter) converge on the same figures: a Launch
            plan starting around $250/user/month, an Ascend tier reported at $500&ndash;$800/user/month,
            annual billing only, and a 3-seat minimum — about $9,000/year just to get in the
            door. AI Coaching is a separate add-on reported at $50&ndash;200/user/month, and
            onboarding/implementation fees are reported in the $1,000&ndash;$5,000+ range. One
            source estimated first-year total cost for an Ascend-tier team at $80,000&ndash;$150,000.
            DialerSeat™ is $35/week, flat, published on our homepage, no quote required.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">Flat weekly billing</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Cancel anytime — no annual lock-in</div>
              <ul className="price-card-list">
                <li><span className="check">✓</span> Published pricing, right on the homepage</li>
                <li><span className="check">✓</span> $0 setup / onboarding fee</li>
                <li><span className="check">✓</span> One seat minimum: one</li>
                <li><span className="check">✓</span> Every dialer mode included, no add-on tier</li>
                <li><span className="check">✓</span> Self-serve signup, no demo required</li>
                <li><span className="check">✓</span> Weekly billing, cancel any time</li>
                <li><span className="check">✓</span> Public API + webhooks (any CRM)</li>
                <li><span className="check">✓</span> First dial in under 10 minutes</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">ORUM</div>
              <div className="price-card-name">Enterprise pricing, request only</div>
              <div>
                <span className="price-card-big">~$250+</span>
                <span className="price-card-suffix">/user/month, billed annually</span>
              </div>
              <div className="price-card-monthly">Reported by third-party research — Orum does not publish pricing</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">✕</span> No public pricing — demo required for a quote</li>
                <li className="bad"><span className="cross">✕</span> Annual billing only, no monthly option</li>
                <li className="bad"><span className="cross">✕</span> 3-seat minimum, ~$9,000/year floor</li>
                <li className="bad"><span className="cross">✕</span> AI Coaching reported as a $50–200/mo add-on</li>
                <li className="bad"><span className="cross">✕</span> Onboarding fees reported at $1,000–$5,000+</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            Honest side-by-side. Orum&apos;s raw parallel-dialing line count is a genuine
            strength for pure volume. Green ✓ = confirmed support, red ✕ = not available, amber =
            tier-gated, structurally different, or a claim we couldn&apos;t independently confirm
            from Orum&apos;s own site.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>Orum</th>
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
          <div className="vs-section-eyebrow">THE PARALLEL-DIALING TRADEOFF</div>
          <h2 className="vs-section-h2">More lines isn&apos;t free — Orum&apos;s own reviewers say so.</h2>
          <p className="vs-section-lede">
            Orum carries a strong 4.6/5 on G2 across 781 reviews, and reps genuinely like the time
            savings. But the same review base surfaces a consistent set of complaints worth
            knowing before you sign an annual contract around it.
          </p>

          <div className="win-grid">
            <div className="win-card" style={{ borderLeftColor: T.amber }}>
              <div className="win-card-title">The connection lag</div>
              <p className="win-card-body">
                When parallel dialing bridges a live answer to a rep, reviewers and Reddit
                threads consistently describe a 1&ndash;2 second silence before the rep comes on
                the line — long enough that prospects report it feels like a robocall and hang up
                before the conversation starts.
              </p>
            </div>
            <div className="win-card" style={{ borderLeftColor: T.amber }}>
              <div className="win-card-title">Spam-flagged numbers</div>
              <p className="win-card-body">
                G2 reviewers report assigned numbers periodically getting marked &ldquo;Spam
                Likely,&rdquo; with no straightforward self-service fix, and some teams describe
                connect rates declining over the course of an annual contract.
              </p>
            </div>
            <div className="win-card" style={{ borderLeftColor: T.amber }}>
              <div className="win-card-title">No time to personalize</div>
              <p className="win-card-body">
                Because the next call connects the moment a rep finishes the last one, reps report
                little to no time to glance at a prospect&apos;s background or tailor an opening
                line — more dials, but reportedly less personalized conversations.
              </p>
            </div>
            <div className="win-card" style={{ borderLeftColor: T.amber }}>
              <div className="win-card-title">Dialer-only, single channel</div>
              <p className="win-card-body">
                Orum is a specialized point solution focused entirely on dialing mechanics — no
                built-in email sequencing or other outbound channels, so it typically sits
                alongside several other tools rather than replacing them.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six things you don&apos;t need a sales call to get.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. Published pricing</div>
              <p className="win-card-body">
                $35/seat/week, right on the homepage. No demo, no &ldquo;request pricing&rdquo;
                form, no waiting for a quote before you know what you&apos;d actually pay.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. No annual contract</div>
              <p className="win-card-body">
                Weekly billing, cancel before next Monday and owe nothing further. Orum&apos;s
                plans are reported as annual-only, no monthly option.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. One seat minimum</div>
              <p className="win-card-body">
                Start solo. Orum is reported to carry a 3-seat minimum — around $9,000/year
                before you dial a single number.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Nothing gated behind add-ons</div>
              <p className="win-card-body">
                Every dialer mode is included from your first seat. Orum&apos;s AI Coaching is
                reported as a separate $50&ndash;200/user/month add-on on top of the base seat price.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Industry-agnostic</div>
              <p className="win-card-body">
                Insurance, real estate, financial services, B2B SaaS, fundraising, mortgage,
                solar, recruiting — same flat price. Orum is built and priced around B2B SDR teams.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Self-serve from minute one</div>
              <p className="win-card-body">
                Sign up and place your first dial in under 10 minutes. Orum requires a sales demo
                first — reportedly even its limited 500-dial trial needs sales to activate.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">See the price before you sign up. Because it's already on the page.</h2>
            <p className="vs-final-cta-p">
              $35 a week per seat. No demo, no quote, no annual contract. Self-serve signup means
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
