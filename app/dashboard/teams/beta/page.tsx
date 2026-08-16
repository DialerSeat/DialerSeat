'use client'

import { useEffect, useState } from 'react'
import TeamsSidebar, {
  type SidebarTeam,
  type TeamsScope,
} from '@/components/teams/TeamsSidebar'

// =============================================================================
// TEAMS — REBUILD, MOUNTED SEPARATELY
// =============================================================================
// Lives at /dashboard/teams/beta rather than replacing /dashboard/teams, so the
// working page keeps working while this is filled in. Promote it by pointing
// app/dashboard/teams/page.tsx here once it earns it.
//
// Reads the existing /api/teams/list — no new endpoint. That response already
// carries everything the sidebar needs: teams, their campaigns with accessMode,
// and members with their per-campaign access. The mapping below is the only
// new logic, and it is the piece most likely to change as the backend firms up,
// which is exactly why it sits here rather than inside the sidebar.
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

function displayName(m: ApiMember): string {
  const first = m.user?.first_name?.trim() || ''
  const last = m.user?.last_name?.trim() || ''
  const full = `${first} ${last}`.trim()
  return full || m.user?.email || 'Unknown agent'
}

/**
 * API shape -> sidebar shape.
 *
 * The only judgement here is who appears under a campaign, and it follows the
 * rule the owner set: a campaign with accessMode 'free' is open to the whole
 * team, so every member is listed. Anything else lists only members holding
 * access to that specific campaign.
 */
function toSidebarTeams(teams: ApiTeam[]): SidebarTeam[] {
  return teams.map(team => {
    const members = team.members || []
    return {
      id: team.id,
      name: team.name,
      isOwner: team.isOwner,
      campaigns: (team.campaigns || []).map(tc => {
        const openToTeam = tc.accessMode === 'free'
        const eligible = openToTeam
          ? members
          : members.filter(m =>
              (m.campaignAccess || []).some(a => a.campaignId === tc.campaignId)
            )
        return {
          id: tc.campaignId,
          name: tc.campaign?.name || 'Untitled campaign',
          openToTeam,
          agents: eligible.map(m => ({
            id: m.userId || m.id,
            name: displayName(m),
          })),
        }
      }),
    }
  })
}

export default function TeamsBetaPage() {
  const [teams, setTeams] = useState<SidebarTeam[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<TeamsScope>({ kind: 'all' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/teams/list')
        const data = await res.json()
        if (cancelled) return
        const all: ApiTeam[] = [...(data.owned || []), ...(data.joined || [])]
        setTeams(toSidebarTeams(all))
        setPending(
          all.reduce((n, t) => n + (t.pendingMembers?.length || 0), 0)
        )
      } catch {
        if (!cancelled) setTeams([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Plain-language description of the current scope. The header says what you
  // are looking at in the same words the sidebar used to select it — the
  // sidebar and the panel should never disagree about where you are.
  const scopeLabel = (() => {
    if (scope.kind === 'all') return 'All Users'
    if (scope.kind === 'requests') return 'Requests'
    const team = teams.find(t => t.id === (scope as any).teamId)
    if (scope.kind === 'team') return team?.name || 'Team'
    const campaign = team?.campaigns.find(c => c.id === (scope as any).campaignId)
    if (scope.kind === 'campaign') return campaign?.name || 'Campaign'
    const agent = campaign?.agents.find(a => a.id === (scope as any).userId)
    return agent?.name || 'Agent'
  })()

  return (
    <div style={{
      display: 'flex', height: '100vh', minHeight: 0,
      background: '#1e1f22', color: '#f2f3f5',
    }}>
      {/* The floor is the page — full bleed, no centered column. See
          TEAMS-REDESIGN.md. */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        }}>
          <span style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: '#949ba4' }}>
            Viewing
          </span>
          <span style={{
            fontSize: 20, fontWeight: 600, padding: '4px 12px',
            background: '#2b2d31', borderRadius: 4,
          }}>
            {scopeLabel}
          </span>
        </div>

        {/* ROUGH DRAFT. The analytics, roster and request panels belong here,
            scoped by `scope`. Deliberately left as a marker rather than
            half-built — the sidebar and the scope contract are what needed to
            exist first, and everything below hangs off them. */}
        <div style={{
          border: '1px dashed #35373c', borderRadius: 6,
          padding: '40px 24px', textAlign: 'center', color: '#80848e',
          fontSize: 14, lineHeight: 1.7,
        }}>
          {loading ? 'Loading teams…' : (
            <>
              Panel for <strong style={{ color: '#f2f3f5' }}>{scopeLabel}</strong> goes here.
              <br />
              Scope is live — pick anything in the sidebar and this follows it.
              <div style={{ marginTop: 14, fontSize: 12, color: '#5c5f66' }}>
                scope: <code>{JSON.stringify(scope)}</code>
              </div>
            </>
          )}
        </div>
      </main>

      <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #1f2023' }}>
        <TeamsSidebar
          teams={teams}
          scope={scope}
          onScopeChange={setScope}
          pendingRequests={pending}
        />
      </div>
    </div>
  )
}
