import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// AGENT HEARTBEAT
// =============================================================================
// Dialer page POSTs here every 5 seconds while the tab is open.
// Tracks which agents are online and what state they're in.
//
// The predictive controller reads from `agent_sessions` to find ready agents
// to route fan-out calls to. If an agent's heartbeat goes stale (>15s) their
// session is marked offline, and any in-flight calls they own get handled
// per the campaign's disconnect_behavior setting.
//
// Request body:
// {
//   state: 'ready' | 'dialing' | 'on_call' | 'wrapping' | 'paused',
//   campaign_id?: string,
//   dialer_mode?: 'preview' | 'power' | 'progressive' | 'predictive',
//   current_call_id?: string
// }
//
// Response:
// {
//   session_id: string,
//   state: string,
//   should_yield: boolean   // true if server wants agent to pause (e.g. abandon rate too high)
// }
// =============================================================================

const VALID_STATES = ['ready', 'dialing', 'on_call', 'wrapping', 'paused'] as const
type AgentState = (typeof VALID_STATES)[number]

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
type DialerMode = (typeof VALID_MODES)[number]

interface HeartbeatBody {
  state?: AgentState
  campaign_id?: string | null
  dialer_mode?: DialerMode | null
  current_call_id?: string | null
}

export async function POST(req: NextRequest) {
  try {
    // Auth — Clerk userId is the external ID, we resolve to internal users.id
    // via the users.clerk_id column (this codebase's naming convention).
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, team_id')
      .eq('clerk_id', clerkId)
      .single()

    if (userErr || !userRow) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    // Parse body
    let body: HeartbeatBody = {}
    try {
      body = await req.json()
    } catch {
      // Empty body is allowed — treated as a "ping" with state=ready
      body = {}
    }

    const state: AgentState = body.state && VALID_STATES.includes(body.state)
      ? body.state
      : 'ready'

    const dialer_mode: DialerMode | null = body.dialer_mode && VALID_MODES.includes(body.dialer_mode)
      ? body.dialer_mode
      : null

    // Upsert the agent session. One active row per user (enforced by unique index).
    const now = new Date().toISOString()

    const { data: session, error: upsertErr } = await supabase
      .from('agent_sessions')
      .upsert(
        {
          user_id: userRow.id,
          team_id: userRow.team_id,
          campaign_id: body.campaign_id ?? null,
          dialer_mode,
          state,
          current_call_id: body.current_call_id ?? null,
          last_heartbeat: now,
          updated_at: now,
        },
        { onConflict: 'user_id', ignoreDuplicates: false }
      )
      .select('id, state')
      .single()

    if (upsertErr) {
      console.error('[heartbeat] upsert failed', upsertErr)
      return NextResponse.json({ error: 'session write failed' }, { status: 500 })
    }

    // Sweep stale sessions (cheap operation, runs once per heartbeat)
    // This is what triggers offline detection across the system.
    // Note: supabase.rpc() returns a builder that becomes a Promise on await,
    // so we wrap in try/await rather than chaining .catch() directly.
    try {
      await supabase.rpc('mark_stale_agents_offline')
    } catch (sweepErr: unknown) {
      // Non-fatal — keep the heartbeat response moving
      console.error('[heartbeat] stale sweep failed', sweepErr)
    }

    // Check if we should ask the agent to yield (e.g. abandon rate too high)
    // Only applies to predictive mode — other modes don't have abandon risk.
    let should_yield = false
    if (state === 'ready' && dialer_mode === 'predictive' && body.campaign_id) {
      const { data: rate } = await supabase
        .from('campaign_abandon_rate_30d')
        .select('abandon_rate_pct')
        .eq('campaign_id', body.campaign_id)
        .single()

      // FTC TSR limit is 3%. We start asking agents to yield at 2.8%
      // to leave buffer before we hit the hard limit.
      if (rate && rate.abandon_rate_pct >= 2.8) {
        should_yield = true
      }
    }

    return NextResponse.json({
      session_id: session.id,
      state: session.state,
      should_yield,
      heartbeat_at: now,
    })
  } catch (err: unknown) {
    console.error('[heartbeat] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

// GET — dialer page reads this on mount to find out its own state
// (useful when refreshing the page mid-call)
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const { data: session } = await supabase
      .from('agent_sessions')
      .select('id, state, campaign_id, dialer_mode, current_call_id, last_heartbeat')
      .eq('user_id', userRow.id)
      .single()

    return NextResponse.json({
      session: session ?? null,
    })
  } catch (err: unknown) {
    console.error('[heartbeat:get] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}