'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AgentCard from './AgentCard'
import type { LiveState, TeamMemberRow } from '@/app/api/teams/[id]/members/route'

// =============================================================================
// TeamFloor — the control room
// =============================================================================
// Not a dashboard. A dashboard is centered, max-width, and read once a week to
// answer "how did we do". This answers "who is on the floor right now and is it
// going well", continuously — so it is full-bleed, dense, and it moves.
//
// Three grid regions at viewport height, no outer padding, no centered column,
// no page card. The inspector is a REAL grid column rather than an overlay, so
// selecting an agent reflows the floor instead of covering it.
// =============================================================================

const REFRESH_MS = 5000

const STATE_COLOR: Record<LiveState, string> = {
  on_call: '#1a6a1a',
  dialing: '#8a6a1a',
  wrapping: '#2a4a8a',
  ready: '#1a6a1a',
  offline: 'var(--brand-muted-text, #5a5e6a)',
}

function mmss(total: number) {
  const m = Math.floor(total / 60)
  return `${m}:${String(total % 60).padStart(2, '0')}`
}

export default function TeamFloor({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`)
      const data = await res.json()
      if (data.success) {
        setMembers(data.members || [])
        setError(null)
      } else {
        setError(data.error || 'Could not load the floor.')
      }
    } catch {
      setError('Could not load the floor.')
    } finally {
      setLoaded(true)
    }
  }, [teamId])

  // Polled, not socketed. The dialer heartbeat is already 5s, so anything
  // faster would show state the server itself does not have yet.
  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const selected = useMemo(
    () => members.find(m => m.memberId === selectedId) ?? null,
    [members, selectedId]
  )

  const online = members.filter(m => m.live !== 'offline')
  const onCall = members.filter(m => m.live === 'on_call').length
  const callsToday = members.reduce((s, m) => s + m.callsToday, 0)
  const answeredToday = members.reduce((s, m) => s + m.answeredToday, 0)
  const talkToday = members.reduce((s, m) => s + m.talkSecondsToday, 0)

  return (
    <>
      <style>{`
        /* FULL BLEED. No max-width, no centered column, no page card, a wide
           monitor should show more agents, not more margin. */
        .tf-root {
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-rows: 56px 1fr;
          grid-template-columns: 1fr auto;
          grid-template-areas: "bar bar" "floor inspector";
          background: var(--brand-page-bg);
          color: var(--brand-on-page-bg);
          overflow: hidden;
        }
        .tf-bar {
          grid-area: bar;
          display: flex; align-items: center; gap: 16px;
          padding: 0 18px;
          border-bottom: 1px solid var(--brand-card-border);
          background: var(--brand-header-bg);
          min-width: 0;
        }
        .tf-floor {
          grid-area: floor;
          overflow-y: auto;
          padding: 18px;
          min-width: 0;
        }
        .tf-inspector {
          grid-area: inspector;
          width: 420px;
          border-left: 1px solid var(--brand-card-border);
          background: var(--brand-card-surface);
          overflow-y: auto;
          padding: 18px;
        }
        /* auto-fill, so density follows the viewport rather than a hand-written
           breakpoint list. */
        .tf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        /* Roster rows share the header's column track so cells stay aligned
           even when one wraps. */
        .tf-roster { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.2fr; }
        .tf-row {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
          align-items: center;
          padding: 11px 10px;
          border-top: 1px solid var(--brand-card-border);
          font-size: 12.5px;
          font-variant-numeric: tabular-nums;
          cursor: pointer;
          /* A long roster should not paint what nobody is looking at. */
          content-visibility: auto;
          contain-intrinsic-size: auto 44px;
        }
        .tf-row:hover { background: var(--brand-page-bg); }
        .tf-head {
          display: grid; grid-column: 1 / -1; grid-template-columns: subgrid;
          padding: 0 10px 8px;
          font-size: 9.5px; letter-spacing: 1.4px; font-weight: 700;
          color: var(--brand-muted-text);
        }
        @media (max-width: 900px) {
          .tf-root { grid-template-columns: 1fr; grid-template-areas: "bar" "floor"; }
          .tf-inspector {
            position: fixed; left: 0; right: 0; bottom: 0; top: auto;
            width: auto; max-height: 70vh; z-index: 40;
            border-left: none; border-top: 1px solid var(--brand-card-border);
            border-radius: 14px 14px 0 0;
          }
          .tf-roster { display: none; }
        }
      `}</style>

      <div className="tf-root">
        <div className="tf-bar">
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, flexShrink: 0 }}>
            {teamName.toUpperCase()}
          </span>

          {/* AMBIENT SIGNAL — one bar per agent across the full width, coloured
              by state. Reads the room without focusing on anything. */}
          <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, height: 18, alignItems: 'center' }}>
            {members.map(m => (
              <span
                key={m.memberId}
                title={`${m.name}, ${m.live}`}
                style={{
                  flex: '1 1 0', minWidth: 2, maxWidth: 14, height: 14, borderRadius: 2,
                  background: m.live === 'offline'
                    ? 'var(--brand-card-border)'
                    : STATE_COLOR[m.live],
                  opacity: m.live === 'offline' ? 0.5 : 1,
                }}
              />
            ))}
          </div>

          <span style={{ fontSize: 11, color: 'var(--brand-muted-text)', flexShrink: 0 }}>
            <strong style={{ color: 'var(--brand-on-page-bg)', fontSize: 14 }}>{online.length}</strong>
            {' '}online · {onCall} on call
          </span>
        </div>

        <div className="tf-floor">
          {error && (
            <div style={{
              border: '1px solid #fca5a5', background: '#fee2e2', color: '#8a1a1a',
              borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 14,
            }}>{error}</div>
          )}

          {/* Four figures, secondary by construction — small muted labels, the
              numbers doing the talking. */}
          <div style={{
            display: 'flex', gap: 28, marginBottom: 18, flexWrap: 'wrap',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Stat label="AGENTS ONLINE" value={String(online.length)} big />
            <Stat label="CALLS TODAY" value={String(callsToday)} />
            <Stat
              label="CONNECT RATE"
              value={callsToday >= 5 ? `${Math.round((answeredToday / callsToday) * 100)}%` : ', '}
            />
            <Stat label="TALK TIME" value={mmss(talkToday)} />
          </div>

          {!loaded ? (
            <div style={{ fontSize: 12, color: 'var(--brand-muted-text)' }}>LOADING FLOOR…</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--brand-muted-text)' }}>
              No members yet. Share a join code to fill the floor.
            </div>
          ) : (
            <>
              <div className="tf-grid">
                {members.map(m => (
                  <AgentCard
                    key={m.memberId}
                    member={m}
                    selected={m.memberId === selectedId}
                    onSelect={() => setSelectedId(id => (id === m.memberId ? null : m.memberId))}
                  />
                ))}
              </div>

              {/* Same people, second view. The cards are the live read; this is
                  the administrative one. Both always visible — no tabs, because
                  a tab hides half the answer. */}
              <div style={{
                fontSize: 9.5, letterSpacing: 1.6, fontWeight: 700,
                color: 'var(--brand-muted-text)', margin: '26px 0 10px',
              }}>ROSTER</div>

              <div className="tf-roster">
                <div className="tf-head">
                  <span>AGENT</span><span>STATUS</span><span>CALLS</span>
                  <span>CONNECT</span><span>TALK</span><span>SEAT</span>
                </div>
                {members.map(m => (
                  <div
                    key={m.memberId}
                    className="tf-row"
                    onClick={() => setSelectedId(id => (id === m.memberId ? null : m.memberId))}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    <Pill live={m.live} />
                    <span>{m.callsToday}</span>
                    <span>{m.connectRatePct === null ? ', ' : `${m.connectRatePct}%`}</span>
                    <span>{mmss(m.talkSecondsToday)}</span>
                    <span style={{ color: 'var(--brand-muted-text)', fontSize: 11 }}>
                      {m.seatSuspended ? 'PAUSED' : m.status === 'pending' ? 'PENDING' : 'ACTIVE'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {selected && (
          <div className="tf-inspector">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>
                {selected.name.toUpperCase()}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--brand-card-border)',
                  borderRadius: 3, padding: '4px 10px', fontSize: 9.5, letterSpacing: 1.5,
                  fontWeight: 700, cursor: 'pointer', color: 'var(--brand-muted-text)',
                }}
              >CLOSE</button>
            </div>

            {/* The same card component, rendered narrow. Container queries do
                the adapting — no size prop anywhere. */}
            <AgentCard member={selected} selected onSelect={() => {}} />

            <dl style={{ marginTop: 18, fontSize: 12, display: 'grid', gap: 10 }}>
              <Row k="Email" v={selected.email ?? ', '} />
              <Row k="Live state" v={selected.live.replace('_', ' ')} />
              <Row k="Dialer mode" v={selected.dialerMode ?? ', '} />
              <Row k="Calls today" v={String(selected.callsToday)} />
              <Row k="Answered" v={String(selected.answeredToday)} />
              <Row k="Talk time" v={mmss(selected.talkSecondsToday)} />
              <Row k="Seat" v={selected.seatSuspended ? 'Paused' : selected.status} />
              <Row
                k="Billing"
                v={selected.seatPriceCents != null
                  ? `$${(selected.seatPriceCents / 100).toFixed(2)}/wk`
                  : selected.billingOverride ?? ', '}
              />
            </dl>
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5, letterSpacing: 1.4, fontWeight: 700,
        color: 'var(--brand-muted-text)', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontSize: big ? 34 : 20, fontWeight: 600, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function Pill({ live }: { live: LiveState }) {
  const c = STATE_COLOR[live]
  return (
    <span style={{
      justifySelf: 'start',
      fontSize: 9, letterSpacing: 1.1, fontWeight: 700, color: c,
      // 8% tint rather than a filled block — status should be legible, not loud.
      background: live === 'offline' ? 'transparent' : `${c}14`,
      border: `1px solid ${live === 'offline' ? 'var(--brand-card-border)' : `${c}44`}`,
      borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{live.replace('_', ' ').toUpperCase()}</span>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ color: 'var(--brand-muted-text)' }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 500, textAlign: 'right' }}>{v}</dd>
    </div>
  )
}
