'use client'

import { useMemo, useState } from 'react'
import {
  BILLED_DIALERS,
  DIALERSEAT_WEEKLY,
  billedCost,
  dialerSeatCost,
  monthsToCover,
} from '@/lib/weeklyBilling'

// =============================================================================
// DIALER COST CALCULATOR — weeks of use and seats in, what each tool bills out
// =============================================================================
// Self-contained on purpose: the same component renders on /tools/... inside
// the site shell and on /embed/... inside somebody else's page, so it carries
// its own styles and assumes nothing about what surrounds it.
//
// The figures come from lib/weeklyBilling, which states where each one is
// already published. A tool sold only by quote shows "Quote" rather than an
// estimate, for the same reason the comparison pages do.
// =============================================================================

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export default function DialerCostCalculator() {
  const [weeks, setWeeks] = useState(1)
  const [seats, setSeats] = useState(1)

  const rows = useMemo(() => {
    const ours = dialerSeatCost(weeks, seats)
    const others = BILLED_DIALERS.map((d) => ({ d, cost: billedCost(d, weeks, seats) })).sort((a, b) => {
      if (a.cost === null) return 1
      if (b.cost === null) return -1
      return a.cost - b.cost
    })
    return { ours, others }
  }, [weeks, seats])

  const months = monthsToCover(weeks)

  return (
    <div className="dcc">
      <style>{`
        .dcc { font-family: inherit; color: #1a1c24; text-align: start; }
        .dcc-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .dcc-field { background: #f5f7fb; border: 1px solid #d6dbe3; border-radius: 10px; padding: 14px 16px; }
        .dcc-field label { display: block; font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #5a6072; margin-bottom: 8px; }
        .dcc-field .row { display: flex; align-items: center; gap: 12px; }
        .dcc-field input[type=range] { flex: 1; accent-color: #2a6eff; }
        .dcc-field input[type=number] {
          width: 72px; font: inherit; font-size: 16px; font-weight: 700; padding: 6px 8px;
          border: 1px solid #c4c8d0; border-radius: 6px; text-align: center; color: #1a1c24; background: #fff;
        }
        .dcc-ours {
          margin-top: 16px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;
          background: rgba(42,110,255,0.07); border: 1px solid rgba(42,110,255,0.3); border-radius: 10px; padding: 16px 18px;
        }
        .dcc-ours b { font-size: 26px; color: #2a6eff; }
        .dcc-ours span { font-size: 13px; color: #5a6072; }
        .dcc table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
        .dcc th { text-align: start; font-size: 10px; letter-spacing: 2px; color: #5a6072; padding: 8px 10px; border-bottom: 1px solid #d6dbe3; }
        .dcc td { padding: 10px; border-bottom: 1px solid #e8ebf0; vertical-align: top; }
        .dcc td.num { text-align: end; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .dcc td.more { text-align: end; color: #b42318; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .dcc td.more.less { color: #6b7182; }
        .dcc td small { display: block; color: #6b7182; font-size: 11.5px; margin-top: 2px; line-height: 1.45; }
        .dcc .dcc-foot { margin-top: 12px; font-size: 11.5px; color: #6b7182; line-height: 1.6; }
        @media (max-width: 560px) { .dcc-inputs { grid-template-columns: 1fr; } .dcc td small { display: none; } }
      `}</style>

      <div className="dcc-inputs">
        <div className="dcc-field">
          <label htmlFor="dcc-weeks">WEEKS OF DIALING</label>
          <div className="row">
            <input id="dcc-weeks-range" aria-label="Weeks of dialing" type="range" min={1} max={52} value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))} />
            <input id="dcc-weeks" type="number" min={1} max={104} value={weeks}
              onChange={(e) => setWeeks(Math.min(104, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <div className="dcc-field">
          <label htmlFor="dcc-seats">AGENTS (SEATS)</label>
          <div className="row">
            <input id="dcc-seats-range" aria-label="Agents" type="range" min={1} max={50} value={seats}
              onChange={(e) => setSeats(Number(e.target.value))} />
            <input id="dcc-seats" type="number" min={1} max={500} value={seats}
              onChange={(e) => setSeats(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
      </div>

      <div className="dcc-ours" aria-live="polite">
        <span>
          DialerSeat, billed weekly: {seats} seat{seats > 1 ? 's' : ''} × {weeks} week{weeks > 1 ? 's' : ''} × ${DIALERSEAT_WEEKLY}
        </span>
        <b>{money(rows.ours)}</b>
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">BILLED BY THE MONTH OR YEAR</th>
            <th scope="col" style={{ textAlign: 'end' }}>COST</th>
            <th scope="col" style={{ textAlign: 'end' }}>VS DIALERSEAT</th>
          </tr>
        </thead>
        <tbody>
          {rows.others.map(({ d, cost }) => (
            <tr key={d.slug}>
              <td>
                {d.name}
                <small>{d.basis}</small>
              </td>
              <td className="num">{cost === null ? 'Quote' : `${d.from ? 'from ' : ''}${money(cost)}`}</td>
              <td className={`more${cost !== null && cost < rows.ours ? ' less' : ''}`}>
                {cost === null ? '—' : cost > rows.ours ? `+${money(cost - rows.ours)}` : `−${money(rows.ours - cost)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="dcc-foot">
        {weeks} week{weeks > 1 ? 's' : ''} on a monthly plan bills {months} month{months > 1 ? 's' : ''}; annual plans bill
        at least 12 months; seat minimums are applied. Competitor figures are the lowest published price that includes
        multi-line or predictive dialing, before add-ons, setup fees and usage. Figures as published September 2026.
      </p>
    </div>
  )
}
