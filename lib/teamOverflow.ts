import { createClient } from '@supabase/supabase-js'
import { hangupCallControlId } from '@/lib/placeOutboundCall'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// TEAM OVERFLOW ROUTING — sandbox-only feature
// =============================================================================
// Predictive mode overdials on purpose: it places more lead calls than
// there are currently-ready agents, betting that some leads won't answer.
// When MORE humans pick up than there are ready agents, something has to
// happen to the "extra" answered call(s). Per build instruction:
//
//   - Solo (non-team) campaigns: the extra call is hung up immediately.
//     Dropped, same overflow behavior as any other dialer. No conference
//     to land it in, no special handling.
//   - TEAM-shared campaigns: instead of dropping the extra call, offer it
//     to the NEXT available (ready) agent_session sharing that same
//     team_id + campaign_id, rather than losing a lead who picked up.
//
// This module is the "is this campaign team-shared, and if so who's the
// next ready agent" lookup + the actual bridge, called from the events
// webhook handler at the moment call.answered fires for a
// controller_fanout lead leg with no agent leg pre-attached.
//
// IMPORTANT — CLAIMING RACE: multiple overdialed legs can answer within
// the same few hundred ms. Two answered calls must never be able to claim
// the same ready agent. See claimNextReadyAgentForOverflow's atomic
// UPDATE ... WHERE state='ready' ... RETURNING pattern below — a
// conditional UPDATE that only succeeds for exactly one caller is the
// only safe way to do this without a database-level lock.
// =============================================================================

export interface OverflowAgent {
  sessionId: string
  userId: string
}

/**
 * Returns true if this campaign is shared across a team (i.e. has a row
 * in team_campaigns), false for a solo campaign.
 */
export async function isTeamSharedCampaign(campaignId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('team_campaigns')
    .select('team_id')
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (error) {
    console.error('[teamOverflow] isTeamSharedCampaign lookup failed, treating as solo:', error)
    return false
  }
  return !!data
}

/**
 * Atomically claims the next ready agent_session for a given team+campaign.
 * Returns null if no ready agent is available (caller should then hang up
 * the extra leg — same as the solo-campaign case).
 *
 * "Claim" here means: atomically flips agent_sessions.state from 'ready'
 * to 'on_call' and sets current_call_id, in a single conditional UPDATE.
 * If two overflow calls race for the same agent, only one UPDATE call
 * actually matches a still-'ready' row — the loser gets 0 rows back and
 * moves on to try the next candidate (or hang up if none left).
 */
export async function claimNextReadyAgentForOverflow(
  teamId: string,
  campaignId: string,
  callRowId: string,
  excludeSessionId?: string | null
): Promise<OverflowAgent | null> {
  // Find candidates first (read), then attempt an atomic claim on each in
  // order until one succeeds. This isn't a single atomic "find and claim"
  // query because Supabase's REST client here doesn't give us a stored
  // procedure to do that in one round trip — so we do optimistic-claim-
  // with-retry across a short candidate list instead. Candidate lists are
  // small (a handful of agents per team in practice), so this is cheap
  // and safe: the WHERE state='ready' guard on the UPDATE is what
  // actually prevents double-claiming, not the ordering of this loop.
  const { data: candidates, error } = await supabaseAdmin
    .from('agent_sessions')
    .select('id, user_id')
    .eq('team_id', teamId)
    .eq('campaign_id', campaignId)
    .eq('state', 'ready')
    .neq('id', excludeSessionId || '00000000-0000-0000-0000-000000000000')
    .order('last_heartbeat', { ascending: true }) // prefer the agent who's been idle longest
    .limit(10)

  if (error) {
    console.error('[teamOverflow] candidate lookup failed:', error)
    return null
  }
  if (!candidates || candidates.length === 0) {
    return null
  }

  for (const candidate of candidates) {
    const claim = await supabaseAdmin
      .from('agent_sessions')
      .update({
        current_call_id: callRowId,
        state: 'on_call',
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)
      .eq('state', 'ready') // only succeeds if still ready — the race guard
      .select('id')
      .maybeSingle()

    if (claim.data) {
      return { sessionId: candidate.id, userId: candidate.user_id }
    }
    // Lost the race for this candidate — try the next one.
  }

  return null
}

/**
 * Handles an "extra" answered call for a controller_fanout dial: either
 * bridges it to the next available team agent (team-shared campaigns) or
 * hangs it up (solo campaigns, or no team agent available). This is the
 * sandbox's overflow behavior — see module header.
 *
 * Returns 'bridged' | 'dropped' so the caller (events webhook handler)
 * can log/mark the call row accordingly (was_abandoned only applies to
 * the 'dropped' case).
 */
export async function handleOverflowAnsweredCall(params: {
  leadCallControlId: string
  callRowId: string
  campaignId: string | null
  teamId: string | null
  excludeSessionId?: string | null
}): Promise<'bridged' | 'dropped'> {
  const { leadCallControlId, callRowId, campaignId, teamId } = params

  if (teamId && campaignId) {
    const isShared = await isTeamSharedCampaign(campaignId)
    if (isShared) {
      const agent = await claimNextReadyAgentForOverflow(
        teamId,
        campaignId,
        callRowId,
        params.excludeSessionId
      )
      if (agent) {
        // Dial this agent's SIP leg now, then bridge it to the already-
        // answered lead leg. Unlike the user_dial path (agent leg
        // pre-dialed before the lead answers), here the lead already
        // answered — we're placing the agent leg reactively, so there
        // will be a brief ring on the agent's device before the bridge
        // completes. That's an acceptable tradeoff for "give this lead
        // to a real person instead of dropping them."
        const dialed = await dialAndBridgeOverflowAgent(leadCallControlId)
        if (dialed) {
          return 'bridged'
        }
        // Dial/bridge failed after claiming — release the claim so the
        // agent isn't stuck marked on_call for a call they never got.
        await supabaseAdmin
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', agent.sessionId)
      }
    }
  }

  // Solo campaign, or no team agent available — drop it, same as any
  // other dialer's overflow behavior.
  await hangupCallControlId(leadCallControlId)
  return 'dropped'
}

async function dialAndBridgeOverflowAgent(leadCallControlId: string): Promise<boolean> {
  const apiKey = process.env.TELNYX_API_KEY
  const connectionId = process.env.TELNYX_CONNECTION_ID
  const sipUsername = process.env.TELNYX_SIP_USERNAME
  const sipDomain = process.env.TELNYX_SIP_DOMAIN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const fromNumber = process.env.TELNYX_PHONE_NUMBER

  if (!apiKey || !connectionId || !sipUsername || !sipDomain || !appUrl || !fromNumber) {
    console.error('[teamOverflow] missing Telnyx env, cannot dial overflow agent')
    return false
  }

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: connectionId,
      to: `sip:${sipUsername}@${sipDomain}`,
      from: fromNumber,
      webhook_url: `${appUrl}/api/calls/events`,
      timeout_secs: 30,
      link_to: leadCallControlId,
      bridge_on_answer: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[teamOverflow] agent dial for overflow failed (${res.status}): ${text}`)
    return false
  }
  return true
}
