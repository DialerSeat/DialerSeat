'use client'

import { useEffect, useState, useCallback } from 'react'

const PANEL = 'var(--teams-panel, #232428)'
const HAIRLINE = 'var(--teams-border, #1a1b1e)'
const TEXT = 'var(--teams-text, #f2f3f5)'
const MUTED = 'var(--teams-muted, #949ba4)'
const DIM = 'var(--teams-muted, #80848e)'
const GREEN = '#4ade80'
const AMBER = '#fbbf24'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

function dur(seconds: number): string {
  if (!seconds) return ', '
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function FloorView({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState('week')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const r = await fetch(`/api/teams/floor?range=${range}`).then(x => x.json())
      if (r.success) setData(r)
    } catch {
      // A failed poll leaves the last good picture up. Blanking a live floor
      // view because one request blipped is worse than showing data that is
      // five seconds stale.
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  // Live means live. A floor view that needs refreshing is a screenshot.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load(true)
    }, 5000)
    return () => clearInterval(id)
  }, [load])

  const live = data?.live || []
  const usage = data?.usage || []
  const total = data?.usageTotal ?? usage.length

  // The threshold that makes this actionable rather than just a table. Below
  // this many calls in the range, a seat is being paid for and not used.
  const QUIET_THRESHOLD = range === 'today' ? 5 : range === 'week' ? 25 : 100
  const quiet = usage.filter((u: any) => !u.suspended && u.calls < QUIET_THRESHOLD)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: `1px solid ${HAIRLINE}`,
            color: MUTED, borderRadius: 3, padding: '6px 12px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >← Back</button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, flex: 1 }}>The Floor</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                background: range === r.key ? '#2563eb' : 'transparent',
                border: `1px solid ${range === r.key ? '#2563eb' : HAIRLINE}`,
                color: range === r.key ? '#fff' : MUTED,
                borderRadius: 3, padding: '6px 12px', fontSize: 11.5,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* ── LIVE NOW ────────────────────────────────────────────────────────
          Deliberately first and deliberately small when empty. A manager opens
          this during a shift to answer one question — is my floor working —
          and burying that under a table of weekly totals answers a question
          they did not ask. */}
      <div style={{
        fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: 10,
      }}>
        Live now {live.length > 0 && <span style={{ color: GREEN }}>· {live.length}</span>}
      </div>

      {loading && !data ? (
        <div style={{ fontSize: 13, color: DIM }}>Loading…</div>
      ) : live.length === 0 ? (
        <div style={{ fontSize: 13, color: DIM, lineHeight: 1.7 }}>
          Nobody is dialing right now. Agents appear here within seconds of going
          available.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {live.map((a: any, i: number) => (
            <div key={a.userId || i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: PANEL, border: `1px solid ${a.onCall ? GREEN : HAIRLINE}`,
              borderRadius: 4, padding: '12px 14px',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: a.onCall ? GREEN : a.state === 'paused' ? AMBER : '#4a9eff',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                  {a.campaign || 'No campaign'}
                  {a.teamName ? ` · ${a.teamName}` : ''}
                  {a.mode ? ` · ${a.mode}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, color: a.onCall ? GREEN : MUTED,
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                {a.onCall ? 'On call' : (a.state || 'ready')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── SEAT USAGE ──────────────────────────────────────────────────────
          Shown to the owner even though it costs us money. A vendor who works
          out on their own that they paid for eight idle seats trusts the next
          invoice less than one where we pointed it out first. */}
      <div style={{
        fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, margin: '30px 0 6px',
      }}>Seat usage</div>
      <div style={{ fontSize: 12, color: DIM, marginBottom: 10, lineHeight: 1.7 }}>
        {/* Says which slice this is. A capped list presented as the whole roster
            is the same lie as a truncated one — an owner counting eight idle
            seats needs to know whether that is eight in total or eight in the
            first page. */}
        {quiet.length > 0 ? (
          <>
            <strong style={{ color: AMBER }}>{quiet.length}</strong> of the{' '}
            {usage.length} quietest {usage.length === 1 ? 'seat' : 'seats'} made fewer
            than {QUIET_THRESHOLD} calls this {range === 'today' ? 'day' : range}. You are
            paying for those. Pausing a seat stops the billing and is reversible.
            {total > usage.length && (
              <span style={{ display: 'block', marginTop: 3 }}>
                Showing the {usage.length} quietest of {total.toLocaleString()} seats.
              </span>
            )}
          </>
        ) : (
          <>Every seat is being used.</>
        )}
      </div>

      {usage.length === 0 ? (
        <div style={{ fontSize: 13, color: DIM }}>No seats yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {usage.map((u: any) => {
            const isQuiet = !u.suspended && u.calls < QUIET_THRESHOLD
            return (
              <div key={u.memberId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: PANEL,
                border: `1px solid ${isQuiet ? AMBER : HAIRLINE}`,
                borderRadius: 4, padding: '11px 14px',
                opacity: u.suspended ? 0.5 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                    {u.teamName}
                    {u.suspended ? ' · seat paused' : ` · last call ${ago(u.lastCallAt)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.5, color: DIM }}>
                  <div style={{ color: isQuiet ? AMBER : TEXT, fontSize: 13 }}>
                    {u.calls.toLocaleString()} {u.calls === 1 ? 'call' : 'calls'}
                  </div>
                  <div>{dur(u.talkSeconds)} talking</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
