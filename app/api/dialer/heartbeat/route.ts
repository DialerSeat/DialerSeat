import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { runPredictiveController } from '@/lib/predictiveController'
import { STALE_HEARTBEAT_SECONDS, ABANDON_YIELD_PCT } from '@/lib/dialerConstants'

const supabase = getServiceClient('dialer/heartbeat')






































const CONTROLLER_TRIGGER_STATES = new Set(['ready', 'on_call', 'wrapping', 'dialing'])














const RESOLVE_TTL_MS = 5 * 60 * 1000 // 5 minutes
type ResolvedIdentity = { userId: string; teamId: string | null }
const identityCache = new Map<string, { value: ResolvedIdentity; expires: number }>()

async function resolveIdentity(clerkId: string): Promise<ResolvedIdentity | null> {
  const cached = identityCache.get(clerkId)
  if (cached && cached.expires > Date.now()) return cached.value

  
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  if (!userRow) return null

  
  const teamId = await resolveTeamId(clerkId)

  const value: ResolvedIdentity = { userId: userRow.id, teamId }
  
  
  
  
  if (identityCache.size > 5000) {
    let toDrop = 1000
    for (const key of identityCache.keys()) {
      identityCache.delete(key)
      if (--toDrop <= 0) break
    }
  }
  identityCache.set(clerkId, { value, expires: Date.now() + RESOLVE_TTL_MS })
  return value
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

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const state: string = body.state || 'paused'
    const rawCampaignId: string | null = body.campaign_id ?? null
    const dialerMode: string | null = body.dialer_mode ?? null
    const rawCallId: string | null = body.current_call_id ?? null
    
    
    
    
    const predictiveArmed: boolean = body.predictive_armed === true
    
    
    
    
    
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const campaignId: string | null = (() => {
      if (!rawCampaignId) return null
      const base = rawCampaignId.split(':')[0]
      return UUID_RE.test(base) ? base : null
    })()
    const currentCallId: string | null =
      rawCallId && UUID_RE.test(rawCallId) ? rawCallId : null

    
    const identity = await resolveIdentity(clerkId)
    if (!identity) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }
    const userInternalId = identity.userId
    const teamId = identity.teamId

    
    
    
    
    
    
    
    let effectiveCallId = currentCallId
    if (effectiveCallId) {
      const { data: callRow } = await supabase
        .from('calls')
        .select('id, disposition, created_at')
        .eq('id', effectiveCallId)
        .maybeSingle()
      
      
      
      
      const ageMs = callRow?.created_at ? Date.now() - new Date(callRow.created_at).getTime() : 0
      if (!callRow || callRow.disposition || ageMs > 30 * 60 * 1000) {
        effectiveCallId = null
      }
    }

    
    
    
    const now = new Date().toISOString()

    const { data: upserted, error: upsertErr } = await supabase
      .from('agent_sessions')
      .upsert(
        {
          user_id: userInternalId,
          team_id: teamId,
          campaign_id: campaignId,
          dialer_mode: dialerMode,
          state,
          current_call_id: effectiveCallId,
          last_heartbeat: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('id, state, campaign_id, dialer_mode')
      .single()

    if (upsertErr || !upserted) {
      console.error('[heartbeat] upsert failed', upsertErr)
      
      
      return NextResponse.json({
        ok: false,
        session_id: null,
        state,
        should_yield: false,
        stale_window_seconds: STALE_HEARTBEAT_SECONDS,
        controller_invoked: false,
        controller: null,
        warning: 'session upsert failed',
      })
    }

    const sessionId = upserted.id

    
    let shouldYield = false
    if (campaignId) {
      try {
        const { data: rate } = await supabase
          .from('campaign_abandon_rate_30d')
          .select('abandon_rate_pct')
          .eq('campaign_id', campaignId)
          .maybeSingle()
        if (rate && typeof rate.abandon_rate_pct === 'number') {
          shouldYield = rate.abandon_rate_pct >= ABANDON_YIELD_PCT
        }
      } catch (rateErr) {
        console.error('[heartbeat] abandon rate lookup failed', rateErr)
      }
    }

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    let controllerInvoked = false
    let controllerSummary: any = null

    if (
      dialerMode === 'predictive' &&
      predictiveArmed &&
      campaignId &&
      !shouldYield &&
      CONTROLLER_TRIGGER_STATES.has(state)
    ) {
      controllerInvoked = true
      try {
        controllerSummary = await runPredictiveController({
          sessionId,
          campaignId,
          clerkId,
          internalUserId: userInternalId,
          teamId,
        })
      } catch (controllerErr) {
        console.error('[heartbeat] controller failed', controllerErr)
        controllerSummary = { error: 'controller threw' }
      }
    }

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      state: upserted.state,
      should_yield: shouldYield,
      stale_window_seconds: STALE_HEARTBEAT_SECONDS,
      controller_invoked: controllerInvoked,
      controller: controllerSummary,
    })
  } catch (err: unknown) {
    console.error('[heartbeat] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}