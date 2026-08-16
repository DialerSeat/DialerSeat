'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamsSidebar, {
  type SidebarTeam,
  type TeamsScope,
} from '@/components/teams/TeamsSidebar'

// =============================================================================
// TEAMS — OVERVIEW + SIDEBAR
// =============================================================================
// This replaces TeamsManager (1,452 lines) and TeamOverview (320) as the Teams
// page. Both components still exist and are still imported by other surfaces;
// nothing was deleted, so anything still depending on them keeps working.
//
// TWO SURFACES, TWO TREATMENTS, ON PURPOSE. The sidebar is dark because it is
// navigation you scan constantly and should recede; the overview is light
// because it is data you read. That contrast is what makes the panel feel like
// the subject of the page rather than another box on it.
//
// The time range and the scope are the only two controls, and they compose:
// range answers "when", the sidebar answers "who". Every tile and chart below
// is that intersection and nothing else, which is why they sit together in one
// sticky header rather than being scattered per-widget.
// =============================================================================

interface ApiMember {
  id: string
  userId?: string
  user?: { email?: string | null; first_name?: string | null; last_name?: string | null }
  campaignAccess?: Array<{ campaignId: string }>
}
interface ApiTeamCampaign {
  campaignId: string
  accessMode?: string | null
  campaign?: { id: string; name?: string | null } | null
}
interface ApiTeam {
  id: string
  name: string
  isOwner?: boolean
  members?: ApiMember[]
  pendingMembers?: ApiMember[]
  campaigns?: ApiTeamCampaign[]
}

type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom'

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

function displayName(m: ApiMember): string {
  const full = `${m.user?.first_name?.trim() || ''} ${m.user?.last_name?.trim() || ''}`.trim()
  return full || m.user?.email || 'Unknown agent'
}

function toSidebarTeams(teams: ApiTeam[]): SidebarTeam[] {
  return teams.map(team => {
    const members = team.members || []
    return {
      id: team.id,
      name: team.name,
      isOwner: team.isOwner,
      campaigns: (team.campaigns || []).map(tc => {
        // accessMode 'free' opens a campaign to the whole team, so every member
        // may work it. Anything else means the roster is a grant list.
        const openToTeam = tc.accessMode === 'free'
        const eligible = openToTeam
          ? members
          : members.filter(m => (m.campaignAccess || []).some(a => a.campaignId === tc.campaignId))
        return {
          id: tc.campaignId,
          name: tc.campaign?.name || 'Untitled campaign',
          openToTeam,
          agents: eligible.map(m => ({ id: m.userId || m.id, name: displayName(m) })),
        }
      }),
    }
  })
}

/** A stat tile. The value is the only thing at full weight — the label and the
 *  comparison are context, and rendering all three at the same size is what
 *  makes a dashboard read as noise. */
function StatTile({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderTop: `3px solid ${accent}`,
      borderRadius: 4, padding: '14px 16px 16px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: '#6b7280', marginBottom: 8, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

/** Chart shell. Titled, bordered, and holding its own height so the grid does
 *  not reflow when real data arrives — a placeholder that changes size on load
 *  makes the whole page jump. */
function ChartCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{
      background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4,
      padding: '12px 14px 16px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: '#6b7280', marginBottom: 12,
      }}>▾ {title}</div>
      <div style={{
        height: 200, display: 'grid', placeItems: 'center',
        color: '#9ca3af', fontSize: 12,
      }}>
        {children ?? 'No data for this range'}
      </div>
    </div>
  )
}

export default function TeamsBetaPage() {
  const [teams, setTeams] = useState<SidebarTeam[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<TeamsScope>({ kind: 'all' })
  const [range, setRange] = useState<RangeKey>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/teams/list')
        const data = await res.json()
        if (cancelled) return
        const all: ApiTeam[] = [...(data.owned || []), ...(data.joined || [])]
        setTeams(toSidebarTeams(all))
        setPending(all.reduce((n, t) => n + (t.pendingMembers?.length || 0), 0))
      } catch {
        if (!cancelled) setTeams([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // The header names the scope in the same words the sidebar used to select it.
  // The sidebar and the panel must never disagree about where you are.
  const scopeLabel = useMemo(() => {
    if (scope.kind === 'all') return 'ALL USERS'
    if (scope.kind === 'requests') return 'REQUESTS'
    const team = teams.find(t => t.id === (scope as any).teamId)
    if (scope.kind === 'team') return (team?.name || 'Team').toUpperCase()
    const campaign = team?.campaigns.find(c => c.id === (scope as any).campaignId)
    if (scope.kind === 'campaign') return (campaign?.name || 'Campaign').toUpperCase()
    const agent = campaign?.agents.find(a => a.id === (scope as any).userId)
    return (agent?.name || 'Agent').toUpperCase()
  }, [scope, teams])

  return (
    <div style={{ display: 'flex', height: '100vh', minHeight: 0, background: '#fff' }}>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* ── RANGE BAR ─────────────────────────────────────────────────────
            Dark, full-bleed, and pinned. It is chrome rather than content, and
            separating it by value instead of by a rule keeps the reading area
            uninterrupted below it. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '10px 20px', background: '#111827', flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            color: '#93c5fd', fontWeight: 600, marginRight: 8,
          }}>Teams Overview</span>
          {RANGES.map(r => {
            const active = range === r.key
            return (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: '5px 12px', borderRadius: 3, cursor: 'pointer',
                  border: '1px solid transparent',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#fff' : '#9ca3af',
                  fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  fontWeight: 600, fontFamily: 'inherit',
                }}
              >{r.label}</button>
            )
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px 40px' }}>
          {/* ── WHAT YOU ARE LOOKING AT ─────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <span style={{ fontSize: 24, color: '#111827' }}>Viewing:</span>
            <span style={{
              fontSize: 20, fontWeight: 600, color: '#fff', background: '#111827',
              padding: '6px 14px', borderRadius: 3, letterSpacing: 0.5,
            }}>{scopeLabel}</span>
          </div>

          {/* ── TILES ───────────────────────────────────────────────────────
              Six across on a wide screen, wrapping down rather than shrinking
              to illegibility. auto-fit keeps them honest at any width without
              a media query per breakpoint. */}
          <div style={{
            display: 'grid', gap: 12, marginBottom: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}>
            <StatTile label="Total Calls" value="—" sub="Today —" accent="#2563eb" />
            <StatTile label="Hours Dialed" value="—" sub="Today —" accent="#2563eb" />
            <StatTile label="Conversions" value="—" sub="Today —" accent="#16a34a" />
            <StatTile label="Closed" value="—" sub="Today —" accent="#16a34a" />
            <StatTile label="Talk Time" value="—" sub="avg — /call" accent="#2563eb" />
            <StatTile label="Best Campaign" value="—" sub="need 5+ calls" accent="#b45309" />
          </div>

          {/* ── CHARTS ───────────────────────────────────────────────────────
              Two by two. Time-series on the top row because "how are we
              trending" is the first question; composition below it because
              "what is it made of" is the follow-up. */}
          <div style={{
            display: 'grid', gap: 14, marginBottom: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          }}>
            <ChartCard title="Call Volume Over Time" />
            <ChartCard title="Conversion Rate Over Time" />
          </div>
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          }}>
            <ChartCard title="Disposition Breakdown" />
            <ChartCard title="Campaign Performance" />
          </div>

          <div style={{
            marginTop: 24, padding: '12px 14px', borderRadius: 4,
            border: '1px dashed #d1d5db', color: '#6b7280', fontSize: 12, lineHeight: 1.7,
          }}>
            Layout only — tiles and charts are not wired to data yet. Scope and range
            are live and compose correctly:
            <code style={{ marginLeft: 6, color: '#374151' }}>
              {range} · {JSON.stringify(scope)}
            </code>
            <br />
            Next: one analytics endpoint taking (scope, range) and returning these six
            figures plus the four series, so every widget reads from a single answer
            rather than each querying its own.
          </div>
        </div>
      </main>

      <div style={{ width: 300, flexShrink: 0 }}>
        <TeamsSidebar
          teams={teams}
          scope={scope}
          onScopeChange={setScope}
          pendingRequests={pending}
        />
      </div>
      {loading && null}
    </div>
  )
}
