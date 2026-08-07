'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// LIVE OPS — what is happening right now, and what is quietly wrong
// =============================================================================
// Every panel here exists because something broke and stayed broken because
// nothing showed it:
//
//   CONCURRENCY   The carrier caps simultaneous legs at the account level.
//                 There was no way to see how close we were until dials
//                 started failing.
//   IN FLIGHT     Abort left calls up. The only way to notice was a phone
//                 still ringing in the room.
//   SOURCE MIX    The predictive controller placed ZERO calls for weeks. One
//                 glance at this would have caught it.
//   AMD           The detector hung up on humans at roughly 4:1. It took a
//                 database query to find.
//   RECORDINGS    Capture sat near zero while every recording played 0:00.
//
// It polls rather than streams: this is an operator glancing at a screen, not
// a trading terminal, and a 5s poll costs one query set against indexed data.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"
const POLL_MS = 5000

interface OpsData {
  generatedAt: string
  concurrency: {
    inFlightLegs: number | null
    budget: number
    authoritative: boolean
  }
  inFlight: Array<{
    id: string
    phone: string | null
    source: string
    ageSeconds: number
    answered: boolean
    hasAgentLeg: boolean
  }>
  inFlightCount: number
  sourceMix: Array<{ source: string; dials: number; connects: number; connectRate: number | null }>
  dialsLast24h: number
  amd: { distribution: Array<{ result: string; count: number; pct: number }>; total: number }
  recordings: {
    answered: number
    withRecordingId: number
    withAnyRecording: number
    captureRatePct: number | null
  }
  agents: Array<{
    id: string
    userId: string
    name: string
    campaignId: string | null
    mode: string | null
    state: string
    lastHeartbeatSeconds: number
  }>
}

function Panel({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4,
      padding: 16, minWidth: 0,
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

/** A dash, never a plausible-looking number. */
const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(digits)}%`

export default function LiveOps() {
  const [data, setData] = useState<OpsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ops-live', { cache: 'no-store' })
      const json = await res.json()
      if (!json?.success) {
        setError(typeof json?.error === 'string' ? json.error : 'Could not load ops data')
        return
      }
      setError(null)
      setData(json as OpsData)
    } catch {
      setError('Could not reach the server')
    }
  }, [])

  useEffect(() => {
    // The first fetch is SCHEDULED rather than called inline. load() awaits a
    // network round trip long before it touches state, but the lint rule that
    // guards against cascading renders cannot see through the callback — and
    // scheduling it makes the first tick take the same path as every
    // subsequent one, which is tidier regardless.
    const tick = () => { void load() }
    const first = setTimeout(tick, 0)
    const id = paused ? null : setInterval(tick, POLL_MS)
    return () => {
      clearTimeout(first)
      if (id) clearInterval(id)
    }
  }, [load, paused])

  if (!data && !error) {
    return (
      <div style={{ padding: 24, fontFamily: FUTURA, color: T.muted, fontSize: 12 }}>
        LOADING…
      </div>
    )
  }

  const c = data?.concurrency
  const usedPct = c && c.budget > 0 && c.inFlightLegs !== null
    ? (c.inFlightLegs / c.budget) * 100
    : 0
  const gaugeColor = usedPct >= 90 ? T.red : usedPct >= 65 ? T.amber : T.green

  // Machine-vs-human is the ratio that exposed the AMD regression. Surfaced
  // as its own number because it is the one worth watching daily.
  const amdMachine = data?.amd.distribution.find(d => d.result === 'machine')?.count ?? 0
  const amdHuman = data?.amd.distribution.find(d => d.result === 'human')?.count ?? 0
  const amdRatio = amdHuman > 0 ? amdMachine / amdHuman : null

  return (
    <div style={{
      padding: 16, fontFamily: FUTURA, color: T.text, background: T.bg,
      height: '100%', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }}>LIVE OPS</div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
          {data ? `UPDATED ${new Date(data.generatedAt).toLocaleTimeString()}` : '—'}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold', padding: '6px 12px',
            background: paused ? T.amber : '#fff', color: paused ? '#fff' : T.muted,
            border: `1px solid ${paused ? T.amber : T.border}`, borderRadius: 3, cursor: 'pointer',
            fontFamily: FUTURA,
          }}
        >
          {paused ? 'PAUSED' : 'LIVE · 5s'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#f8e8e8', border: `1px solid ${T.red}`,
          color: T.red, borderRadius: 4, fontSize: 12, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12,
        }}>
          {/* ── CONCURRENCY ─────────────────────────────────────────────── */}
          <Panel
            title="CARRIER CONCURRENCY"
            note="Live legs on the Telnyx connection, straight from the carrier. A user dial uses two — agent leg plus lead leg."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 'bold', color: gaugeColor, lineHeight: 1 }}>
                {c!.inFlightLegs === null ? '—' : c!.inFlightLegs}
              </span>
              <span style={{ fontSize: 15, color: T.muted }}>/ {c!.budget} legs</span>
            </div>
            <div style={{
              height: 8, background: T.surface, borderRadius: 4, marginTop: 10, overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, usedPct)}%`, height: '100%', background: gaugeColor,
                transition: 'width .4s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.65 }}>
              {c!.authoritative
                ? 'Reported by Telnyx. Nothing in DialerSeat blocks a dial at this number — the carrier enforces its own ceiling.'
                : 'Carrier unreachable, so no live figure. The gauge shows a dash rather than a guess.'}
            </div>
          </Panel>

          {/* ── IN FLIGHT ───────────────────────────────────────────────── */}
          <Panel
            title={`IN FLIGHT — ${data.inFlightCount}`}
            note="Calls the system believes are live. Anything old here is a stuck call or a failed abort."
          >
            {data.inFlight.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>Nothing dialing.</div>
            ) : (
              <div style={{ maxHeight: 190, overflow: 'auto' }}>
                {data.inFlight.slice(0, 30).map(f => (
                  <div key={f.id} style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '5px 0', borderBottom: `1px solid ${T.surface}`, fontSize: 11.5,
                  }}>
                    <span style={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}>
                      {f.phone || '—'}
                    </span>
                    <span style={{ color: T.muted, fontSize: 10 }}>{f.source}</span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 10,
                      // Past a couple of minutes a live call is more likely
                      // stuck than talking.
                      color: f.ageSeconds > 150 ? T.red : T.muted,
                      minWidth: 42, textAlign: 'right',
                    }}>
                      {f.ageSeconds}s
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, padding: '2px 5px',
                      borderRadius: 2,
                      background: f.answered ? '#dcfce7' : T.surface,
                      color: f.answered ? '#166534' : T.muted,
                    }}>
                      {f.answered ? 'UP' : 'RING'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── SOURCE MIX ──────────────────────────────────────────────── */}
          <Panel
            title="DIAL SOURCE — 24H"
            note="If a mode you expect to be running shows zero dials, it is not running."
          >
            {data.sourceMix.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>No dials in the last 24 hours.</div>
            ) : (
              data.sourceMix.map(s => (
                <div key={s.source} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '5px 0', borderBottom: `1px solid ${T.surface}`, fontSize: 12,
                }}>
                  <span style={{ fontWeight: 'bold' }}>{s.source}</span>
                  <span style={{ color: T.muted, fontFamily: 'monospace' }}>
                    {s.dials.toLocaleString()} dials · {pct(s.connectRate)} connect
                  </span>
                </div>
              ))
            )}
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>
              {data.dialsLast24h.toLocaleString()} dials total. Connect rate shown only above 20 dials.
            </div>
          </Panel>

          {/* ── AMD ─────────────────────────────────────────────────────── */}
          <Panel
            title="AMD OUTCOMES — 7D"
            note="A machine-to-human ratio far above the real world means the detector is hanging up on people."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{
                fontSize: 26, fontWeight: 'bold', lineHeight: 1,
                // 4:1 is what the broken detector produced. Anything near it
                // deserves a second look rather than a silent pass.
                color: amdRatio !== null && amdRatio >= 3 ? T.red : T.text,
              }}>
                {amdRatio === null ? '—' : `${amdRatio.toFixed(1)}:1`}
              </span>
              <span style={{ fontSize: 12, color: T.muted }}>machine : human</span>
            </div>
            {data.amd.distribution.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>No calls in the window.</div>
            ) : (
              data.amd.distribution.map(d => (
                <div key={d.result} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '4px 0', fontSize: 12,
                }}>
                  <span>{d.result}</span>
                  <span style={{ color: T.muted, fontFamily: 'monospace' }}>
                    {d.count.toLocaleString()} · {d.pct.toFixed(0)}%
                  </span>
                </div>
              ))
            )}
          </Panel>

          {/* ── RECORDINGS ──────────────────────────────────────────────── */}
          <Panel
            title="RECORDING CAPTURE — 7D"
            note="Share of answered calls that stored a playable recording id. This sat near zero while every recording played 0:00."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 30, fontWeight: 'bold', lineHeight: 1,
                color: data.recordings.captureRatePct === null ? T.muted
                  : data.recordings.captureRatePct < 50 ? T.red
                  : data.recordings.captureRatePct < 90 ? T.amber : T.green,
              }}>
                {pct(data.recordings.captureRatePct, 0)}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.7 }}>
              {data.recordings.withRecordingId.toLocaleString()} of{' '}
              {data.recordings.answered.toLocaleString()} answered calls have a recording id.<br />
              <span style={{ fontSize: 10.5 }}>
                Recording is per-campaign, so less than 100% is expected — a sudden drop is not.
              </span>
            </div>
          </Panel>

          {/* ── AGENTS ──────────────────────────────────────────────────── */}
          <Panel title={`AGENTS ONLINE — ${data.agents.length}`} note="Heartbeat within the last 60 seconds.">
            {data.agents.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>Nobody is dialing.</div>
            ) : (
              <div style={{ maxHeight: 190, overflow: 'auto' }}>
                {data.agents.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '5px 0', borderBottom: `1px solid ${T.surface}`, fontSize: 11.5,
                  }}>
                    <span
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={a.userId}
                    >
                      {a.name || a.userId}
                    </span>
                    <span style={{ color: T.muted, fontSize: 10 }}>{a.mode || '—'}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, padding: '2px 5px',
                      borderRadius: 2,
                      background: a.state === 'available' ? '#dcfce7' : T.surface,
                      color: a.state === 'available' ? '#166534' : T.muted,
                    }}>
                      {a.state?.toUpperCase() || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
