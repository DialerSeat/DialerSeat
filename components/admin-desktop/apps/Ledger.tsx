'use client'
import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// LEDGER — our own copy of Telnyx's books
// =============================================================================
// Every other cost screen on this platform multiplies our rates by our usage.
// That answers what something should have cost. This one holds what Telnyx
// itself reported, captured the day they reported it.
//
// The distinction stopped being academic on 14 Sept, when two debits of $2.03
// and $2.12 landed in a window whose entire billable activity modelled out at
// seven cents — and the portal does not expose transaction detail until the
// following month.
//
// THE POINT IS THE REVISIONS PANEL. Records are stored append-only: if a later
// capture returns the same record with different content, both versions are
// kept and the difference is shown. A carrier that can restate a figure nobody
// wrote down cannot be audited, and this is the writing down.
// =============================================================================

const T = {
  bg: '#f0f1f4', surface: '#e2e4ea', border: '#c4c8d0',
  text: '#1a1c24', muted: '#5a5e6a', accent: '#2a4a8a',
  green: '#1a6a1a', red: '#8a1a1a', amber: '#8a6a1a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, monospace"

const usd = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? '-' : `$${n.toFixed(4)}`

interface TypeRow {
  recordType: string; records: number; billedUsd: number; billedSeconds: number
}
interface Revision {
  record_type: string; telnyx_id: string; versions: number
  first_seen: string; last_seen: string
  lowest_cost: number | null; highest_cost: number | null
  cost_moved_by: number | null
  cost_history: Array<number | null>
}
interface LedgerData {
  success: boolean
  totalRecords: number
  totalBilledUsd: number
  byType: TypeRow[]
  revisions: Revision[]
  revisionCount: number
  firstCapture: string | null
}

function Panel({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`,
      borderRadius: 4, padding: 16, minWidth: 0, marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: T.accent }}>
        {title}
      </div>
      {note && (
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, lineHeight: 1.6 }}>{note}</div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#fff', border: `1px solid ${T.border}`, borderRadius: 3,
  color: T.text, fontSize: 12, padding: '7px 9px', fontFamily: FUTURA,
}

export default function LedgerApp() {
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [range, setRange] = useState('today')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/telnyx-ledger?days=90').then(x => x.json())
      setData(r)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Scheduled rather than awaited inline, so the first load takes the same
    // path as any later one and the setState-in-effect rule has nothing to
    // complain about.
    const id = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(id)
  }, [load])

  const capture = useCallback(async () => {
    setCapturing(true)
    setMessage(null)
    try {
      const r = await fetch('/api/admin/telnyx-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
      }).then(x => x.json())

      if (!r?.success) {
        setMessage(r?.error || 'Capture failed.')
      } else {
        setMessage(
          `${r.captured} new record(s) stored, ${r.unchanged} already held`
          + (r.revised > 0
            ? ` — and ${r.revised} came back DIFFERENT from a previous capture.`
            : '. Nothing Telnyx reported has changed since it was last read.')
        )
        void load()
      }
    } catch {
      setMessage('Request failed.')
    } finally {
      setCapturing(false)
    }
  }, [range, load])

  return (
    <div style={{
      background: T.bg, color: T.text, fontFamily: FUTURA,
      padding: 16, height: '100%', overflowY: 'auto',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, letterSpacing: 3, fontWeight: 'bold' }}>
          TELNYX LEDGER
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.6, maxWidth: 680 }}>
          What Telnyx reported, stored the day they reported it. Every other cost
          figure on this platform is our rates times our usage; this is theirs.
          They do not publish transaction detail until the following month, so
          between an event and its invoice this is the only record of their
          position.
        </div>
      </div>

      <Panel
        title="CAPTURE"
        note="Reads their detail records and stores anything new. Re-capturing the same record is free; a record that comes back different is kept alongside the original rather than replacing it."
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={range} onChange={e => setRange(e.target.value)} style={inputStyle}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_week">Last week</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
          </select>
          <button onClick={() => void capture()} disabled={capturing} style={{
            background: T.accent, color: '#fff', border: 'none', borderRadius: 3,
            fontSize: 11, letterSpacing: 1, padding: '8px 14px', fontFamily: FUTURA,
            cursor: capturing ? 'not-allowed' : 'pointer', opacity: capturing ? 0.6 : 1,
          }}>{capturing ? 'READING TELNYX…' : 'CAPTURE NOW'}</button>
        </div>
        {message && (
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.6 }}>
            {message}
          </div>
        )}
      </Panel>

      {/* ── REVISIONS: the reason this app exists ───────────────────────── */}
      <Panel
        title="RECORDS THEY LATER CHANGED"
        note="A billing record Telnyx reported one way and subsequently reported another. Empty is the expected and desired state."
      >
        {loading ? (
          <div style={{ fontSize: 12, color: T.muted }}>LOADING…</div>
        ) : !data?.revisionCount ? (
          <div style={{ fontSize: 12, color: T.green }}>
            No record has changed since it was captured.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{
              fontSize: 12, color: T.red, fontWeight: 'bold', marginBottom: 10,
            }}>
              {data.revisionCount} record(s) were reported differently on a later read.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 620 }}>
              <thead>
                <tr>
                  {['TYPE', 'THEIR RECORD ID', 'VERSIONS', 'COST HISTORY', 'MOVED BY'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i > 1 ? 'right' : 'left', padding: '6px 8px',
                      borderBottom: `1px solid ${T.border}`, color: T.muted,
                      fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.revisions.map(r => (
                  <tr key={r.record_type + r.telnyx_id}>
                    <td style={{ padding: '7px 8px', borderBottom: `1px solid ${T.surface}` }}>
                      {r.record_type}
                    </td>
                    <td style={{
                      padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                      fontFamily: MONO, fontSize: 10.5, color: T.muted,
                    }}>{r.telnyx_id}</td>
                    <td style={{
                      padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                      textAlign: 'right', fontFamily: MONO,
                    }}>{r.versions}</td>
                    <td style={{
                      padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                      textAlign: 'right', fontFamily: MONO, fontSize: 10.5,
                    }}>{(r.cost_history || []).map(c => usd(c)).join(' → ')}</td>
                    <td style={{
                      padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                      textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                      color: (r.cost_moved_by ?? 0) !== 0 ? T.red : T.muted,
                    }}>{usd(r.cost_moved_by)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="WHAT THEY HAVE BILLED"
        note="Totalled from their own records, not our rate model. A type listed here is one they are charging for."
      >
        {loading ? (
          <div style={{ fontSize: 12, color: T.muted }}>LOADING…</div>
        ) : !data?.byType?.length ? (
          <div style={{ fontSize: 12, color: T.muted }}>
            Nothing captured yet. Use CAPTURE NOW above.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, fontFamily: MONO, fontWeight: 'bold', marginBottom: 12 }}>
              {usd(data.totalBilledUsd)}
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 'normal', marginLeft: 8 }}>
                across {data.totalRecords.toLocaleString()} record
                {data.totalRecords === 1 ? '' : 's'}
                {data.firstCapture
                  ? `, first captured ${new Date(data.firstCapture).toLocaleDateString()}`
                  : ''}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 520 }}>
                <thead>
                  <tr>
                    {['RECORD TYPE', 'RECORDS', 'BILLED SECONDS', 'BILLED'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px',
                        borderBottom: `1px solid ${T.border}`, color: T.muted,
                        fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map(t => (
                    <tr key={t.recordType}>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${T.surface}` }}>
                        {t.recordType}
                      </td>
                      <td style={{
                        padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                        textAlign: 'right', fontFamily: MONO, color: T.muted,
                      }}>{t.records.toLocaleString()}</td>
                      <td style={{
                        padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                        textAlign: 'right', fontFamily: MONO, color: T.muted,
                      }}>{t.billedSeconds.toLocaleString()}</td>
                      <td style={{
                        padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                        textAlign: 'right', fontFamily: MONO, fontWeight: 'bold',
                      }}>{usd(t.billedUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.8, marginTop: 4 }}>
        Records are never overwritten. Capturing the same window twice stores
        nothing new unless Telnyx changed something, which is the only way a
        restated figure can be noticed at all.
      </div>
    </div>
  )
}
