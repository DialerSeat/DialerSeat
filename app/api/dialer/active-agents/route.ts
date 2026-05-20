import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// ACTIVE AGENTS — real data
// =============================================================================
// Previously this endpoint returned static placeholder data. Now it returns
// the real agent_sessions for the team and campaign context.
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

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve Clerk user → internal user row (this codebase uses users.clerk_id)
    const { data: userRow } = await supabase
      .from('users')
      .select('id, team_id')
      .eq('clerk_id', clerkId)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')
    const teamId = searchParams.get('team_id') ?? userRow.team_id

    // ----- Build the query -----
    // Always exclude offline sessions. Heartbeat sweep marks them, but we
    // double-filter here in case the sweep hasn't run for this request.
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
      query = query.eq('campaign_id', campaignId)
    } else if (teamId) {
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

      // Lookup current abandon rate from the rolling 30d view
      const { data: rateRow } = await supabase
        .from('campaign_abandon_rate_30d')
        .select('abandon_rate_pct')
        .eq('campaign_id', campaignId)
        .single()

      campaignPacing = {
        campaign_id: campaignId,
        active_agents: totalActive,
        ready_agents: ready,
        dialing_agents: dialing,
        on_call_agents: onCall,
        abandon_rate_pct: rateRow?.abandon_rate_pct ?? null,
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