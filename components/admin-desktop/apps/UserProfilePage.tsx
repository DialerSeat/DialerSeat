'use client'

// =============================================================================
// USER PROFILE — a full page, not a drawer
// =============================================================================
// The drawer this replaces could show four stat cards and nothing else; there
// simply wasn't room for the question an admin actually opens a user to
// answer, which is never "how many calls" on its own. It's "is this person
// getting value, and how do they compare to everyone else."
//
// So this is the user's own dashboard analytics as an admin sees it: the same
// buckets, plus outcome and time composition, plus where they sit against the
// rest of the platform.
//
// EVERY PERCENTILE IS COMPUTED FROM THE USERS ALREADY LOADED — no extra
// request, and no invented denominator. A percentile here means exactly
// "this user is above N% of non-excluded users on this measure," and where
// there aren't enough users to say anything, it renders a dash rather than a
// confident-looking number. Admins excluded from analytics are already
// filtered out upstream, so they don't distort the ranking.
//
// The two "retention" measures are deliberately named for what they actually
// are — tenure and recency — rather than dressed up as a retention score. A
// score would imply a model that doesn't exist behind it.
// =============================================================================

interface BucketStats {
  calls: number
  dialSeconds: number
  connectedCalls: number
  connectedSeconds: number
  skippedCalls: number
  wastedSeconds: number
}

interface UserRow {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  last_seen_at: string | null
  stats: {
    today: BucketStats
    week: BucketStats
    month30: BucketStats
    all: BucketStats
    custom?: BucketStats
  }
}

type DetailRangeKey = 'today' | 'week' | 'month30' | 'all'

const DETAIL_LABEL: Record<DetailRangeKey, string> = {
  today: 'Today', week: 'This Week', month30: 'Last 30 Days', all: 'All Time',
}

const C = {
  bg: '#f6f7fb',
  card: '#ffffff',
  border: '#e6e8ef',
  ink: '#14151a',
  muted: '#7a7d89',
  faint: '#a8aab4',
  accent: '#6d5bf7',
  green: '#17a673',
  amber: '#c98a1a',
  red: '#e0463f',
  slate: '#8f93a3',
}

function fmtDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nameFor(u: UserRow): string {
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return full || u.email?.split('@')[0] || 'Unknown'
}

function initials(u: UserRow): string {
  const parts = nameFor(u).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nameFor(u).slice(0, 2).toUpperCase()
}

function daysBetween(a: number, b: number): number {
  return Math.max(0, Math.floor((a - b) / 86_400_000))
}

/**
 * Days since an ISO timestamp, or null when there isn't one.
 *
 * Module scope so the Date.now() read happens outside the component body —
 * react-hooks/purity forbids it during render.
 */
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return daysBetween(Date.now(), new Date(iso).getTime())
}

/**
 * Percentile of `value` within `all`, as "above N% of users".
 *
 * Returns null below four users — with three data points a percentile is
 * theatre, and a dash is more honest than "you're in the 67th percentile" out
 * of a sample of three.
 */
function percentile(value: number, all: number[]): number | null {
  if (all.length < 4) return null
  const below = all.filter(v => v < value).length
  return Math.round((below / all.length) * 100)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── PIE ─────────────────────────────────────────────────────────────────────
// Hand-rolled SVG rather than a chart library: three slices doesn't justify a
// dependency, and this renders identically with no client-side hydration cost.
interface Slice { label: string; value: number; color: string }

function Pie({ slices, size = 132 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = size / 2
  const inner = r * 0.58

  if (total <= 0) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `2px dashed ${C.border}`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: C.faint, fontSize: 11, textAlign: 'center', padding: 12,
      }}>
        No data
      </div>
    )
  }

  // Geometry is computed in a plain loop BEFORE any JSX exists. Accumulating
  // the running angle inside a .map() that returns elements trips
  // react-hooks/immutability, since the compiler can't prove the closure
  // doesn't outlive the render.
  const segments: Array<{ key: number; d?: string; full?: boolean; color: string }> = []
  let angle = -Math.PI / 2

  const visible = slices.filter(s => s.value > 0)
  for (let i = 0; i < visible.length; i++) {
    const s = visible[i]
    const frac = s.value / total
    const sweep = frac * Math.PI * 2
    const end = angle + sweep

    // A slice covering the whole circle can't be drawn as an arc — start and
    // end points coincide and the path collapses to nothing. Draw two circles.
    if (frac >= 0.9999) {
      segments.push({ key: i, full: true, color: s.color })
      angle = end
      continue
    }

    const x1 = r + (r - 1) * Math.cos(angle)
    const y1 = r + (r - 1) * Math.sin(angle)
    const x2 = r + (r - 1) * Math.cos(end)
    const y2 = r + (r - 1) * Math.sin(end)
    const xi2 = r + inner * Math.cos(end)
    const yi2 = r + inner * Math.sin(end)
    const xi1 = r + inner * Math.cos(angle)
    const yi1 = r + inner * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0

    segments.push({
      key: i,
      color: s.color,
      d: [
        `M ${x1} ${y1}`,
        `A ${r - 1} ${r - 1} 0 ${large} 1 ${x2} ${y2}`,
        `L ${xi2} ${yi2}`,
        `A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1}`,
        'Z',
      ].join(' '),
    })
    angle = end
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Composition chart">
      {segments.map(seg => seg.full ? (
        <g key={seg.key}>
          <circle cx={r} cy={r} r={r - 1} fill={seg.color} />
          <circle cx={r} cy={r} r={inner} fill={C.card} />
        </g>
      ) : (
        <path key={seg.key} d={seg.d} fill={seg.color} />
      ))}
    </svg>
  )
}

function PieBlock({ title, slices }: { title: string; slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: C.muted, textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Pie slices={slices} />
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          {slices.map(s => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0 }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PercentileBar({
  label, pct, caption,
}: { label: string; pct: number | null; caption: string }) {
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: pct === null ? C.faint : C.accent, fontVariantNumeric: 'tabular-nums' }}>
          {pct === null ? '—' : `${ordinal(pct)} pct`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
        <div style={{
          width: `${pct ?? 0}%`, height: '100%', borderRadius: 3,
          background: pct === null ? 'transparent' : C.accent,
          transition: 'width .3s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>{caption}</div>
    </div>
  )
}

export default function UserProfilePage({
  user,
  allUsers,
  onBack,
  customLabel,
}: {
  user: UserRow
  allUsers: UserRow[]
  onBack: () => void
  /** Label for the custom range card, when a range is applied. */
  customLabel?: string | null
}) {
  const all = user.stats.all

  // ── Percentile baselines ────────────────────────────────────────────────
  const callsAll = allUsers.map(u => u.stats.all.calls)
  const connectedAll = allUsers.map(u => u.stats.all.connectedSeconds)
  const recent30 = allUsers.map(u => u.stats.month30.calls)
  const tenureAll = allUsers.map(u => daysSince(u.created_at) ?? 0)

  const tenureDays = daysSince(user.created_at) ?? 0
  const lastSeenDays = daysSince(user.last_seen_at)

  const connectRate = all.calls > 0 ? Math.round((all.connectedCalls / all.calls) * 100) : null
  const avgCall = all.calls > 0 ? all.dialSeconds / all.calls : 0

  const rangeKeys: DetailRangeKey[] = ['today', 'week', 'month30', 'all']

  return (
    <div style={{ padding: '18px 20px 40px', color: C.ink }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 16,
        }}
      >
        ‹ All users
      </button>

      {/* ── IDENTITY ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 16, background: C.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {initials(user)}
        </div>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>{nameFor(user)}</div>
          <div style={{ fontSize: 13, color: C.muted, wordBreak: 'break-all' }}>{user.email}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
          <div>Joined {fmtDate(user.created_at)} · {fmtNum(tenureDays)}d ago</div>
          <div>
            {lastSeenDays === null
              ? 'Never seen'
              : lastSeenDays === 0 ? 'Active today' : `Last seen ${lastSeenDays}d ago`}
          </div>
        </div>
      </div>

      {/* ── HEADLINE NUMBERS ────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10, marginBottom: 20,
      }}>
        <Kpi label="Lifetime calls" value={fmtNum(all.calls)} />
        <Kpi label="Time connected" value={fmtDuration(all.connectedSeconds)} />
        <Kpi label="Connect rate" value={connectRate === null ? '—' : `${connectRate}%`} />
        <Kpi label="Avg call length" value={avgCall > 0 ? fmtDuration(avgCall) : '—'} />
      </div>

      {/* ── COMPOSITION ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        <PieBlock
          title="Call outcomes (lifetime)"
          slices={[
            { label: 'Connected', value: all.connectedCalls, color: C.green },
            { label: 'Skipped / no answer', value: all.skippedCalls, color: C.amber },
            {
              label: 'Other',
              // Whatever is left after the two known categories. Clamped at 0
              // because the two counters come from different predicates and
              // could in principle overlap.
              value: Math.max(0, all.calls - all.connectedCalls - all.skippedCalls),
              color: C.slate,
            },
          ]}
        />
        <PieBlock
          title="Where the time went"
          slices={[
            { label: 'Talking', value: all.connectedSeconds, color: C.green },
            {
              label: 'Dialing / ringing',
              value: Math.max(0, all.dialSeconds - all.connectedSeconds),
              color: C.accent,
            },
            { label: 'Wasted (skipped)', value: all.wastedSeconds, color: C.red },
          ]}
        />
      </div>

      {/* ── PERCENTILES ─────────────────────────────────────────────────── */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
          Compared to {fmtNum(allUsers.length)} other user{allUsers.length === 1 ? '' : 's'}
        </div>
        <PercentileBar
          label="Usage — lifetime calls"
          pct={percentile(all.calls, callsAll)}
          caption={`${fmtNum(all.calls)} calls placed`}
        />
        <PercentileBar
          label="Usage — recent activity"
          pct={percentile(user.stats.month30.calls, recent30)}
          caption={`${fmtNum(user.stats.month30.calls)} calls in the last 30 days`}
        />
        <PercentileBar
          label="Engagement — time connected"
          pct={percentile(all.connectedSeconds, connectedAll)}
          caption={`${fmtDuration(all.connectedSeconds)} of live conversation`}
        />
        <PercentileBar
          label="Tenure — how long they've stayed"
          pct={percentile(tenureDays, tenureAll)}
          caption={`${fmtNum(tenureDays)} days since signup`}
        />
        <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Percentile means &ldquo;above this share of users&rdquo; on that measure. Admins and
          accounts excluded from analytics are not counted. Shown as a dash below four users,
          where a percentile would not mean anything.
        </div>
      </div>

      {/* ── PER-RANGE BREAKDOWN ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10,
      }}>
        {user.stats.custom && customLabel && (
          <RangeCard label={customLabel} b={user.stats.custom} highlight />
        )}
        {rangeKeys.map(dr => (
          <RangeCard key={dr} label={DETAIL_LABEL[dr]} b={user.stats[dr]} />
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: C.muted, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function RangeCard({ label, b, highlight }: { label: string; b: BucketStats; highlight?: boolean }) {
  const avg = b.calls > 0 ? b.dialSeconds / b.calls : 0
  const rows: [string, string][] = [
    ['Numbers dialed', fmtNum(b.calls)],
    ['Time dialed', fmtDuration(b.dialSeconds)],
    ['Time connected', fmtDuration(b.connectedSeconds)],
    ['Connected calls', fmtNum(b.connectedCalls)],
    ['Avg call length', avg > 0 ? fmtDuration(avg) : '—'],
    ['Skipped / no answer', `${fmtNum(b.skippedCalls)}${b.wastedSeconds > 0 ? ` (${fmtDuration(b.wastedSeconds)})` : ''}`],
  ]
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${highlight ? C.accent : C.border}`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: highlight ? C.accent : C.muted, textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
          <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
