'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// UNIT ECONOMICS — cost per customer against what they pay
// =============================================================================
// The margin was known on paper. This makes it observable, and the reason is
// specific: the dominant cost is answering-machine detection, billed per LEG
// whether or not anyone picks up. A customer who dials hard and connects
// rarely can cost more than their seat while looking like a model user on
// every other screen in this desktop.
//
// Sorted worst-margin first on purpose. The interesting row is never the top
// of an alphabetical list.
//
// Nothing is estimated. Where a figure cannot be computed it shows a dash.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

interface Row {
  clerkId: string
  email: string
  name: string | null
  internal: boolean
  paying: boolean
  plan: string | null
  subStatus: string | null
  calls: number
  talkMinutes: number
  amdLegs: number
  costUsd: number
  costBreakdown: { minutes: number; amd: number; recording: number } | null
  revenueUsd: number
  marginUsd: number
  marginPct: number | null
}

interface Payload {
  windowDays: number
  generatedAt: string
  rates: {
    perMinuteUsd: number
    perAmdLegUsd: number
    seatWeeklyUsd: number
    managerPlusWeeklyUsd: number
    note: string
  }
  totals: {
    costUsd: number
    revenueUsd: number
    calls: number
    amdLegs: number
    talkMinutes: number
    marginUsd: number
    marginPct: number | null
  }
  /** What is left at Telnyx, and how long it lasts at this window's burn. */
  carrier: {
    availableCredit: number | null
    balance: number | null
    pending: number | null
    currency: string | null
    authoritative: boolean
    error: string | null
    dailyBurnUsd: number
    runwayDays: number | null
  }
  /** Costs no single customer's row carries. See the route for why. */
  platform: {
    numbers: number
    numbersMonthlyUsd: number
    numberRentalUsd: number
    costUsd: number
    marginUsd: number
    marginPct: number | null
  }
  rows: Row[]
}

const usd = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A dash, never a plausible-looking number. */
const pct = (v: number | null) => (v === null || Number.isNaN(v) ? '-' : `${v.toFixed(0)}%`)

export default function UnitEconomics() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [showInternal, setShowInternal] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/unit-economics?days=${days}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json?.success) {
        setError(typeof json?.error === 'string' ? json.error : 'Could not load')
        return
      }
      setError(null)
      setData(json as Payload)
    } catch {
      setError('Could not reach the server')
    }
  }, [days])

  useEffect(() => {
    // Scheduled, not called inline — see the note in LiveOps: the rule cannot
    // tell that load() awaits a fetch before setting state.
    const first = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(first)
  }, [load])

  const rows = (data?.rows || []).filter(r => showInternal || !r.internal)

  return (
    <div style={{
      padding: 16, fontFamily: FUTURA, color: T.text, background: T.bg,
      height: '100%', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }}>UNIT ECONOMICS</div>
        <div style={{ flex: 1 }} />
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              fontSize: 10, letterSpacing: 1.2, fontWeight: 'bold', padding: '6px 11px',
              background: days === d ? T.accent : '#fff',
              color: days === d ? '#fff' : T.muted,
              border: `1px solid ${days === d ? T.accent : T.border}`,
              borderRadius: 3, cursor: 'pointer', fontFamily: FUTURA,
            }}
          >{d}D</button>
        ))}
        <button
          onClick={() => setShowInternal(v => !v)}
          style={{
            fontSize: 10, letterSpacing: 1.2, fontWeight: 'bold', padding: '6px 11px',
            background: showInternal ? T.amber : '#fff',
            color: showInternal ? '#fff' : T.muted,
            border: `1px solid ${showInternal ? T.amber : T.border}`,
            borderRadius: 3, cursor: 'pointer', fontFamily: FUTURA,
          }}
        >{showInternal ? 'INTERNAL SHOWN' : 'HIDE INTERNAL'}</button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#f8e8e8', border: `1px solid ${T.red}`,
          color: T.red, borderRadius: 4, fontSize: 12, marginBottom: 14,
        }}>{error}</div>
      )}

      {data && (
        <>
          {/* ── TOTALS ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10, marginBottom: 16,
          }}>
            {[
              ['REVENUE', usd(data.totals.revenueUsd), T.text],
              ['CARRIER COST', usd(data.totals.costUsd), T.text],
              // Rental bills whether anybody dials or not, so it is shown in
              // its own right rather than folded into the carrier line.
              ['NUMBER RENTAL', usd(data.platform.numberRentalUsd), T.text],
              // The margin that counts is after rental. Showing the carrier
              // margin here would flatter the business by exactly the amount
              // of a bill that arrives every month regardless.
              ['MARGIN', usd(data.platform.marginUsd), data.platform.marginUsd >= 0 ? T.green : T.red],
              ['MARGIN %', pct(data.platform.marginPct), data.platform.marginUsd >= 0 ? T.green : T.red],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{
                background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, padding: 14,
              }}>
                <div style={{ fontSize: 9.5, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
                  {label as string}
                </div>
                <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 6, color: color as string }}>
                  {value as string}
                </div>
              </div>
            ))}
          </div>

          {/* ── CARRIER BALANCE AND RUNWAY ──────────────────────────────
              Above the per-customer table on purpose. Margin per customer is
              a question you think about; running out of carrier balance is one
              that stops the floor, so it reads first. */}
          <div style={{
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4,
            padding: 14, marginBottom: 12,
            display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'baseline',
          }}>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
                TELNYX BALANCE
              </div>
              <div style={{
                fontSize: 22, fontWeight: 'bold', marginTop: 6,
                color: data.carrier.availableCredit === null ? T.muted
                  : data.carrier.availableCredit < 10 ? T.red
                  : data.carrier.availableCredit < 25 ? T.amber : T.text,
              }}>
                {data.carrier.availableCredit === null
                  ? '-'
                  : usd(data.carrier.availableCredit)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
                BURN / DAY
              </div>
              <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 6, color: T.text }}>
                {usd(data.carrier.dailyBurnUsd)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
                RUNWAY
              </div>
              <div style={{
                fontSize: 22, fontWeight: 'bold', marginTop: 6,
                color: data.carrier.runwayDays === null ? T.muted
                  : data.carrier.runwayDays < 7 ? T.red
                  : data.carrier.runwayDays < 30 ? T.amber : T.green,
              }}>
                {data.carrier.runwayDays === null
                  ? '-'
                  : `${Math.floor(data.carrier.runwayDays)} days`}
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, flex: '1 1 260px' }}>
              {data.carrier.authoritative
                ? `Straight-line from the last ${data.windowDays} days of spend, including number rental. A floor that dials harder than last week burns faster than this.`
                : `Carrier balance unavailable, so runway cannot be computed and shows a dash.${data.carrier.error ? ` (${data.carrier.error})` : ''}`}
            </div>
          </div>

          <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
            {data.totals.calls.toLocaleString()} calls · {Math.round(data.totals.talkMinutes).toLocaleString()} talk minutes ·{' '}
            {data.totals.amdLegs.toLocaleString()} AMD legs over {data.windowDays} days.
            {' '}<strong style={{ color: T.text }}>
              AMD is {data.totals.costUsd > 0
                ? Math.round((data.totals.amdLegs * data.rates.perAmdLegUsd / data.totals.costUsd) * 100)
                : 0}% of carrier cost.
            </strong>
            {' '}{data.platform.numbers} numbers at {usd(data.platform.numbersMonthlyUsd)}/mo,
            {' '}{usd(data.platform.numberRentalUsd)} of it inside this window.
          </div>

          {/* ── PER CUSTOMER ────────────────────────────────────────────── */}
          <div style={{ overflowX: 'auto', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 780 }}>
              <thead>
                <tr>
                  {['CUSTOMER', 'PLAN', 'CALLS', 'MINUTES', 'AMD LEGS', 'COST', 'REVENUE', 'MARGIN'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 0 || i === 1 ? 'left' : 'right',
                      fontSize: 9.5, letterSpacing: 1.5, color: T.accent, fontWeight: 'bold',
                      padding: '10px 12px', borderBottom: `2px solid ${T.accent}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: T.muted }}>
                    No activity in this window.
                  </td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.clerkId}>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${T.surface}` }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {r.name || r.email}
                        {r.internal && (
                          <span style={{
                            marginLeft: 6, fontSize: 8.5, letterSpacing: 1, padding: '1px 5px',
                            borderRadius: 2, background: T.surface, color: T.muted, fontWeight: 'bold',
                          }}>INTERNAL</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: T.muted }}>{r.email}</div>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${T.surface}`, color: T.muted }}>
                      {r.paying ? (r.plan === 'wl' ? 'Manager+' : 'Pro') : (r.subStatus || 'none')}
                    </td>
                    {[
                      r.calls.toLocaleString(),
                      Math.round(r.talkMinutes).toLocaleString(),
                      r.amdLegs.toLocaleString(),
                      usd(r.costUsd),
                      usd(r.revenueUsd),
                    ].map((v, i) => (
                      <td key={i} style={{
                        padding: '9px 12px', borderBottom: `1px solid ${T.surface}`,
                        textAlign: 'right', fontFamily: 'monospace',
                      }}>{v}</td>
                    ))}
                    <td style={{
                      padding: '9px 12px', borderBottom: `1px solid ${T.surface}`,
                      textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold',
                      color: r.marginUsd >= 0 ? T.green : T.red,
                    }}>
                      {usd(r.marginUsd)}
                      <span style={{ color: T.muted, fontWeight: 'normal' }}> · {pct(r.marginPct)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 12, lineHeight: 1.65, maxWidth: 780 }}>
            {data.rates.note} Revenue is the seat rate over the same window, so cost and revenue are
            comparable. Sorted worst margin first, the row worth looking at is never at the top of an
            alphabetical list.
          </div>
        </>
      )}
    </div>
  )
}
