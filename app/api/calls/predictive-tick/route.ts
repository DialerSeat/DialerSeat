import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { runPredictiveController } from '@/lib/predictiveController'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// PREDICTIVE TICK — agent ready transition trigger
// =============================================================================
// The dialer page POSTs here when:
//   1. Agent toggles to LIVE (available) in predictive mode with a campaign
//   2. Agent transitions to 'ready' after a call ends
//   3. Agent finishes wrapping (dispositioning) a call in predictive mode
//
// This endpoint:
//   1. Verifies the agent has an active session
//   2. Confirms they're in predictive mode + have a campaign
//   3. Resolves their team affiliation (same logic as heartbeat/active-agents)
//   4. Invokes the predictive controller (lib/predictiveController.ts)
//   5. Returns the controller's summary
//
// The controller does the actual lead-claiming and call-firing.
// This endpoint is the thin authorization + lookup layer around it.
//
// SAFETY: the controller itself enforces all the limits (5-line hard cap,
// abandon-rate degrade, claim atomicity). If this endpoint is called when
// it shouldn't fire (campaign not predictive, agent not ready, etc), the
// controller's preconditions return early without dialing anything.
// =============================================================================

// resolveTeamId — same helper used by heartbeat + active-agents.
// Owner first, then active member, then null (solo agent).
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

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Look up the internal user row.
    // agent_sessions.user_id is the UUID, not the Clerk ID, so we need both.
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!userRow) {
      // 500 (not 404) so this doesn't look like a missing route — same
      // pattern as the heartbeat handler.
      return NextResponse.json(
        { error: 'user row not found' },
        { status: 500 }
      )
    }

    // Find the agent's most recent active session. Heartbeat upserts on
    // (user_id) so there should be exactly one row per user, but we filter
    // by recency anyway in case of any race.
    const fifteenSecondsAgo = new Date(Date.now() - 15_000).toISOString()
    const { data: session } = await supabase
      .from('agent_sessions')
      .select('id, state, campaign_id, dialer_mode')
      .eq('user_id', userRow.id)
      .gte('last_heartbeat', fifteenSecondsAgo)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({
        fired: 0,
        reason: 'no active session — heartbeat may be stale',
      })
    }

    // Preconditions for firing the controller.
    // Each one returns 0 fired with a reason — not an error, since the
    // client can legitimately call this on every ready transition and we
    // just no-op when conditions don't match.
    if (session.state !== 'ready') {
      return NextResponse.json({
        fired: 0,
        reason: `agent state is ${session.state}, not ready`,
      })
    }

    if (session.dialer_mode !== 'predictive') {
      return NextResponse.json({
        fired: 0,
        reason: `agent mode is ${session.dialer_mode}, not predictive`,
      })
    }

    if (!session.campaign_id) {
      return NextResponse.json({
        fired: 0,
        reason: 'no campaign selected',
      })
    }

    const teamId = await resolveTeamId(clerkId)

    // Hand off to the controller. It will:
    //   - Look up the agent's preferred_lines (or campaign default)
    //   - Clamp to [1, 5]
    //   - Check abandon rate (auto-degrade to 1 if >= 2.5%)
    //   - Count in-flight calls for this session
    //   - Claim the right number of leads atomically
    //   - Fire outbound calls in parallel
    const result = await runPredictiveController({
      sessionId: session.id,
      campaignId: session.campaign_id,
      clerkId,
      internalUserId: userRow.id,
      teamId,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[predictive-tick] unhandled', err)
    return NextResponse.json(
      { error: 'server error', fired: 0 },
      { status: 500 }
    )
  }
}