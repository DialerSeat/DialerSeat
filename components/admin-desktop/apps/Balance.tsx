'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// BALANCE — the carrier account as a bank statement
// =============================================================================
// Every other money screen here is rate times usage: what something SHOULD have
// cost. This one is what Telnyx actually took, read from the balance as it
// moves, set beside the usage we have records for.
//
// The two do not match, and the gap is the reason this exists. A month came to
// $20 while our own arithmetic said $15.50, and nothing on the platform could
// say where the rest went — because per-number purchase fees, E911, taxes and
// regulatory surcharges never touch our tables.
//
// So the gap is shown rather than hidden. A row that cannot be explained says
// so, instead of having its remainder folded into a category to make it
// balance. An invented attribution is worse than an honest hole, because it
// stops anybody looking for the real answer.
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
const MONO = 'ui-monospace, Menlo, monospace'

const RANGES = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
  { key: 365, label: '1Y' },
]

interface Entry {
  at: string
  periodStart: string
  deltaUsd: number
  direction: 'out' | 'in'
  balanceAfter: number
  activity: {
    calls: number
    amdLegs: number; amdUsd: number
    talkMinutes: number; minutesUsd: number
    recordedMinutes: number; recordingUsd: number
    numbersBought: string[]
  }
  explainedUsd: number
  unexplainedUsd: number | null
}

interface Charge {
  callId: string
  at: string
  userId: string | null
  userName: string
  phone: string | null
  disposition: string | null
  talkMinutes: number
  amdUsd: number
  minutesUsd: number
  recordingUsd: number
  totalUsd: number
}

interface PerUser {
  userId: string; name: string; calls: number
  amdLegs: number; amdUsd: number
  talkMinutes: number; minutesUsd: number
  recordedMinutes: number; recordingUsd: number
  totalUsd: number
}

interface BillMonth {
  month: string
  billed: number | null
  estimated: number
  gapUsd: number | null
  note: string | null
  usage: {
    amdLegs: number; amdUsd: number
    talkMinutes: number; minutesUsd: number
    recordedMinutes: number; recordingUsd: number
    rentalUsd: number; numbersHeld: number; numbersBought: number
  }
}

interface Ledger {
  windowDays: number
  covered: boolean
  snapshots: number
  watchingSince: string | null
  balanceNow: number | null
  totals: { outUsd: number; inUsd: number; explainedUsd: number; unexplainedUsd: number
            unverifiedCreditsUsd?: number; creditNote?: string }
  entries: Entry[]
  charges: Charge[]
  chargesTotal: number
  chargedUsd: number
  perUser: PerUser[]
}

/** Four decimals, because most individual charges are fractions of a cent. */
const usd4 = (v: number) => `$${v.toFixed(4)}`
const usd = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

const inputStyle: React.CSSProperties = {
  background: '#fff', border: `1px solid ${T.border}`, borderRadius: 3,
  color: T.text, fontSize: 12, padding: '7px 9px', fontFamily: FUTURA,
}

function Panel({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4,
      padding: 16, minWidth: 0, marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: T.accent }}>
        {title}
      </div>
      {note && (
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{note}</div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

export default function BalanceApp() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Ledger | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'statement' | 'charges' | 'people' | 'bills'>('statement')
  const [bills, setBills] = useState<BillMonth[] | null>(null)
  const [billForm, setBillForm] = useState<{ month: string; total: string; note: string }>({
    month: new Date().toISOString().slice(0, 7), total: '', note: '',
  })
  const [billBusy, setBillBusy] = useState(false)
  const [billMsg, setBillMsg] = useState<string | null>(null)

  const loadBills = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/telnyx-bill?months=6', { cache: 'no-store' })
      const j = await r.json()
      if (j?.success) setBills(j.months as BillMonth[])
    } catch { /* the tab shows its own empty state */ }
  }, [])

  const saveBill = useCallback(async () => {
    const total = Number(billForm.total)
    if (!Number.isFinite(total) || total < 0) { setBillMsg('Enter the total as a number.'); return }
    setBillBusy(true)
    setBillMsg(null)
    try {
      const r = await fetch('/api/admin/telnyx-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: billForm.month, totalUsd: total, note: billForm.note || null }),
      })
      const j = await r.json()
      setBillMsg(j?.success ? `Recorded ${billForm.month}.` : (j?.error || 'Could not save.'))
      if (j?.success) { setBillForm(f => ({ ...f, total: '', note: '' })); void loadBills() }
    } catch {
      setBillMsg('Could not reach the server.')
    } finally {
      setBillBusy(false)
    }
  }, [billForm, loadBills])

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/balance-ledger?days=${days}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j?.success) { setError(j?.error || 'Could not load the ledger'); return }
      setError(null)
      setData(j as Ledger)
    } catch {
      setError('Could not reach the server')
    }
  }, [days])

  useEffect(() => {
    // Scheduled rather than called inline, so the first load takes the same
    // path as any later one and the lint rule about setState in an effect has
    // nothing to complain about.
    const id = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(id)
  }, [load])

  // Fetched when the tab is first opened rather than up front: a monthly figure
  // on a screen most visits never scroll to.
  useEffect(() => {
    if (tab !== 'bills' || bills !== null) return
    const id = setTimeout(() => { void loadBills() }, 0)
    return () => clearTimeout(id)
  }, [tab, bills, loadBills])

  return (
    <div style={{
      height: '100%', overflow: 'auto', background: T.bg,
      padding: 16, fontFamily: FUTURA, color: T.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, letterSpacing: 2, fontWeight: 'bold' }}>TELNYX BALANCE</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setDays(r.key)} style={{
              background: days === r.key ? T.accent : '#fff',
              color: days === r.key ? '#fff' : T.muted,
              border: `1px solid ${days === r.key ? T.accent : T.border}`,
              borderRadius: 3, fontSize: 10, letterSpacing: 1,
              padding: '4px 9px', cursor: 'pointer', fontFamily: FUTURA,
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#f8e8e8', border: `1px solid ${T.red}`,
          color: T.red, borderRadius: 4, fontSize: 12, marginBottom: 12,
        }}>{error}</div>
      )}

      {!data ? (
        <div style={{ color: T.muted, fontSize: 12 }}>LOADING…</div>
      ) : (
        <>
          {/* ── THE HEADLINE FOUR ──────────────────────────────────────── */}
          <div style={{
            display: 'grid', gap: 10, marginBottom: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}>
            {([
              ['BALANCE NOW', data.balanceNow === null ? '-' : usd(data.balanceNow),
                data.balanceNow === null ? T.muted
                  : data.balanceNow < 10 ? T.red : data.balanceNow < 25 ? T.amber : T.green],
              ['OUT', data.covered ? usd(data.totals.outUsd) : '-', T.red],
              // Not "IN". We observe the balance rising; we never observe a
              // payment. Telnyx posts corrections and occasional spurious
              // credits that settle back out -- this account saw +$1.04 at
              // 11:01 on 14 Sept followed by a $0.92 debit six minutes later,
              // during a window with zero calls. Calling that "IN" turns a
              // glitch into a deposit.
              ['CREDITED', data.covered ? usd(data.totals.inUsd) : '-', T.green],
              // The whole reason the app exists, so it gets a tile rather than
              // a footnote.
              ['UNEXPLAINED', data.covered ? usd(data.totals.unexplainedUsd) : '-',
                data.totals.unexplainedUsd > 0 ? T.amber : T.muted],
            ] as const).map(([label, value, colour]) => (
              <div key={label} style={{
                background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, padding: 14,
              }}>
                <div style={{ fontSize: 9.5, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
                  {label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 6, color: colour, fontFamily: MONO }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {!data.covered && (
            <div style={{
              background: '#fff8e6', border: `1px solid ${T.amber}`, borderRadius: 4,
              padding: '11px 14px', fontSize: 11.5, color: T.text,
              lineHeight: 1.7, marginBottom: 12,
            }}>
              Not enough readings yet. The balance is recorded when it moves, and two
              readings are the minimum for a single movement — so this fills in as the
              floor dials rather than being backfillable. Nothing before
              {data.watchingSince ? ` ${when(data.watchingSince)}` : ' the first reading'} can be
              reconstructed, because nobody was watching the balance then.
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {([
              ['statement', `STATEMENT (${data.entries.length})`],
              ['charges', `CHARGES (${data.chargesTotal})`],
              ['people', `PER PERSON (${data.perUser.length})`],
              ['bills', 'VS THEIR LEDGER'],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                background: tab === id ? T.accent : '#fff',
                color: tab === id ? '#fff' : T.muted,
                border: `1px solid ${tab === id ? T.accent : T.border}`,
                borderRadius: 3, fontSize: 10, letterSpacing: 1,
                padding: '6px 11px', cursor: 'pointer', fontFamily: FUTURA,
              }}>{label}</button>
            ))}
          </div>

          {/* ── STATEMENT ──────────────────────────────────────────────── */}
          {tab === 'statement' && (
            <Panel
              title="MOVEMENTS"
              note="Every time the balance actually moved, newest first, with what was dialed in that interval. Money out is what Telnyx took; what we can show for it is beside it."
            >
              {data.entries.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted }}>
                  No movement recorded in this window.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {data.entries.map(e => (
                    <div key={e.at} style={{
                      border: `1px solid ${T.border}`, borderRadius: 4, padding: '10px 12px',
                      borderLeft: `3px solid ${e.direction === 'out' ? T.red : T.green}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 16, fontWeight: 'bold', fontFamily: MONO,
                          color: e.direction === 'out' ? T.red : T.green,
                        }}>
                          {e.direction === 'out' ? '-' : '+'}{usd(Math.abs(e.deltaUsd))}
                        </span>
                        <span style={{ fontSize: 11, color: T.muted }}>{when(e.at)}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted, fontFamily: MONO }}>
                          balance {usd(e.balanceAfter)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.7 }}>
                        {e.direction === 'in' ? (
                          // A rise is not a deposit. Nothing here knows why the
                          // balance went up, and Telnyx is known to post credits
                          // that settle back out -- so this says what was seen
                          // rather than what it assumes happened.
                          <>The balance rose by this much. Nothing on our side records a
                            payment, and the carrier posts corrections and occasional
                            spurious credits that reverse later — so treat this as an
                            observation, not money banked. The month-end invoice settles it.</>
                        ) : e.activity.calls === 0 && e.activity.numbersBought.length === 0 ? (
                          <>Nothing was dialed in this interval. A charge with no activity
                            behind it is rental posting, a fee, or tax.</>
                        ) : (
                          <>
                            {e.activity.calls.toLocaleString()} calls
                            {e.activity.amdLegs > 0 && <> · {e.activity.amdLegs} AMD legs {usd4(e.activity.amdUsd)}</>}
                            {e.activity.talkMinutes > 0 && <> · {e.activity.talkMinutes.toFixed(1)} talk min {usd4(e.activity.minutesUsd)}</>}
                            {e.activity.recordedMinutes > 0 && <> · {e.activity.recordedMinutes.toFixed(1)} rec min {usd4(e.activity.recordingUsd)}</>}
                            {e.activity.numbersBought.length > 0 && (
                              <> · bought {e.activity.numbersBought.join(', ')}</>
                            )}
                          </>
                        )}
                      </div>
                      {e.direction === 'out' && (e.unexplainedUsd ?? 0) > 0.0001 && (
                        <div style={{ fontSize: 11, color: T.amber, marginTop: 4 }}>
                          {usd(e.unexplainedUsd ?? 0)} of this is not explained by usage —
                          fees, tax, or rental posting.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* ── EVERY CHARGE ───────────────────────────────────────────── */}
          {tab === 'charges' && (
            <Panel
              title={`CHARGES · ${usd(data.chargedUsd)} across ${data.chargesTotal.toLocaleString()} calls`}
              note="Each call that should have cost something, and whose it was. Derived from our rates, since Telnyx does not itemise per call. Calls that cost nothing are left out rather than listed at zero."
            >
              {data.charges.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted }}>Nothing billable in this window.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 720 }}>
                    <thead>
                      <tr>
                        {['WHEN', 'WHO', 'NUMBER', 'OUTCOME', 'AMD', 'MINUTES', 'RECORDING', 'TOTAL'].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i > 3 ? 'right' : 'left', padding: '6px 8px',
                            borderBottom: `1px solid ${T.border}`, color: T.muted,
                            fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.charges.map(c => (
                        <tr key={c.callId}>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${T.surface}`, color: T.muted, whiteSpace: 'nowrap' }}>
                            {when(c.at)}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${T.surface}` }}>{c.userName}</td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${T.surface}`, fontFamily: MONO }}>
                            {c.phone || '-'}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${T.surface}`, color: T.muted }}>
                            {c.disposition || '-'}
                          </td>
                          {[c.amdUsd, c.minutesUsd, c.recordingUsd].map((v, i) => (
                            <td key={i} style={{
                              padding: '5px 8px', borderBottom: `1px solid ${T.surface}`,
                              textAlign: 'right', fontFamily: MONO,
                              color: v > 0 ? T.text : T.muted,
                            }}>{v > 0 ? usd4(v) : '-'}</td>
                          ))}
                          <td style={{
                            padding: '5px 8px', borderBottom: `1px solid ${T.surface}`,
                            textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                          }}>{usd4(c.totalUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.chargesTotal > data.charges.length && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                      Newest {data.charges.length} of {data.chargesTotal.toLocaleString()} shown.
                      The totals above and the per-person tab count all of them.
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* ── PER PERSON ─────────────────────────────────────────────── */}
          {tab === 'people' && (
            <Panel
              title="WHAT EACH PERSON COSTS"
              note="Every charged call in the window, grouped by who placed it. Detection dominates on a floor that dials hard, because it bills per leg whether or not anybody answers."
            >
              {data.perUser.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted }}>Nobody has cost anything in this window.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
                    <thead>
                      <tr>
                        {['PERSON', 'CALLS', 'AMD LEGS', 'AMD', 'TALK MIN', 'MINUTES', 'RECORDING', 'TOTAL'].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px',
                            borderBottom: `1px solid ${T.border}`, color: T.muted,
                            fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.perUser.map(u => (
                        <tr key={u.userId}>
                          <td style={{ padding: '7px 8px', borderBottom: `1px solid ${T.surface}`, fontWeight: 500 }}>
                            {u.name}
                          </td>
                          {[
                            u.calls.toLocaleString(),
                            u.amdLegs.toLocaleString(),
                            usd4(u.amdUsd),
                            u.talkMinutes.toFixed(1),
                            usd4(u.minutesUsd),
                            usd4(u.recordingUsd),
                          ].map((v, i) => (
                            <td key={i} style={{
                              padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                              textAlign: 'right', fontFamily: MONO, color: T.muted,
                            }}>{v}</td>
                          ))}
                          <td style={{
                            padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                            textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                          }}>{usd4(u.totalUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {/* ── VS THEIR LEDGER ────────────────────────────────────────
              The month-end invoice is the only thing that settles any of this.
              Everything else here is inference; this is the answer. */}
          {tab === 'bills' && (
            <Panel
              title="THE MONTH AGAINST THEIR INVOICE"
              note="Telnyx issues a ledger at month end. Put its total in and every estimate here becomes a checkable claim. Across months the useful thing is not any single gap but whether the gap holds steady."
            >
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-end',
                flexWrap: 'wrap', marginBottom: 14,
              }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 9.5, letterSpacing: 1.5, color: T.muted }}>MONTH</span>
                  <input type="month" value={billForm.month}
                         onChange={e => setBillForm(f => ({ ...f, month: e.target.value }))}
                         style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 9.5, letterSpacing: 1.5, color: T.muted }}>TOTAL BILLED</span>
                  <input inputMode="decimal" placeholder="28.29" value={billForm.total}
                         onChange={e => setBillForm(f => ({ ...f, total: e.target.value }))}
                         style={{ ...inputStyle, fontFamily: MONO, width: 110 }} />
                </label>
                <label style={{ display: 'grid', gap: 4, flex: '1 1 200px' }}>
                  <span style={{ fontSize: 9.5, letterSpacing: 1.5, color: T.muted }}>NOTE</span>
                  <input placeholder="e.g. includes an August short-call surcharge"
                         value={billForm.note}
                         onChange={e => setBillForm(f => ({ ...f, note: e.target.value }))}
                         style={inputStyle} />
                </label>
                <button onClick={() => void saveBill()} disabled={billBusy} style={{
                  background: T.accent, color: '#fff', border: 'none', borderRadius: 3,
                  fontSize: 11, letterSpacing: 1, padding: '8px 14px',
                  cursor: billBusy ? 'not-allowed' : 'pointer', fontFamily: FUTURA,
                  opacity: billBusy ? 0.6 : 1,
                }}>{billBusy ? 'SAVING…' : 'RECORD'}</button>
              </div>
              {billMsg && (
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>{billMsg}</div>
              )}

              {!bills ? (
                <div style={{ fontSize: 12, color: T.muted }}>LOADING…</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 680 }}>
                    <thead>
                      <tr>
                        {['MONTH', 'NUMBERS', 'AMD', 'MINUTES', 'RECORDING', 'OUR ESTIMATE', 'THEY BILLED', 'GAP'].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px',
                            borderBottom: `1px solid ${T.border}`, color: T.muted,
                            fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map(b => (
                        <tr key={b.month}>
                          <td style={{ padding: '7px 8px', borderBottom: `1px solid ${T.surface}`, fontWeight: 500 }}>
                            {b.month}
                            {b.note && (
                              <div style={{ fontSize: 10, color: T.muted, fontWeight: 400 }}>{b.note}</div>
                            )}
                          </td>
                          {[
                            `${b.usage.numbersHeld}${b.usage.numbersBought > 0 ? ` (+${b.usage.numbersBought})` : ''}`,
                            usd(b.usage.amdUsd),
                            usd(b.usage.minutesUsd),
                            usd(b.usage.recordingUsd),
                            usd(b.estimated),
                          ].map((v, i) => (
                            <td key={i} style={{
                              padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                              textAlign: 'right', fontFamily: MONO, color: T.muted,
                            }}>{v}</td>
                          ))}
                          <td style={{
                            padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                            textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                          }}>{b.billed === null ? '-' : usd(b.billed)}</td>
                          <td style={{
                            padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                            textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                            color: b.gapUsd === null ? T.muted : b.gapUsd > 0 ? T.amber : T.green,
                          }}>{b.gapUsd === null ? 'no ledger yet' : usd(b.gapUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>
                    The gap is what Telnyx billed minus what we can evidence, and it is not an
                    overcharge on its own: per-number purchase fees, E911 and tax never reach
                    our tables, and a surcharge can post a month after the behaviour that
                    earned it. A gap that stays roughly constant per number per month is
                    those fees. One that grows with dialing volume is a usage charge we are
                    not seeing, and that is the one worth an email.
                  </div>
                </div>
              )}
            </Panel>
          )}

          <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.8, marginTop: 4 }}>
            Movements are what Telnyx actually took. Charges and per-person figures are
            our own rates times usage, because Telnyx does not itemise per call. The
            difference between the two is the UNEXPLAINED tile, and it is where
            per-number purchase fees, E911, tax and rental posting live — none of which
            reach our tables. Worth watching whether that gap tracks the size of the
            pool or the volume of dialing; only the second would be a usage charge.
          </div>
        </>
      )}
    </div>
  )
}
