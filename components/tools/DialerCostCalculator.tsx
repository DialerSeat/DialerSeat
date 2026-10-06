'use client'

import { useMemo, useState } from 'react'
import {
  BILLED_DIALERS,
  DIALERSEAT_WEEKLY,
  billedCost,
  dialerSeatCost,
  monthsToCover,
} from '@/lib/weeklyBilling'
import { t } from '@/lib/i18n/client'
import { useWebMcpTool } from '@/lib/useWebMcpTool'
import { DIALER_COST_TOOL } from '@/lib/webmcpTools'

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

// One calculation for the page and for the WebMCP tool below.
function compare(weeks: number, seats: number) {
  const ours = dialerSeatCost(weeks, seats)
  const others = BILLED_DIALERS.map((d) => ({ d, cost: billedCost(d, weeks, seats) })).sort((a, b) => {
    if (a.cost === null) return 1
    if (b.cost === null) return -1
    return a.cost - b.cost
  })
  return { ours, others }
}

const clamp = (v: unknown, max: number) => Math.min(max, Math.max(1, Math.floor(Number(v) || 1)))

export default function DialerCostCalculator() {
  const [weeks, setWeeks] = useState(1)
  const [seats, setSeats] = useState(1)

  const rows = useMemo(() => compare(weeks, seats), [weeks, seats])

  const months = monthsToCover(weeks)

  // An AI agent in the browser can run the same comparison (lib/useWebMcpTool).
  useWebMcpTool({
    ...DIALER_COST_TOOL,
    execute: (input) => {
      const w = clamp(input.weeks, 104), s = clamp(input.seats, 500)
      setWeeks(w); setSeats(s)
      const res = compare(w, s)
      return {
        weeks: w,
        seats: s,
        dialerSeat: { totalUsd: res.ours, basis: `${s} × ${w} × $${DIALERSEAT_WEEKLY} per seat per week, billed weekly, no contract, no seat minimum` },
        monthsBilledOnAMonthlyPlan: monthsToCover(w),
        others: res.others.map(({ d, cost }) => ({ name: d.name, totalUsd: cost, atLeast: d.from, basis: d.basis })),
        source: 'https://dialerseat.com/tools/dialer-cost-calculator',
      }
    },
  })

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
          <label htmlFor="dcc-weeks">{t("WEEKS OF DIALING")}</label>
          <div className="row">
            <input id="dcc-weeks-range" aria-label={t("Weeks of dialing")} type="range" min={1} max={52} value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))} />
            <input id="dcc-weeks" type="number" min={1} max={104} value={weeks}
              onChange={(e) => setWeeks(Math.min(104, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <div className="dcc-field">
          <label htmlFor="dcc-seats">{t("AGENTS (SEATS)")}</label>
          <div className="row">
            <input id="dcc-seats-range" aria-label={t("Agents")} type="range" min={1} max={50} value={seats}
              onChange={(e) => setSeats(Number(e.target.value))} />
            <input id="dcc-seats" type="number" min={1} max={500} value={seats}
              onChange={(e) => setSeats(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
      </div>

      <div className="dcc-ours" aria-live="polite">
        <span>
          {t("DialerSeat, billed weekly: {seats} seat{value} × {weeks} week{value2} × ${dIALERSEAT_WEEKLY}", { seats, value: seats > 1 ? 's' : '', weeks, value2: weeks > 1 ? 's' : '', dIALERSEAT_WEEKLY: DIALERSEAT_WEEKLY })}
        </span>
        <b>{money(rows.ours)}</b>
      </div>

      <table>
        <thead>
          <tr>
            <th scope="col">{t("BILLED BY THE MONTH OR YEAR")}</th>
            <th scope="col" style={{ textAlign: 'end' }}>{t("COST")}</th>
            <th scope="col" style={{ textAlign: 'end' }}>{t("VS DIALERSEAT")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.others.map(({ d, cost }) => (
            <tr key={d.slug}>
              <td>
                {d.name}
                <small>{t(d.basis)}</small>
              </td>
              <td className="num">{cost === null ? t("Quote") : d.from ? t("from {price}", { price: money(cost) }) : money(cost)}</td>
              <td className={`more${cost !== null && cost < rows.ours ? ' less' : ''}`}>
                {cost === null ? '—' : cost > rows.ours ? `+${money(cost - rows.ours)}` : `−${money(rows.ours - cost)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="dcc-foot">
        {t("{weeks} week{value} on a monthly plan bills {months} month{value2}; annual plans bill at least 12 months; seat minimums are applied. Competitor figures are the lowest published price that includes multi-line or predictive dialing, before add-ons, setup fees and usage. Figures as published September 2026.", { weeks, value: weeks > 1 ? 's' : '', months, value2: months > 1 ? 's' : '' })}</p>
    </div>
  )
}
