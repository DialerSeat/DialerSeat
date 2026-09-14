// =============================================================================
// WHO MAY LISTEN TO SOMEBODY ELSE'S CALL
// =============================================================================
// Recordings were strictly the caller's own: /api/recordings/play filtered
// user_id to the requester, so an owner paying for fifteen seats could not play
// a single one of their agents' calls. Reviewing calls is most of what an owner
// does with a floor — it is how you catch a closer going off script and how you
// settle an argument about what was said.
//
// The widening is narrow on purpose, and it is an AND of three things:
//
//   1. the caller OWNS a team,
//   2. the call's campaign is ATTACHED to that team,
//   3. the call's agent is a MEMBER of that team.
//
// All three matter. Without (2) an owner could reach an agent's personal calls
// made on their own campaigns, which are not the team's business. Without (3)
// an owner could reach anybody's calls on a campaign that merely happens to be
// attached — including a former member's, which is why removed members are
// excluded rather than merely filtered by status.
//
// THE THREE CONDITIONS MUST HOLD FOR ONE TEAM AT A TIME. An earlier version
// gathered every agent and every campaign across all the teams a viewer owns
// into two flat sets and asked whether the call matched both. That is not the
// same question. An owner with two teams — agent Adam and campaign CA in one,
// agent Bob and campaign CB in the other — would have matched Adam on CB, a
// pairing neither team actually makes. One account on this platform already
// owns five teams, so it was reachable rather than theoretical.
//
// It granted nothing in practice, because every call on a team campaign so far
// was dialed by the owner themselves and those are allowed outright. It would
// have started mattering the moment real agents began dialing team campaigns,
// which is the week this was written.
//
// Pending members are included deliberately: a seat that has been invited and
// has started dialing is producing calls the owner is paying for. Removed ones
// are not, from the moment they are removed.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CallOwnership {
  user_id: string | null
  campaign_id: string | null
}

/** One team's reach: who dials for it, and which campaigns are attached. */
export interface TeamScope {
  teamId: string
  agentIds: Set<string>
  campaignIds: Set<string>
}

/**
 * The teams `viewerId` owns, each with its own agents and campaigns.
 *
 * Returned per team rather than merged, because merging loses the pairing that
 * the access rule depends on. See the note above.
 */
export async function teamCallScopes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string
): Promise<TeamScope[]> {
  const { data: owned } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', viewerId)

  const teamIds = (owned || []).map((t: { id: string }) => t.id)
  if (teamIds.length === 0) return []

  const [membersRes, campaignsRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('team_id, user_id, status, removed_at')
      .in('team_id', teamIds),
    supabase
      .from('team_campaigns')
      .select('team_id, campaign_id')
      .in('team_id', teamIds),
  ])

  const scopes = new Map<string, TeamScope>(
    teamIds.map(id => [id, { teamId: id, agentIds: new Set<string>(), campaignIds: new Set<string>() }])
  )

  for (const m of (membersRes.data || []) as Array<{
    team_id: string; user_id: string | null; status: string | null; removed_at: string | null
  }>) {
    // removed_at as well as status: the two are written together today, and a
    // row where they disagree should fall to the side that grants less.
    if (!m.user_id || m.removed_at || m.status === 'removed') continue
    scopes.get(m.team_id)?.agentIds.add(m.user_id)
  }
  for (const c of (campaignsRes.data || []) as Array<{ team_id: string; campaign_id: string | null }>) {
    if (c.campaign_id) scopes.get(c.team_id)?.campaignIds.add(c.campaign_id)
  }

  return [...scopes.values()]
}

/**
 * Whether `viewerId` may open this particular call.
 *
 * Their own calls always. Somebody else's only when ONE team they own pairs
 * that agent with that campaign.
 */
export async function canAccessCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string,
  call: CallOwnership
): Promise<boolean> {
  if (call.user_id === viewerId) return true
  if (!call.user_id || !call.campaign_id) return false

  const scopes = await teamCallScopes(supabase, viewerId)
  return scopes.some(s =>
    s.agentIds.has(call.user_id as string) && s.campaignIds.has(call.campaign_id as string)
  )
}
