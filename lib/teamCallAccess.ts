// =============================================================================
// WHO MAY LISTEN TO SOMEBODY ELSE'S CALL
// =============================================================================
// Recordings were strictly the caller's own: /api/recordings/play filtered
// user_id to the requester, so an owner paying for fifteen seats could not play
// a single one of their agents' calls. Reviewing calls is most of what an owner
// does with a floor — it is how you catch a closer going off script and how you
// settle an argument about what was said.
//
// THE RULE IS MEMBERSHIP. The caller owns a team, and the call was made by
// somebody on it. That is the whole test.
//
// IT USED TO ALSO REQUIRE THE CAMPAIGN, and that was wrong for this product
// rather than merely strict. The first version asked for three things: the
// caller owns a team, the call's campaign is attached to that team, and the
// agent is a member of it. The reasoning was that an agent's calls on their own
// campaigns are not the team's business.
//
// The data said otherwise. Across the four teams that have members, those
// members have made 850, 5, 5 and 5 calls and not one of them was on a team
// campaign. Every owner's analytics read zero, and every recording 404'd, for
// agents who were dialing every day. The campaign list is not how this product
// is actually used; the seat is. Josh asked for it directly on 2026-09-14:
// "make it so i can see all of their recordings on the page".
//
// So an owner sees the calls of the people whose seats they pay for, on
// whatever list those people are working. Anyone who is not on one of their
// teams stays invisible, which is the line that still matters.
//
// Removed members are excluded on both status and removed_at, from the moment
// they are removed. Pending ones are included: a seat that has been invited and
// has started dialing is producing calls the owner is already paying for.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CallOwnership {
  user_id: string | null
  campaign_id?: string | null
}

/**
 * Every clerk id whose calls `viewerId` may open: themselves, plus everyone on
 * a team they own.
 */
export async function teamCallAgentIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string
): Promise<Set<string>> {
  const agentIds = new Set<string>([viewerId])

  const { data: owned } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', viewerId)

  const teamIds = (owned || []).map((t: { id: string }) => t.id)
  if (teamIds.length === 0) return agentIds

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id, status, removed_at')
    .in('team_id', teamIds)

  for (const m of (members || []) as Array<{
    user_id: string | null; status: string | null; removed_at: string | null
  }>) {
    // removed_at as well as status: the two are written together today, and a
    // row where they disagree should fall to the side that grants less.
    if (!m.user_id || m.removed_at || m.status === 'removed') continue
    agentIds.add(m.user_id)
  }

  return agentIds
}

/**
 * Whether `viewerId` may open this particular call.
 *
 * Their own calls always. Somebody else's when that somebody is on a team the
 * viewer owns.
 */
export async function canAccessCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  viewerId: string,
  call: CallOwnership
): Promise<boolean> {
  if (call.user_id === viewerId) return true
  if (!call.user_id) return false

  const agentIds = await teamCallAgentIds(supabase, viewerId)
  return agentIds.has(call.user_id)
}
