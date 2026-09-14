// =============================================================================
// WHO MAY LISTEN TO SOMEBODY ELSE'S CALL
// =============================================================================
// Recordings were strictly the caller's own: /api/recordings/play filters
// user_id to the requester, so an owner paying for fifteen seats could not play
// a single one of their agents' calls. Reviewing calls is most of what an owner
// does with a floor — it is how you catch a closer going off script and how you
// settle an argument about what was said.
//
// The widening is narrow on purpose, and it is an AND of three things:
//
//   1. the caller OWNS a team,
//   2. the call's campaign is ATTACHED to that team,
//   3. the call's agent is a MEMBER of that same team.
//
// All three matter. Without (2) an owner could reach an agent's personal calls
// made on their own campaigns, which are not the team's business. Without (3)
// an owner could reach anybody's calls on a campaign that merely happens to be
// attached — including a former member's, which is why removed members are
// excluded rather than merely filtered by status.
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

/**
 * Every clerk id whose calls `viewerId` may see, plus the campaigns those calls
 * must belong to.
 *
 * Returned as a pair of sets rather than a per-call check so a listing can
 * filter thousands of rows without a query each. Both must be satisfied: see
 * the note above for why either one alone is not enough.
 */
export async function teamCallScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string
): Promise<{ agentIds: Set<string>; campaignIds: Set<string> }> {
  const agentIds = new Set<string>([viewerId])
  const campaignIds = new Set<string>()

  const { data: owned } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', viewerId)

  const teamIds = (owned || []).map((t: { id: string }) => t.id)
  if (teamIds.length === 0) return { agentIds, campaignIds }

  const [membersRes, campaignsRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('user_id, status, removed_at')
      .in('team_id', teamIds),
    supabase
      .from('team_campaigns')
      .select('campaign_id')
      .in('team_id', teamIds),
  ])

  for (const m of (membersRes.data || []) as Array<{
    user_id: string | null; status: string | null; removed_at: string | null
  }>) {
    // removed_at as well as status: the two are written together today, and a
    // row where they disagree should fall to the side that grants less.
    if (!m.user_id || m.removed_at || m.status === 'removed') continue
    agentIds.add(m.user_id)
  }
  for (const c of (campaignsRes.data || []) as Array<{ campaign_id: string | null }>) {
    if (c.campaign_id) campaignIds.add(c.campaign_id)
  }

  return { agentIds, campaignIds }
}

/**
 * Whether `viewerId` may open this particular call.
 *
 * Their own calls always. Somebody else's only under all three conditions in
 * the note at the top of this file.
 */
export async function canAccessCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string,
  call: CallOwnership
): Promise<boolean> {
  if (call.user_id === viewerId) return true
  if (!call.user_id || !call.campaign_id) return false

  const { agentIds, campaignIds } = await teamCallScope(supabase, viewerId)
  return agentIds.has(call.user_id) && campaignIds.has(call.campaign_id)
}
