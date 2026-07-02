import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('dialer/active-agents')

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

    const teamId =
      searchParams.get('team_id') ?? (await resolveTeamId(clerkId))

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

      query = query.eq('user_id', userRow.id)
    }

    const { data: sessions, error: sessErr } = await query

    if (sessErr) {
      console.error('[active-agents] query failed', sessErr)
      return NextResponse.json({ error: 'query failed' }, { status: 500 })
    }

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

    let campaignPacing: CampaignPacingInfo | null = null
    if (campaignId) {
      const ready = agents.filter(a => a.state === 'ready').length
      const dialing = agents.filter(a => a.state === 'dialing').length
      const onCall = agents.filter(a => a.state === 'on_call').length
      const totalActive = agents.length

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

        console.error('[active-agents] abandon rate fetch failed', rateErr)
      }

      campaignPacing = {
        campaign_id: campaignId,
        active_agents: totalActive,
        ready_agents: ready,
        dialing_agents: dialing,
        on_call_agents: onCall,
        abandon_rate_pct: abandonRatePct,

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