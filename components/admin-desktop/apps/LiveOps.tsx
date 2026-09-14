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

/** Shared style for the small actions on the live-legs panel. */
const miniBtn: React.CSSProperties = {
  background: '#fff', border: `1px solid ${'#c4c8d0'}`, borderRadius: 3,
  fontSize: 9, letterSpacing: 1, fontWeight: 'bold', padding: '4px 8px',
  cursor: 'pointer', color: '#1a1c24',
}

interface LiveLegsPayload {
  authoritative: boolean
  error: string | null
  legs: Array<{
    callControlId: string
    userId: string | null
    startedAt: string | null
    ageSeconds: number | null
    phone: string | null
    leg: 'lead' | 'agent' | null
    orphaned: boolean
  }>
}

// ── WHEN A BALANCE IS WORTH A COLOUR ───────────────────────────────────────
// Not percentages: there is no denominator here, a prepaid account has no
// "full". These are absolutes chosen against what a dialing day costs. A busy
// floor runs a few dollars a day in carrier spend, so $25 is roughly a week of
// warning and $10 is short enough to act on today.
const BALANCE_LOW = 25
const BALANCE_CRITICAL = 10

/** Money, or a dash. Currency comes from the carrier, never assumed to be USD. */
const money = (v: number | null, currency: string | null) => {
  if (v === null) return '-'
  const n = v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'USD' || currency === null ? `$${n}` : `${n} ${currency}`
}

interface OpsData {
  generatedAt: string
  concurrency: {
    inFlightLegs: number | null
    budget: number
    authoritative: boolean
  }
  balance: {
    availableCredit: number | null
    balance: number | null
    pending: number | null
    creditLimit: number | null
    currency: string | null
    authoritative: boolean
    error: string | null
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
    device: string | null
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
  v === null || v === undefined || Number.isNaN(v) ? '-' : `${v.toFixed(digits)}%`

export default function LiveOps() {
  // ── RECORDING CLEANUP ──────────────────────────────────────────────────
  // Deleting audio needs the Telnyx key, which only exists server-side, so
  // this is a trigger rather than the work itself. Preview is not optional:
  // the count is answered before anything is destroyed, every time.
  const [people, setPeople] = useState<Array<{
    name: string; userIds: string[]; recordings: number; under30: number; seconds: number
  }> | null>(null)
  const [who, setWho] = useState('')
  const [rule, setRule] = useState<'under30' | 'all'>('under30')
  const [cleanBusy, setCleanBusy] = useState(false)

  // The preview REMEMBERS WHAT IT WAS FOR. Arming was a separate flag reset by
  // an effect watching the dropdowns, which is a race dressed as a guard: the
  // flag and the selection were two facts that had to be kept in agreement.
  // Carrying the choice inside the result makes disagreement unrepresentable
  // — change either dropdown and this simply stops matching, so the DELETE
  // button is gone on the same render rather than one effect later.
  const [result, setResult] = useState<
    { who: string; rule: string; text: string; count: number; done: boolean } | null
  >(null)
  const current = !!result && result.who === who && result.rule === rule
  const armed = current && result.count > 0 && !result.done
  const cleanMsg = current ? result!.text : ''

  const loadPeople = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/recordings/bulk-delete').then(x => x.json())
      if (r?.success) setPeople(r.people || [])
    } catch { /* the panel just stays empty */ }
  }, [])

  useEffect(() => {
    // Scheduled rather than awaited inline, so the first load takes the same
    // path as any later one and the rule about setState in an effect has
    // nothing to complain about.
    const id = setTimeout(() => { void loadPeople() }, 0)
    return () => clearTimeout(id)
  }, [loadPeople])

  const runCleanup = useCallback(async (commit: boolean) => {
    const person = (people || []).find(p => p.name === who)
    if (!person) {
      setResult({ who, rule, text: 'Pick somebody first.', count: 0, done: true })
      return
    }
    setCleanBusy(true)
    try {
      const res = await fetch('/api/admin/recordings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: person.userIds,
          ...(rule === 'all' ? { all: true } : { maxRecordingSeconds: 30 }),
          commit,
        }),
      }).then(x => x.json())

      const stamp = { who, rule }
      if (!res?.success) {
        setResult({ ...stamp, text: res?.error || 'Failed.', count: 0, done: true })
      } else if (res.preview) {
        setResult({
          ...stamp,
          text: `${res.wouldDelete} recordings (${res.audioSeconds}s of audio) across `
            + `${res.accounts} account${res.accounts === 1 ? '' : 's'}. `
            + `${res.leaves} kept. Nothing deleted yet.`,
          count: res.wouldDelete, done: false,
        })
      } else {
        setResult({
          ...stamp,
          text: `Deleted ${res.deleted}.`
            + (res.providerErrors ? ` ${res.providerErrors} were already gone at Telnyx.` : '')
            + (res.providerSkipped ? ' WARNING: no carrier key configured, audio was only unlinked here.' : ''),
          count: 0, done: true,
        })
        void loadPeople()
      }
    } catch {
      setResult({ who, rule, text: 'Request failed.', count: 0, done: true })
    } finally {
      setCleanBusy(false)
    }
  }, [people, who, rule, loadPeople])

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

  // ── LIVE LEGS ─────────────────────────────────────────────────────────
  // Not on the 5s poll. Every refresh is a Telnyx API call, and this list is
  // consulted when somebody suspects a stuck leg rather than continuously.
  const [legs, setLegs] = useState<LiveLegsPayload | null>(null)
  const [legsBusy, setLegsBusy] = useState(false)
  const [legsMsg, setLegsMsg] = useState<string | null>(null)

  const loadLegs = useCallback(async () => {
    setLegsBusy(true)
    try {
      const r = await fetch('/api/admin/calls/live-legs', { cache: 'no-store' })
      const j = await r.json()
      if (j?.success) {
        setLegs(j)
        setLegsMsg(null)
      } else {
        setLegsMsg(j?.error || 'Could not list legs.')
      }
    } catch {
      setLegsMsg('Could not reach the server to list legs.')
    } finally {
      setLegsBusy(false)
    }
  }, [])

  // Both kill paths confirm first. The user asked for this button, so the
  // confirm is not second-guessing them — it is that a misclick here hangs up
  // on somebody mid-sentence, and the list is sorted oldest-first so the rows
  // most likely to be stuck sit exactly where a stray click lands.
  const killLeg = useCallback(async (id: string) => {
    if (!window.confirm(
      `End this leg?\n\n${id}\n\nIf somebody is talking on it, the call drops.`
    )) return
    setLegsBusy(true)
    try {
      const r = await fetch('/api/admin/calls/live-legs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callControlIds: [id] }),
      })
      const j = await r.json()
      setLegsMsg(j?.success ? `Ended ${j.ended} of ${j.requested}.` : (j?.error || 'Failed.'))
    } catch {
      setLegsMsg('Failed to reach the server.')
    } finally {
      setLegsBusy(false)
      void loadLegs()
    }
  }, [loadLegs])

  const killOlderThan = useCallback(async (seconds: number) => {
    if (!window.confirm(
      `End every leg older than ${seconds / 60} minutes?\n\n`
      + 'Legs with no matching call row are skipped, because their age is '
      + 'unknown and they could be seconds old. End those individually.'
    )) return
    setLegsBusy(true)
    try {
      const r = await fetch('/api/admin/calls/live-legs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanSeconds: seconds }),
      })
      const j = await r.json()
      setLegsMsg(j?.success
        ? `Ended ${j.ended} of ${j.requested}.`
          + (j.skippedUnknownAge ? ` ${j.skippedUnknownAge} skipped for unknown age.` : '')
        : (j?.error || 'Failed.'))
    } catch {
      setLegsMsg('Failed to reach the server.')
    } finally {
      setLegsBusy(false)
      void loadLegs()
    }
  }, [loadLegs])

  if (!data && !error) {
    return (
      <div style={{ padding: 24, fontFamily: FUTURA, color: T.muted, fontSize: 12 }}>
        LOADING…
      </div>
    )
  }

  const c = data?.concurrency
  const bal = data?.balance ?? {
    availableCredit: null, balance: null, pending: null, creditLimit: null,
    currency: null, authoritative: false, error: null,
  }
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
          {data ? `UPDATED ${new Date(data.generatedAt).toLocaleTimeString()}` : '-'}
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
            note="Live legs on the Telnyx connection, straight from the carrier. A user dial uses two, agent leg plus lead leg."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 'bold', color: gaugeColor, lineHeight: 1 }}>
                {c!.inFlightLegs === null ? '-' : c!.inFlightLegs}
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
                ? 'Reported by Telnyx. Nothing in DialerSeat blocks a dial at this number, the carrier enforces its own ceiling.'
                : 'Carrier unreachable, so no live figure. The gauge shows a dash rather than a guess.'}
            </div>
          </Panel>

          {/* ── CARRIER BALANCE ─────────────────────────────────────────── */}
          <Panel
            title="TELNYX BALANCE"
            note="Spendable right now, straight from the carrier. Every dial costs whether or not it connects, so this falls on no-answers too."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 34, fontWeight: 'bold', lineHeight: 1,
                color: bal.availableCredit === null ? T.muted
                  : bal.availableCredit < BALANCE_CRITICAL ? T.red
                  : bal.availableCredit < BALANCE_LOW ? T.amber : T.green,
              }}>
                {money(bal.availableCredit, bal.currency)}
              </span>
              <span style={{ fontSize: 15, color: T.muted }}>available</span>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.65 }}>
              {bal.authoritative ? (
                <>
                  Balance {money(bal.balance, bal.currency)}
                  {bal.creditLimit !== null && bal.creditLimit > 0
                    && <> · credit {money(bal.creditLimit, bal.currency)}</>}
                  {bal.pending !== null && bal.pending > 0
                    && <> · {money(bal.pending, bal.currency)} pending</>}
                  {/* Burn is deliberately not shown here. This screen's window
                      is the last few minutes, and a runway figure from that is
                      noise. Unit Economics computes it over seven days. */}
                </>
              ) : (
                <>Carrier unreachable, so no figure. A dash rather than a guess,
                  because a balance panel confidently reading zero is the kind of
                  thing somebody stops a floor over.
                  {bal.error && <> ({bal.error})</>}</>
              )}
            </div>
          </Panel>

          {/* ── IN FLIGHT ───────────────────────────────────────────────── */}
          <Panel
            title={`IN FLIGHT, ${data.inFlightCount}`}
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
                      {f.phone || '-'}
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

          {/* ── LIVE LEGS ON THE CARRIER ────────────────────────────────
              The panel above is what the SYSTEM believes is live. This one is
              what TELNYX says is live, and the difference between them is the
              whole reason this exists. A leg our table has lost track of bills
              exactly the same as one we know about, and it is invisible to any
              view built from our own rows.

              The manual override for when automatic teardown misses one. Three
              things already end a call and all three have failed here at some
              point; this is the button for when they do. */}
          <Panel
            title={`LIVE ON TELNYX${legs ? `, ${legs.legs.length}` : ''}`}
            note="Straight from the carrier. A leg here that IN FLIGHT does not show is one nothing of ours is tracking, and it bills by the minute until it is ended."
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <button onClick={loadLegs} disabled={legsBusy} style={miniBtn}>
                {legsBusy ? 'WORKING…' : 'REFRESH'}
              </button>
              {/* Age-based sweep rather than "end all": the point is legs that
                  are open and INACTIVE, and a button that ends everything would
                  cut off whoever is mid-conversation. */}
              {[120, 300].map(secs => (
                <button key={secs} disabled={legsBusy} style={miniBtn}
                        onClick={() => killOlderThan(secs)}>
                  END OLDER THAN {secs / 60}M
                </button>
              ))}
            </div>

            {legsMsg && (
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>
                {legsMsg}
              </div>
            )}

            {!legs ? (
              <div style={{ fontSize: 12, color: T.muted }}>Press REFRESH to ask the carrier.</div>
            ) : !legs.authoritative ? (
              <div style={{ fontSize: 12, color: T.amber }}>
                Carrier unreachable, so this list is unknown rather than empty.
                {legs.error && <> ({legs.error})</>}
              </div>
            ) : legs.legs.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>Telnyx reports no live legs.</div>
            ) : (
              <div style={{ maxHeight: 190, overflow: 'auto' }}>
                {legs.legs.map(l => (
                  <div key={l.callControlId} style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '5px 0', borderBottom: `1px solid ${T.surface}`, fontSize: 11.5,
                  }}>
                    <span style={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}>
                      {l.phone || l.callControlId.slice(0, 12)}
                    </span>
                    {l.orphaned && (
                      <span style={{
                        fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5,
                        padding: '2px 5px', borderRadius: 2,
                        background: '#fee2e2', color: '#991b1b',
                      }}>UNTRACKED</span>
                    )}
                    {l.leg && <span style={{ color: T.muted, fontSize: 10 }}>{l.leg}</span>}
                    <span style={{
                      fontFamily: 'monospace', fontSize: 10,
                      color: (l.ageSeconds ?? 0) > 150 ? T.red : T.muted,
                      minWidth: 46, textAlign: 'right',
                    }}>
                      {l.ageSeconds === null ? '-' : `${l.ageSeconds}s`}
                    </span>
                    <button style={miniBtn} disabled={legsBusy}
                            onClick={() => killLeg(l.callControlId)}>END</button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── SOURCE MIX ──────────────────────────────────────────────── */}
          <Panel
            title="DIAL SOURCE, 24H"
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
            title="AMD OUTCOMES, 7D"
            note="A machine-to-human ratio far above the real world means the detector is hanging up on people."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{
                fontSize: 26, fontWeight: 'bold', lineHeight: 1,
                // 4:1 is what the broken detector produced. Anything near it
                // deserves a second look rather than a silent pass.
                color: amdRatio !== null && amdRatio >= 3 ? T.red : T.text,
              }}>
                {amdRatio === null ? '-' : `${amdRatio.toFixed(1)}:1`}
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
            title="RECORDING CAPTURE, 7D"
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
                Recording is per-campaign, so less than 100% is expected, a sudden drop is not.
              </span>
            </div>
          </Panel>

          {/* ── AGENTS ──────────────────────────────────────────────────── */}
          <Panel title={`AGENTS ONLINE, ${data.agents.length}`} note="Heartbeat within the last 60 seconds.">
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
                    {/* What they are dialing ON. A mobile agent and a desktop
                        agent produce the same row otherwise, and the device is
                        usually the explanation when one of them sounds bad. */}
                    <span
                      style={{ color: T.muted, fontSize: 10 }}
                      title={a.device ? `Dialing from ${a.device}` : 'Device not recorded for this session'}
                    >
                      {a.device === 'mobile' ? '📱' : a.device === 'tablet' ? '▭' : a.device === 'desktop' ? '🖥' : '-'}
                      {a.device ? ` ${a.device}` : ''}
                    </span>
                    <span style={{ color: T.muted, fontSize: 10 }}>{a.mode || '-'}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, padding: '2px 5px',
                      borderRadius: 2,
                      background: a.state === 'available' ? '#dcfce7' : T.surface,
                      color: a.state === 'available' ? '#166534' : T.muted,
                    }}>
                      {a.state?.toUpperCase() || '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── RECORDING CLEANUP ──────────────────────────────────────────
              Short recordings are the bulk of a dialing floor's storage and
              none of its value: voicemail fragments, instant hangups, the two
              seconds before somebody puts the phone down. Telnyx bills storage
              either way, so clearing them is a cost decision as much as a
              tidiness one. */}
          <Panel
            title="RECORDING CLEANUP"
            note="Deletes at the carrier first, then clears our columns. Clearing only our side leaves the audio stored and still billed, which is why this goes through the server. Preview always runs before anything is destroyed."
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={who} onChange={e => setWho(e.target.value)} style={{
                background: '#fff', border: `1px solid ${T.border}`, borderRadius: 3,
                color: T.text, fontSize: 12, padding: '7px 9px', fontFamily: FUTURA, minWidth: 190,
              }}>
                <option value="">SELECT AGENT…</option>
                {(people || []).map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} — {p.recordings} ({p.under30} under 30s)
                    {p.userIds.length > 1 ? ` · ${p.userIds.length} accounts` : ''}
                  </option>
                ))}
              </select>

              <select value={rule} onChange={e => setRule(e.target.value as 'under30' | 'all')} style={{
                background: '#fff', border: `1px solid ${T.border}`, borderRadius: 3,
                color: T.text, fontSize: 12, padding: '7px 9px', fontFamily: FUTURA,
              }}>
                <option value="under30">Recordings under 30 seconds</option>
                <option value="all">Every recording they have</option>
              </select>

              <button onClick={() => void runCleanup(false)} disabled={cleanBusy || !who} style={{
                background: T.surface, color: T.text, border: `1px solid ${T.border}`,
                borderRadius: 3, fontSize: 11, letterSpacing: 1, padding: '8px 14px',
                cursor: cleanBusy || !who ? 'not-allowed' : 'pointer', fontFamily: FUTURA,
              }}>{cleanBusy ? 'WORKING…' : 'PREVIEW'}</button>

              {/* Only appears once a preview has said what the number is.
                  There is no path from picking a name to destroying audio
                  that does not pass through seeing the count. */}
              {armed && (
                <button onClick={() => void runCleanup(true)} disabled={cleanBusy} style={{
                  background: T.red, color: '#fff', border: 'none', borderRadius: 3,
                  fontSize: 11, letterSpacing: 1, padding: '8px 14px', fontWeight: 'bold',
                  cursor: cleanBusy ? 'not-allowed' : 'pointer', fontFamily: FUTURA,
                }}>{cleanBusy ? 'DELETING…' : 'DELETE FOR REAL'}</button>
              )}
            </div>

            {cleanMsg && (
              <div style={{
                fontSize: 11.5, color: armed ? T.amber : T.muted,
                marginTop: 10, lineHeight: 1.6,
              }}>{cleanMsg}</div>
            )}
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.7 }}>
              Audio cannot be recovered once this runs. Where somebody holds more
              than one account the list says so, and all of them are included —
              a delete scoped to one account of two reports success having missed
              half the recordings.
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
