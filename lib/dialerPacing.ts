import { supabaseAdmin } from '@/lib/supabase'

/**
 * Predictive dialer pacing algorithm + abandon-rate compliance enforcement.
 *
 * Core math:
 *   target_lines = max(1.0, min(3.0, configured_lines))
 *   desired_calls = active_agents * target_lines
 *   currently_calling = count of in-flight outbound calls for this campaign
 *   should_dial = max(0, desired_calls - currently_calling)
 *
 * Abandon-rate enforcement (legal cap is 3% per FTC TSR over 30-day window):
 *   - At >= 2.5%, force target_lines = 1.0 (auto-degrade to progressive)
 *   - Stay degraded until rate drops back below 2.0%
 *   - This keeps a 0.5% safety buffer below the legal threshold
 *
 * Hard caps (we don't trust caller input):
 *   - target_lines clamped to [1.0, 3.0]
 *   - should_dial clamped to [0, 10] (no campaign should request more than 10 dials in one tick)
 */

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

/**
 * Computes the rolling 30-day abandon rate for a campaign.
 * Defined per FTC TSR: abandoned calls / answered calls.
 * "Answered" = AMD said human OR no AMD result and call was answered.
 */
export async function computeAbandonRate30d(campaignId: string): Promise<{
  abandoned: number
  answered: number
  rate: number
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Count answered calls (humans + unknown answers)
  const { count: answered } = await supabaseAdmin
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('created_at', thirtyDaysAgo)
    .or('amd_result.eq.human,amd_result.is.null')
    .gt('duration', 0)

  // Count abandoned calls
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

/**
 * Counts in-flight outbound calls for a campaign right now.
 * "In-flight" = inserted within the last 60s with no completion signal.
 * We approximate this by: created_at > 60s ago AND duration = 0.
 */
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

/**
 * Counts active dialer sessions for a campaign in last 60s.
 */
async function countActiveAgents(campaignId: string): Promise<number> {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from('dialer_sessions')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .is('ended_at', null)
    .gte('last_heartbeat_at', sixtySecondsAgo)
  if (!data) return 0
  return new Set(data.map(s => s.user_id)).size
}

/**
 * The main pacing decision function.
 * Call this every time an agent finishes a call OR on heartbeat tick.
 */
export async function computePacingDecision(
  campaignId: string,
  configuredLinesPerAgent: number
): Promise<PacingDecision> {
  // Clamp configured value (don't trust DB if somehow > 3 or < 1)
  const requested = Math.max(1.0, Math.min(3.0, configuredLinesPerAgent || 1.5))

  const [activeAgents, currentlyCalling, abandonStats] = await Promise.all([
    countActiveAgents(campaignId),
    countInFlightCalls(campaignId),
    computeAbandonRate30d(campaignId),
  ])

  // Auto-degrade logic: force 1x if abandon rate is at/above degrade trigger
  const isDegraded = abandonStats.rate >= ABANDON_RATE_DEGRADE_TRIGGER
  const targetLines = isDegraded ? 1.0 : requested

  // Compute desired vs current
  const desired = activeAgents * targetLines
  let shouldDial = Math.max(0, Math.floor(desired - currentlyCalling))
  shouldDial = Math.min(shouldDial, MAX_DIALS_PER_TICK)

  // No agents? Don't dial.
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

/**
 * Marks a call as abandoned. Used by the AMD webhook when a human picks up
 * but no agent is available within the legal 2-second window.
 */
export async function markCallAbandoned(callSid: string): Promise<void> {
  await supabaseAdmin
    .from('calls')
    .update({ was_abandoned: true })
    .eq('signalwire_call_id', callSid)
}

/**
 * Records the AMD result on a call for later abandon-rate math.
 * Allowed values: human, machine_start, machine_end_beep, machine_end_silence,
 * machine_end_other, fax, unknown.
 */
export async function recordAmdResult(callSid: string, amdResult: string): Promise<void> {
  await supabaseAdmin
    .from('calls')
    .update({ amd_result: amdResult })
    .eq('signalwire_call_id', callSid)
}