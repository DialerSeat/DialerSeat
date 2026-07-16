import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('dialer/active-agents')

// =============================================================================
// ACTIVE AGENTS — real data
// =============================================================================
// Returns the real agent_sessions for the team and campaign context.
//
// Used by:
//   - Dialer page pacing panel (shows "X agents on this campaign")
//   - Predictive controller (decides whether to use multi-agent reroute)
//   - Admin/team dashboards
//
// Query params:
//   ?campaign_id=<uuid>  — filter to agents currently on this campaign
//   ?team_id=<uuid>      — filter to all agents on this team (any campaign)
//
// Default behavior: returns agents on the same team as the authenticated user.
//
// SCHEMA NOTES (these match the heartbeat route's resolveTeamId helper):
//   - users table has NO `team_id` column. Solo agents have no team.
//   - Team membership is determined via TWO places:
//       1. teams.owner_id (stores Clerk ID, not users.id UUID)
//       2. team_members.user_id (stores Clerk ID, with status = 'active')
//   - An earlier version of this file selected users.team_id which silently
//     returned undefined and caused the pacing panel to filter by user_id
//     instead of campaign_id. Fixed.
// =============================================================================

interface AgentSummary {
  user_id: string
  state: string
  campaign_id: string | null
  dialer_mode: string | null
  last_heartbeat: string
  current_call_id: string | null
  seconds_since_heartbeat: number
}

interface CampaignPacingInfo {
  campaign_id: string
  active_agents: number
  ready_agents: number
  dialing_agents: number
  on_call_agents: number
  abandon_rate_pct: number | null
  is_predictive_team: boolean
}

// -----------------------------------------------------------------------------
// resolveTeamId — same logic as the heartbeat route.
// Given a Clerk ID, return the team_id the agent acts under, or null.
//
// Owner check first, then active membership check, then null (solo agent).
// -----------------------------------------------------------------------------
async function resolveTeamId(clerkId: string): Promise<string | null> {
  const { data: ownedTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', clerkId)
    .limit(1)
    .maybeSingle()

  if (ownedTeam?.id) return ownedTeam.id

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (membership?.team_id) return membership.team_id

  return null
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve Clerk user → internal user row.
    // IMPORTANT: select only columns that actually exist on users.
    // (Earlier version selected `team_id` which doesn't exist and caused
    // the request to fall through to the solo-user branch every time.)
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')
    // Same principle as team_id above — an explicit campaign_id must
    // actually be reachable by the caller: either they own it directly, or
    // it's attached to a team they own/belong to.
    if (campaignId) {
      const { data: ownedCampaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('user_id', clerkId)
        .maybeSingle()

      let campaignAuthorized = !!ownedCampaign
      if (!campaignAuthorized) {
        const { data: teamCampaignRows } = await supabase
          .from('team_campaigns')
          .select('team_id, teams!inner(owner_id)')
          .eq('campaign_id', campaignId)

        for (const row of teamCampaignRows || []) {
          if ((row as any).teams?.owner_id === clerkId) {
            campaignAuthorized = true
            break
          }
          const { data: membership } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', row.team_id)
            .eq('user_id', clerkId)
            .eq('status', 'active')
            .maybeSingle()
          if (membership) {
            campaignAuthorized = true
            break
          }
        }
      }

      if (!campaignAuthorized) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const requestedTeamId = searchParams.get('team_id')

    // An explicit team_id in the URL must actually belong to the caller —
    // either as owner or as an active member. Without this check, any
    // authenticated user could pass an arbitrary team_id and see that
    // team's live dialing activity (who's ready, dialing, on a call).
    if (requestedTeamId) {
      const { data: ownedTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('id', requestedTeamId)
        .eq('owner_id', clerkId)
        .maybeSingle()

      let authorized = !!ownedTeam
      if (!authorized) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', requestedTeamId)
          .eq('user_id', clerkId)
          .eq('status', 'active')
          .maybeSingle()
        authorized = !!membership
      }

      if (!authorized) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    // Team scope: URL param wins (now verified above), then fall back to
    // resolved team affiliation for the caller. Solo agents resolve to null
    // and get the user-only branch.
    const teamId = requestedTeamId ?? (await resolveTeamId(clerkId))

    // ----- Build the query -----
    // Always exclude offline + stale sessions. Heartbeat sweep marks them
    // offline asynchronously; we double-filter here so a request that beats
    // the sweep still gets clean data.
    let query = supabase
      .from('agent_sessions')
      .select(`
        id,
        user_id,
        team_id,
        campaign_id,
        dialer_mode,
        state,
        current_call_id,
        last_heartbeat
      `)
      .neq('state', 'offline')
      .gte('last_heartbeat', new Date(Date.now() - 15_000).toISOString())

    if (campaignId) {
      // Most common branch — dialer page asking for predictive pacing
      query = query.eq('campaign_id', campaignId)
    } else if (teamId) {
      // No campaign filter, but caller belongs to a team — show whole team
      query = query.eq('team_id', teamId)
    } else {
      // Solo user, no team — return only this user's session
      query = query.eq('user_id', userRow.id)
    }

    const { data: sessions, error: sessErr } = await query

    if (sessErr) {
      console.error('[active-agents] query failed', sessErr)
      return NextResponse.json({ error: 'query failed' }, { status: 500 })
    }

    // ----- Shape the agents response -----
    const now = Date.now()
    const agents: AgentSummary[] = (sessions ?? []).map(s => ({
      user_id: s.user_id,
      state: s.state,
      campaign_id: s.campaign_id,
      dialer_mode: s.dialer_mode,
      last_heartbeat: s.last_heartbeat,
      current_call_id: s.current_call_id,
      seconds_since_heartbeat: Math.round(
        (now - new Date(s.last_heartbeat).getTime()) / 1000
      ),
    }))

    // ----- Build campaign pacing info if requested -----
    let campaignPacing: CampaignPacingInfo | null = null
    if (campaignId) {
      const ready = agents.filter(a => a.state === 'ready').length
      const dialing = agents.filter(a => a.state === 'dialing').length
      const onCall = agents.filter(a => a.state === 'on_call').length
      const totalActive = agents.length

      // Lookup current abandon rate from the rolling 30d view.
      // Use maybeSingle so a brand-new campaign with no calls yet (no row in
      // the view) doesn't 500 — returns null cleanly.
      let abandonRatePct: number | null = null
      try {
        const { data: rateRow } = await supabase
          .from('campaign_abandon_rate_30d')
          .select('abandon_rate_pct')
          .eq('campaign_id', campaignId)
          .maybeSingle()

        if (rateRow && typeof rateRow.abandon_rate_pct === 'number') {
          abandonRatePct = rateRow.abandon_rate_pct
        }
      } catch (rateErr) {
        // Non-fatal — abandonRatePct stays null
        console.error('[active-agents] abandon rate fetch failed', rateErr)
      }

      campaignPacing = {
        campaign_id: campaignId,
        active_agents: totalActive,
        ready_agents: ready,
        dialing_agents: dialing,
        on_call_agents: onCall,
        abandon_rate_pct: abandonRatePct,
        // 2+ agents on the same campaign → team predictive routing applies
        // (used by disconnect_behavior='auto' to decide hangup vs reroute)
        is_predictive_team: totalActive >= 2,
      }
    }

    return NextResponse.json({
      agents,
      total_active: agents.length,
      campaign_pacing: campaignPacing,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[active-agents] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}