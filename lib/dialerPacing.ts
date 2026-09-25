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


// ── ONE DEFINITION OF THE 30-DAY RATE ─────────────────────────────────────
// This counted "answered" as any call with a duration and no machine verdict,
// which includes calls that rang out unanswered and agent legs that failed, so
// the Compliance tab reported a rate diluted by calls nobody picked up. It now
// reads predictive_campaign_stats, the count the predictive engine paces on:
// answered by a person (answered_at set, not a machine, not a failed agent
// leg), over the same 30 days. The tab and the engine can no longer disagree.
export async function computeAbandonRate30d(campaignId: string): Promise<{
  abandoned: number
  answered: number
  rate: number
}> {
  const { data, error } = await supabaseAdmin
    .rpc('predictive_campaign_stats', { p_campaign_ids: [campaignId] })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : null
  const ans = Number(row?.answered_30d ?? 0)
  const abn = Number(row?.abandoned_30d ?? 0)
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
    .eq('call_control_id', callSid)
}


export async function recordAmdResult(callSid: string, amdResult: string): Promise<void> {
  await supabaseAdmin
    .from('calls')
    .update({ amd_result: amdResult })
    .eq('call_control_id', callSid)
}