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

// COMPETITOR FACTS — checked against BatchDialer's own published pricing.
// Their page lists TWO rates per tier: month-to-month, and a lower rate for
// annual prepay (their "20% savings"). Both appear here rather than quoting
// only the cheaper one, because the cheap number is the one that costs a
// year of commitment — which is the actual difference this page argues.
// Competitor pricing moves; re-verify before treating these as current.
const features = [
  { feature: 'Per-seat cost', dialerseat: '$35/wk — no prepay', competitor: '$119–$249/mo ($95–$199 annual)' },
  { feature: 'Weekly billing', dialerseat: true, competitor: false },
  { feature: 'Best rate without a year commitment', dialerseat: true, competitor: false },
  { feature: 'Setup fee', dialerseat: '$0', competitor: '$0' },
  { feature: 'Simultaneous lines', dialerseat: 'Paced to real agent availability', competitor: '3 on Starter, 5 on Pro/Enterprise' },
  { feature: 'Dialer modes', dialerseat: '4 (Preview, Power, Progressive, Predictive)', competitor: 'Predictive + Preview' },
  { feature: 'Numbers included', dialerseat: 'Managed pool, no per-number fee', competitor: '10 on Starter, then ~$2 each' },
  { feature: 'Automatic number replacement', dialerseat: 'Every plan', competitor: 'Pro / Enterprise only' },
  { feature: 'Recording retention', dialerseat: 'Per-campaign, opt-in', competitor: '90 / 180 / 365 days by tier' },
  { feature: 'Answering-machine detection', dialerseat: true, competitor: true },
  { feature: 'DNC + litigator scrubbing', dialerseat: 'DNC honored', competitor: true },
  { feature: 'Multiple scripts per campaign', dialerseat: true, competitor: 'One script per campaign' },
  { feature: 'Live mid-call script switching', dialerseat: true, competitor: false },
  { feature: 'Calling window per lead timezone', dialerseat: 'Enforced server-side', competitor: 'Not published' },
  { feature: 'Whitelabel / your own brand', dialerseat: 'Manager+ $75/mo flat', competitor: false },
  { feature: 'Public API + webhooks', dialerseat: true, competitor: 'Zapier, API, PropStream, BatchLeads' },
  { feature: 'Full dialer on phone + tablet', dialerseat: 'PWA install', competitor: 'Desktop-focused' },
  { feature: 'Industry-agnostic', dialerseat: true, competitor: 'Real estate investor ecosystem' },
  { feature: 'Lead data', dialerseat: 'Bring your own, no markup', competitor: '$49–$119/mo add-on packages' },
]

export default function VsBatchDialerView() {
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
          .feature-table th:nth-child(2), .feature-table th:nth-child(3) { text-align: center; width: 22%; }
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
            <div className="vs-eyebrow">DIALERSEAT vs BATCHDIALER</div>
            <h1 className="vs-h1">Their annual rate. Without the annual commitment.</h1>
            <p className="vs-subhead">
              BatchDialer&apos;s advertised $95/seat is the <em>annual prepay</em> rate &mdash; a
              year up front to unlock it. Month to month it is $119 on Starter, $189 on Pro,
              $249 on Enterprise. DialerSeat&trade; is $35 a week, billed weekly, every dialer
              mode included, cancel any Monday.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START 7 DAYS FREE &rarr;</Link>
              <Link href="/vs/everyone" className="vs-btn-ghost">COMPARE EVERYONE</Link>
            </div>
          </div>
        </div>

        <div className="vs-section">
          <div className="vs-section-eyebrow">THE HONEST SUMMARY</div>
          <h2 className="vs-section-h2">BatchDialer is a good product built for a different buyer.</h2>
          <p className="vs-section-lede">
            BatchDialer lives inside the BatchLeads / PropStream ecosystem &mdash; real estate
            investors and wholesalers pulling skip-traced property lists and dialing them. If that
            is your business, their data pipeline is genuinely convenient and this page will not
            talk you out of it.
          </p>
          <p className="vs-section-lede">
            If you run insurance, financial services, solar, mortgage, recruiting, B2B, or an
            agency floor, the calculation changes. You are paying for an ecosystem you will never
            open, and paying a tier premium for capabilities DialerSeat&trade; ships at every
            price point.
          </p>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">PRICING</div>
          <h2 className="vs-section-h2">The advertised price and the payable price are different numbers.</h2>
          <p className="vs-section-lede">
            BatchDialer publishes $95, $151 and $199 per agent per month. Those are annual rates
            &mdash; their own page reaches $95 by pricing Starter at roughly $1,142 per agent per
            year. Pay month to month and the same tiers are $119, $189 and $249. DialerSeat&trade;
            is $35/week with nothing above it, billed weekly &mdash; so there is no headline
            rate to unlock and no year to commit to in order to reach it.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT</div>
              <div className="price-card-name">One tier, billed weekly</div>
              <div>
                <span className="price-card-big">$35</span>
                <span className="price-card-suffix">/seat/week</span>
              </div>
              <div className="price-card-monthly">Billed weekly &mdash; nothing prepaid, cancel any week</div>
              <ul className="price-card-list">
                <li><span className="check">&#10003;</span> All four dialer modes at one price</li>
                <li><span className="check">&#10003;</span> Managed number pool, no per-number fees</li>
                <li><span className="check">&#10003;</span> Number cycling on every plan, not a tier upgrade</li>
                <li><span className="check">&#10003;</span> Multiple scripts per campaign, switchable mid-call</li>
                <li><span className="check">&#10003;</span> Full dialer on phone and tablet</li>
                <li><span className="check">&#10003;</span> Industry-agnostic &mdash; bring any list</li>
                <li><span className="check">&#10003;</span> Whitelabel available at $75/mo flat</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">BATCHDIALER</div>
              <div className="price-card-name">Three tiers, priced per agent</div>
              <div>
                <span className="price-card-big">$119</span>
                <span className="price-card-suffix">/agent/month</span>
              </div>
              <div className="price-card-monthly">Starter, month to month. $95 only on annual prepay. Pro $189, Enterprise $249.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">&#10007;</span> Lowest rate requires a year up front</li>
                <li className="bad"><span className="cross">&#10007;</span> Starter capped at 3 simultaneous lines</li>
                <li className="bad"><span className="cross">&#10007;</span> Automatic number replacement is Pro/Enterprise only</li>
                <li className="bad"><span className="cross">&#10007;</span> Numbers past your allotment billed per number</li>
                <li className="bad"><span className="cross">&#10007;</span> Recording retention gated by tier</li>
                <li className="bad"><span className="cross">&#10007;</span> Lead packages $49&ndash;$119/mo on top</li>
                <li className="bad"><span className="cross">&#10007;</span> No whitelabel at any tier</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">THE TIER TRAP</div>
          <h2 className="vs-section-h2">The feature that decides your answer rate is two tiers up.</h2>
          <p className="vs-section-lede">
            Deliverability is the whole game in outbound. Numbers get flagged, answer rates fall,
            and the only real fix is rotating numbers out before carriers mark them. BatchDialer
            calls this Automatic Phone Number Replacement &mdash; and Starter does not include it.
            Starter gives you reputation <em>monitoring</em>: it tells you a number is burned, and
            you replace it yourself, paying per number. Automating that means Pro, at $189 per
            agent month to month.
          </p>
          <p className="vs-section-lede">
            DialerSeat&trade; cycles numbers automatically on every account at every price,
            because a dialer that burns numbers and does nothing about it is not finished. The pool
            also scales itself as seats are added, rather than leaving you to notice and buy.
          </p>
          <p className="vs-section-lede">
            Simultaneous lines work the same way: 3 on Starter, 5 on Pro. DialerSeat&trade; paces
            predictive against real agent availability instead of selling line count as an upgrade
            &mdash; the constraint that matters is how many live conversations your floor can
            actually absorb, not a number on an invoice.
          </p>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">FEATURE-BY-FEATURE</div>
          <h2 className="vs-section-h2">Where each tool wins.</h2>
          <p className="vs-section-lede">
            BatchDialer&apos;s property-data pipeline is deliberately absent from this table. Its
            absence from DialerSeat&trade; is not a weakness &mdash; it is a different product
            category. If you want skip-traced property lists flowing straight into a dialer,
            BatchDialer wins and it is not close. Everything below is the dialer itself.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>DialerSeat</th>
                  <th>BatchDialer</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={i}>
                    <td>{f.feature}</td>
                    <td className="ds-cell">
                      {f.dialerseat === true ? <span className="yes">&#10003;</span>
                        : f.dialerseat === false ? <span className="no">&#10007;</span>
                        : <span style={{ color: T.text, fontSize: 12 }}>{f.dialerseat}</span>}
                    </td>
                    <td>
                      {f.competitor === true ? <span className="yes">&#10003;</span>
                        : f.competitor === false ? <span className="no">&#10007;</span>
                        : <span className="partial">{f.competitor}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">SCALING A FLOOR</div>
          <h2 className="vs-section-h2">Five seats. Run the numbers.</h2>
          <p className="vs-section-lede">
            BatchDialer prices strictly per agent with no volume break published. Five agents on
            Pro month to month is $945 every month, and the seat count is fixed for the billing
            cycle. Five DialerSeat&trade; seats are $175 a week, plus Manager+ at $75/month flat
            for whitelabel, team oversight and a manager seat that can dial &mdash; and if a rep
            leaves on Tuesday you stop paying for that seat on Monday, not next quarter.
          </p>

          <div className="price-grid">
            <div className="price-card winner">
              <div className="price-card-label">DIALERSEAT &mdash; 5 SEATS</div>
              <div className="price-card-name">Weekly, with Manager+ whitelabel</div>
              <div>
                <span className="price-card-big">$175</span>
                <span className="price-card-suffix">/week, 5 seats</span>
              </div>
              <div className="price-card-monthly">Plus Manager+ at $75/month flat &mdash; nothing prepaid, drop a seat any week</div>
              <ul className="price-card-list">
                <li><span className="check">&#10003;</span> Your brand, your subdomain</li>
                <li><span className="check">&#10003;</span> Manager seat included and able to dial</li>
                <li><span className="check">&#10003;</span> Flat $75 whether it is 2 seats or 20</li>
                <li><span className="check">&#10003;</span> Team performance and campaign oversight</li>
                <li><span className="check">&#10003;</span> Drop a seat any week you need to</li>
              </ul>
            </div>

            <div className="price-card">
              <div className="price-card-label">BATCHDIALER &mdash; 5 SEATS</div>
              <div className="price-card-name">Pro, month to month</div>
              <div>
                <span className="price-card-big">$945</span>
                <span className="price-card-suffix">/month</span>
              </div>
              <div className="price-card-monthly">5 &times; $189. Annual prepay drops it to ~$755 &mdash; for a full year.</div>
              <ul className="price-card-list">
                <li className="bad"><span className="cross">&#10007;</span> No whitelabel to buy at any price</li>
                <li className="bad"><span className="cross">&#10007;</span> No published volume discount</li>
                <li className="bad"><span className="cross">&#10007;</span> The cheaper rate commits all five seats for a year</li>
                <li className="bad"><span className="cross">&#10007;</span> Lead packages billed separately on top</li>
                <li className="bad"><span className="cross">&#10007;</span> Seat changes wait for the billing cycle</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHERE DIALERSEAT WINS</div>
          <h2 className="vs-section-h2">Six reasons teams switch.</h2>

          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">1. No annual prepay to reach the real price</div>
              <p className="win-card-body">
                BatchDialer&apos;s headline figures are annual rates. DialerSeat&trade; has one
                price, billed weekly. Cancel before next Monday and you owe nothing further &mdash;
                no unused months already charged to a card.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">2. Number cycling on every plan</div>
              <p className="win-card-body">
                Automatic replacement is the difference between a pool that keeps getting answered
                and one that quietly dies. BatchDialer gates it behind Pro. DialerSeat&trade;
                cycles on every account and grows the pool as seats are added.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">3. No per-number metering</div>
              <p className="win-card-body">
                Starter includes ten numbers, then charges per number after. A team working several
                area codes goes through that quickly. DialerSeat&trade; treats the pool as part of
                the seat.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">4. Multiple scripts, switchable mid-call</div>
              <p className="win-card-body">
                Health, life, veterans, IUL &mdash; each on its own tab, switchable while the
                prospect is still talking. BatchDialer treats a script as one per-campaign asset.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">5. Calling windows per lead, not per account</div>
              <p className="win-card-body">
                DialerSeat&trade; checks the window in <em>the lead&apos;s</em> timezone, derived
                from their state or area code, and refuses the call server-side if it falls outside.
                An agent in California cannot accidentally dial a Maine lead at 9pm Eastern.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">6. Whitelabel that exists</div>
              <p className="win-card-body">
                Manager+ is $75/month flat &mdash; your brand, your subdomain, any team size.
                BatchDialer has no whitelabel tier, so an agency reselling seats is always
                reselling someone else&apos;s product.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-section" style={{ paddingTop: 0 }}>
          <div className="vs-section-eyebrow">WHEN BATCHDIALER IS THE RIGHT CALL</div>
          <h2 className="vs-section-h2">Two cases where we would tell you to pick them.</h2>
          <div className="win-grid">
            <div className="win-card">
              <div className="win-card-title">You live in BatchLeads or PropStream</div>
              <p className="win-card-body">
                If your day starts by pulling a skip-traced property list and ends by dialing it,
                having both inside one vendor is worth real money. DialerSeat&trade; expects you to
                bring your own list.
              </p>
            </div>
            <div className="win-card">
              <div className="win-card-title">You want litigator scrubbing bundled</div>
              <p className="win-card-body">
                BatchDialer includes DNC and litigator scrubbing on every tier. DialerSeat&trade;
                honors DNC and enforces calling windows per lead, but if you want litigator
                screening bundled into the dialer itself, that is a genuine point in their favor.
              </p>
            </div>
          </div>
        </div>

        <div className="vs-final-cta">
          <div className="vs-final-cta-inner">
            <h2 className="vs-final-cta-h2">Try it for one week. Literally one week.</h2>
            <p className="vs-final-cta-p">
              You cannot evaluate BatchDialer&apos;s real pricing without making a decision about a
              year. DialerSeat&trade; is $35, billed weekly, every dialer mode included, whitelabel
              available, and you can walk away next Monday. If you are not dialing skip-traced
              property lists, there is very little reason to pay a tier premium for the ecosystem
              built around them.
            </p>
            <div className="vs-cta-row">
              <Link href="/sign-up" className="vs-btn-primary">START 7 DAYS FREE &rarr;</Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  )
}
