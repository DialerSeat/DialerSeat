'use client'

import type { LiveState, TeamMemberRow } from '@/app/api/teams/[id]/members/route'

// =============================================================================
// AgentCard — one person on the floor
// =============================================================================
// ONE component, two sizes, no size prop. The card is a container-query root,
// so the same element renders compact inside the 420px inspector and full on
// the wide floor. Passing a `size` down would mean every parent has to know
// how wide it is, which is exactly the knowledge CSS already has.
//
// Motion is reserved for live state and used nowhere else on this surface, so
// when something moves it always means "this person is on a call right now".
// =============================================================================

const STATE_LABEL: Record<LiveState, string> = {
  on_call: 'ON CALL',
  dialing: 'DIALING',
  wrapping: 'WRAPPING',
  ready: 'READY',
  offline: 'OFFLINE',
}

// Semantic only. Green is "talking to someone", amber "available", grey
// "gone". No decorative colour anywhere on this surface, so colour always
// carries meaning.
const STATE_COLOR: Record<LiveState, string> = {
  on_call: '#1a6a1a',
  dialing: '#8a6a1a',
  wrapping: '#2a4a8a',
  ready: '#1a6a1a',
  offline: 'var(--brand-muted-text, #5a5e6a)',
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Last 20 calls as a polyline. Deliberately hand-rolled — this is a squiggle,
 * and a charting library would be tens of kilobytes to draw one.
 *
 * Answered calls peak, unanswered sit near the floor, so the shape reads as
 * "how often is this person getting through" without needing an axis.
 */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) {
    return <div style={{ height: 24 }} aria-hidden />
  }
  const w = 100
  const h = 24
  const step = w / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(p ? 3 : h - 3).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 24, display: 'block' }}
      role="img"
      aria-label={`Last ${points.length} calls, ${points.filter(Boolean).length} answered`}
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5}
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export default function AgentCard({
  member,
  selected,
  onSelect,
}: {
  member: TeamMemberRow
  selected: boolean
  onSelect: () => void
}) {
  const color = STATE_COLOR[member.live]
  const isLive = member.live === 'on_call'

  return (
    <>
      <style>{`
        /* The card is its own container. Everything below sizes against the
           CARD, not the viewport, which is what lets one component serve the
           wide floor and the narrow inspector with no prop telling it which. */
        .agent-card {
          container-type: inline-size;
          container-name: agentcard;
        }
        /* Motion means exactly one thing on this surface: on a call. */
        @keyframes agent-pulse {
          0%   { box-shadow: 0 0 0 0 var(--pulse); }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .agent-dot-live { animation: agent-pulse 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .agent-dot-live { animation: none; }
        }
        /* Compact form, driven by the card's own width. In the inspector the
           figures stack tighter and the sparkline goes; on the floor they sit
           in a row. */
        @container agentcard (max-width: 230px) {
          .agent-figs { grid-template-columns: 1fr 1fr !important; }
          .agent-spark { display: none; }
        }
      `}</style>

      <button
        className="agent-card"
        onClick={onSelect}
        style={{
          textAlign: 'left',
          background: 'var(--brand-card-surface)',
          border: `1px solid ${selected ? color : 'var(--brand-card-border)'}`,
          boxShadow: selected ? `inset 0 0 0 1px ${color}` : 'none',
          borderRadius: 10,
          padding: 14,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          font: 'inherit',
          color: 'var(--brand-on-page-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span
            className={isLive ? 'agent-dot-live' : undefined}
            style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
              background: member.live === 'offline' ? 'transparent' : color,
              border: `1.5px solid ${color}`,
              // Consumed by the keyframes above so the ring matches the state.
              ['--pulse' as string]: `${color}66`,
            }}
          />
          <span style={{
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1,
          }}>{member.name}</span>
          <span style={{
            fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color,
            flexShrink: 0,
          }}>{STATE_LABEL[member.live]}</span>
        </div>

        <div className="agent-spark">
          <Sparkline points={member.spark} color={color} />
        </div>

        {/* tabular-nums so figures line up column to column across every card
            in the grid. It is most of why a dense floor reads as engineered
            rather than typed. */}
        <div
          className="agent-figs"
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Fig label="CALLS" value={String(member.callsToday)} />
          <Fig
            label="CONNECT"
            value={member.connectRatePct === null ? ', ' : `${member.connectRatePct}%`}
          />
          <Fig label="TALK" value={mmss(member.talkSecondsToday)} />
        </div>
      </button>
    </>
  )
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 9, letterSpacing: 1, color: 'var(--brand-muted-text)',
        marginBottom: 2, whiteSpace: 'nowrap',
      }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
    </div>
  )
}
