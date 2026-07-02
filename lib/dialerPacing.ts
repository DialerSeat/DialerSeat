import { supabaseAdmin } from '@/lib/supabase'



export interface PacingDecision {
  shouldDial: number              // how many lines to fire RIGHT NOW
  targetLinesPerAgent: number     // current effective multiplier
  configuredLinesPerAgent: number // what the campaign is configured for
  activeAgents: number
  currentlyCalling: number
  abandonRate30d: number          // 0-1 fraction
  isDegraded: boolean             // true when auto-throttled to 1x
  reason: string                  // human-readable for logs/UI
}

const ABANDON_RATE_DEGRADE_TRIGGER = 0.025  // 2.5% — start auto-throttle
const ABANDON_RATE_DEGRADE_RECOVER = 0.020  // 2.0% — stop auto-throttle
const MAX_DIALS_PER_TICK = 10               // safety cap


export async function computeAbandonRate30d(campaignId: string): Promise<{
  abandoned: number
  answered: number
  rate: number
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  
  const { count: answered } = await supabaseAdmin
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', thirtyDaysAgo)
    .or('amd_result.eq.human,amd_result.is.null')
    .gt('duration', 0)

  
  const { count: abandoned } = await supabaseAdmin
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', thirtyDaysAgo)
    .eq('was_abandoned', true)

  const ans = answered || 0
  const abn = abandoned || 0
  const rate = ans > 0 ? abn / ans : 0

  return { abandoned: abn, answered: ans, rate }
}


async function countInFlightCalls(campaignId: string): Promise<number> {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', sixtySecondsAgo)
    .eq('duration', 0)
  return count || 0
}


async function countActiveAgents(campaignId: string): Promise<number> {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from('agent_sessions')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .neq('state', 'paused')
    .gte('last_heartbeat', sixtySecondsAgo)
  if (!data) return 0
  return new Set(data.map(s => s.user_id)).size
}


export async function computePacingDecision(
  campaignId: string,
  configuredLinesPerAgent: number
): Promise<PacingDecision> {
  
  const requested = Math.max(1.0, Math.min(3.0, configuredLinesPerAgent || 1.5))

  const [activeAgents, currentlyCalling, abandonStats] = await Promise.all([
    countActiveAgents(campaignId),
    countInFlightCalls(campaignId),
    computeAbandonRate30d(campaignId),
  ])

  
  const isDegraded = abandonStats.rate >= ABANDON_RATE_DEGRADE_TRIGGER
  const targetLines = isDegraded ? 1.0 : requested

  
  const desired = activeAgents * targetLines
  let shouldDial = Math.max(0, Math.floor(desired - currentlyCalling))
  shouldDial = Math.min(shouldDial, MAX_DIALS_PER_TICK)

  
  if (activeAgents === 0) shouldDial = 0

  let reason: string
  if (activeAgents === 0) {
    reason = 'no active agents'
  } else if (isDegraded) {
    reason = `auto-degraded: 30d abandon rate ${(abandonStats.rate * 100).toFixed(2)}% >= ${(ABANDON_RATE_DEGRADE_TRIGGER * 100).toFixed(1)}%`
  } else if (shouldDial === 0 && currentlyCalling >= desired) {
    reason = `at target: ${currentlyCalling}/${desired.toFixed(1)} in flight`
  } else {
    reason = `dialing ${shouldDial} more (target ${desired.toFixed(1)}, in flight ${currentlyCalling})`
  }

  return {
    shouldDial,
    targetLinesPerAgent: targetLines,
    configuredLinesPerAgent: requested,
    activeAgents,
    currentlyCalling,
    abandonRate30d: abandonStats.rate,
    isDegraded,
    reason,
  }
}


export async function markCallAbandoned(callSid: string): Promise<void> {
  await supabaseAdmin
    .from('calls')
    .update({ was_abandoned: true })
    .eq('signalwire_call_id', callSid)
}


export async function recordAmdResult(callSid: string, amdResult: string): Promise<void> {
  await supabaseAdmin
    .from('calls')
    .update({ amd_result: amdResult })
    .eq('signalwire_call_id', callSid)
}