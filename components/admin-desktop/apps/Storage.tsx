'use client'
import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// STORAGE — how close the database is to going read-only
// =============================================================================
// At 500MB the Supabase Free Plan switches the project to READ-ONLY. Not slow,
// not degraded: no call rows, no dispositions, no heartbeats, no lead uploads.
// The dialer keeps dialing and stops remembering, and nothing looks broken
// until somebody goes hunting for a call that was never written.
//
// ops-health alerts on the total at 70% and 85%. This screen answers the part
// an alert cannot: WHICH table, and how long is left. A warning that says "78%"
// and nothing else leaves an operator deleting at random.
// =============================================================================

const T = {
  bg: '#f0f1f4', surface: '#e2e4ea', border: '#c4c8d0',
  text: '#1a1c24', muted: '#5a5e6a', accent: '#2a4a8a',
  green: '#1a6a1a', red: '#8a1a1a', amber: '#8a6a1a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, monospace"

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

interface TableRow {
  name: string; totalBytes: number; indexBytes: number; rows: number
  pctOfDb: number; purgeable: boolean; partition: boolean
}
interface Capacity {
  success: boolean; error?: string
  limitBytes: number; totalBytes: number; usedPct: number; remainingBytes: number
  level: 'ok' | 'warn' | 'urgent'
  warnPct: number; urgentPct: number
  growthBytesPerDay: number; daysToFull: number | null
  sampleCalls: number; sampleEvents: number
  purgeableBytes: number; purgeableTables: number
  tables: TableRow[]
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

export default function StorageApp() {
  const [data, setData] = useState<Capacity | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetch('/api/admin/db-capacity').then(r => r.json()))
    } catch {
      setData({ success: false, error: 'Request failed.' } as Capacity)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(id)
  }, [load])

  const tone = data?.level === 'urgent' ? T.red : data?.level === 'warn' ? T.amber : T.green

  return (
    <div style={{
      background: T.bg, color: T.text, fontFamily: FUTURA,
      padding: 16, height: '100%', overflowY: 'auto',
    }}>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, letterSpacing: 3, fontWeight: 'bold' }}>STORAGE</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.6, maxWidth: 640 }}>
            At 500 MB the Free Plan switches this project to read-only. The dialer
            keeps dialing and stops remembering — no calls, no dispositions, no
            heartbeats. Nothing looks broken until somebody looks for a call that
            was never written.
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{
          background: T.accent, color: '#fff', border: 'none', borderRadius: 3,
          fontSize: 11, letterSpacing: 1, padding: '8px 14px', fontFamily: FUTURA,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          flexShrink: 0,
        }}>{loading ? 'READING…' : 'REFRESH'}</button>
      </div>

      {data && data.success === false && (
        <Panel title="ERROR"><div style={{ fontSize: 12, color: T.red }}>{data.error}</div></Panel>
      )}

      {data?.success && (
        <>
          <Panel title="HEADROOM">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 30, fontFamily: MONO, fontWeight: 'bold', color: tone }}>
                {data.usedPct}%
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>
                {mb(data.totalBytes)} of {mb(data.limitBytes)} · {mb(data.remainingBytes)} left
              </div>
            </div>

            {/* The bar carries both thresholds, so "we are fine" and "we are
                nearly out" are the same glance rather than two readings. */}
            <div style={{
              position: 'relative', height: 12, background: T.surface,
              borderRadius: 6, marginTop: 12, overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, data.usedPct)}%`, height: '100%',
                background: tone, transition: 'width .3s',
              }} />
              {[data.warnPct, data.urgentPct].map(p => (
                <div key={p} style={{
                  position: 'absolute', left: `${p}%`, top: 0, bottom: 0,
                  width: 2, background: '#fff', opacity: 0.85,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: T.muted, marginTop: 5 }}>
              marks at {data.warnPct}% (warn) and {data.urgentPct}% (urgent) — the
              same thresholds ops-health alerts on
            </div>

            <div style={{ fontSize: 12, marginTop: 14, lineHeight: 1.7 }}>
              {data.daysToFull === null ? (
                <span style={{ color: T.muted }}>
                  Nothing written in the last seven days, so there is no trend to
                  project. An idle platform has no growth rate.
                </span>
              ) : (
                <>
                  Growing <strong style={{ fontFamily: MONO }}>{mb(data.growthBytesPerDay)}/day</strong>
                  {' '}— full in{' '}
                  <strong style={{
                    fontFamily: MONO,
                    color: data.daysToFull < 30 ? T.red : data.daysToFull < 90 ? T.amber : T.green,
                  }}>{data.daysToFull} days</strong>
                  <span style={{ color: T.muted }}>
                    {' '}at that rate. Measured over a real week
                    ({data.sampleCalls.toLocaleString()} calls,{' '}
                    {data.sampleEvents.toLocaleString()} events), not extrapolated
                    from today.
                  </span>
                </>
              )}
            </div>
          </Panel>

          <Panel
            title="WHAT IS SAFE TO DELETE"
            note="Only tables whose old rows nobody needs. calls and leads are deliberately absent — they are the product's memory, and an operator hunting for space should not be offered a button that deletes the business."
          >
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              <strong style={{ fontFamily: MONO, fontSize: 15 }}>{mb(data.purgeableBytes)}</strong>
              {' '}across {data.purgeableTables} table{data.purgeableTables === 1 ? '' : 's'}
              {' '}— <strong>{data.totalBytes
                ? Math.round((data.purgeableBytes / data.totalBytes) * 100)
                : 0}%</strong> of the database.
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.7 }}>
              Rows marked <strong>PARTITION</strong> can be <em>dropped whole</em>, which
              returns the space immediately. Deleting rows from an ordinary table
              leaves dead tuples behind until autovacuum reclaims them, so the
              number above will not move — which is how somebody ends up deleting
              the same thing twice.
            </div>
          </Panel>

          <Panel title="BY TABLE" note="Total size includes indexes and TOAST, which is what actually counts against the ceiling. Row counts are planner estimates, not exact counts.">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
                <thead>
                  <tr>
                    {['TABLE', 'SIZE', 'INDEXES', 'ROWS', '% OF DB', ''].map((h, i) => (
                      <th key={h || i} style={{
                        textAlign: i === 0 || i === 5 ? 'left' : 'right', padding: '6px 8px',
                        borderBottom: `1px solid ${T.border}`, color: T.muted,
                        fontSize: 9, letterSpacing: 1, fontWeight: 'bold',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.tables.map(t => (
                    <tr key={t.name}>
                      <td style={{
                        padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                        fontFamily: MONO, fontSize: 11,
                      }}>{t.name}</td>
                      {[mb(t.totalBytes), mb(t.indexBytes), t.rows.toLocaleString(),
                        `${t.pctOfDb}%`].map((v, i) => (
                        <td key={i} style={{
                          padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                          textAlign: 'right', fontFamily: MONO,
                          color: i === 0 ? T.text : T.muted,
                          fontWeight: i === 0 ? 'bold' : 'normal',
                        }}>{v}</td>
                      ))}
                      <td style={{
                        padding: '7px 8px', borderBottom: `1px solid ${T.surface}`,
                        fontSize: 8.5, letterSpacing: 0.5, fontWeight: 'bold',
                      }}>
                        {t.partition ? (
                          <span style={{ color: T.green }}>PARTITION</span>
                        ) : t.purgeable ? (
                          <span style={{ color: T.amber }}>PURGEABLE</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {loading && !data && (
        <div style={{ fontSize: 12, color: T.muted }}>READING…</div>
      )}
    </div>
  )
}
