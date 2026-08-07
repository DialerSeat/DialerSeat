import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { getConcurrencySnapshot } from '@/lib/concurrency'

const supabase = getServiceClient('admin/ops-live')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/ops-live — what is happening RIGHT NOW
// =============================================================================
// Built from the list of things that broke silently and stayed broken:
//
//   - The predictive controller placed zero calls for weeks. Nothing showed a
//     dial-source mix, so nobody could see that one of the four modes was
//     simply dead.
//   - Abort left calls up. Nothing listed in-flight calls, so the only way to
//     notice was a phone still ringing in the room.
//   - AMD hung up on humans at a 4:1 rate. Nothing aggregated amd_result, so
//     it took a database query to find.
//   - Recordings captured no id for weeks and played 0:00.
//
// Every one of those is a number this endpoint returns. The point is not more
// data — it is that a wrong number here is visible at a glance instead of
// requiring someone to go looking.
// =============================================================================

const IN_FLIGHT_MAX_AGE_MS = 10 * 60_000
const AGENT_ONLINE_WINDOW_MS = 60_000

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const now = Date.now()
    const inFlightSince = new Date(now - IN_FLIGHT_MAX_AGE_MS).toISOString()
    const day = new Date(now - 24 * 60 * 60_000).toISOString()
    const week = new Date(now - 7 * 24 * 60 * 60_000).toISOString()

    const [concurrency, inFlightRes, dayRes, weekRes, sessionsRes] = await Promise.all([
      getConcurrencySnapshot(),

      // Calls believed live. duration = 0 is the in-flight sentinel the abort
      // sweep uses, so this list is exactly what abort would target.
      supabase
        .from('calls')
        .select('id, user_id, phone_number, dial_source, created_at, answered_at, agent_call_control_id')
        .eq('duration', 0)
        .gte('created_at', inFlightSince)
        .order('created_at', { ascending: false })
        .limit(100),

      // 24h dial-source mix. The panel that would have made "predictive is
      // dead" a glance rather than an investigation.
      supabase
        .from('calls')
        .select('dial_source, answered_at')
        .gte('created_at', day)
        .limit(20000),

      // 7d signal window: AMD outcomes and recording capture.
      supabase
        .from('calls')
        .select('amd_result, answered_at, recording_id, recording_url, recording_status')
        .gte('created_at', week)
        .limit(50000),

      supabase
        .from('agent_sessions')
        .select('id, user_id, campaign_id, dialer_mode, state, last_heartbeat')
        .gte('last_heartbeat', new Date(now - AGENT_ONLINE_WINDOW_MS).toISOString())
        .limit(200),
    ])

    // ── in flight ────────────────────────────────────────────────────────
    const inFlight = (inFlightRes.data || []).map(c => ({
      id: c.id,
      phone: c.phone_number,
      source: c.dial_source || 'unknown',
      ageSeconds: Math.round((now - new Date(c.created_at).getTime()) / 1000),
      answered: !!c.answered_at,
      hasAgentLeg: !!c.agent_call_control_id,
    }))

    // ── 24h source mix ───────────────────────────────────────────────────
    const bySource = new Map<string, { dials: number; connects: number }>()
    for (const c of dayRes.data || []) {
      const key = c.dial_source || 'unknown'
      const b = bySource.get(key) || { dials: 0, connects: 0 }
      b.dials++
      if (c.answered_at) b.connects++
      bySource.set(key, b)
    }
    const sourceMix = [...bySource.entries()]
      .map(([source, v]) => ({
        source,
        dials: v.dials,
        connects: v.connects,
        // A dash upstream rather than a fake 0% on a sample too small to mean
        // anything. 20 is low, but this is an operational gauge, not a stat.
        connectRate: v.dials >= 20 ? (v.connects / v.dials) * 100 : null,
      }))
      .sort((a, b) => b.dials - a.dials)

    // ── AMD distribution + recording capture, 7d ─────────────────────────
    const amd = new Map<string, number>()
    let answered = 0
    let answeredWithRecordingId = 0
    let answeredWithAnyRecording = 0

    for (const c of weekRes.data || []) {
      const key = c.amd_result || 'none'
      amd.set(key, (amd.get(key) || 0) + 1)

      if (c.answered_at) {
        answered++
        if (c.recording_id) answeredWithRecordingId++
        if (c.recording_id || c.recording_url) answeredWithAnyRecording++
      }
    }

    // ── WHO IS ACTUALLY DIALING ──────────────────────────────────────────
    // One extra query rather than a join, because dialer_sessions keys on the
    // Clerk id and users is a separate table. Only the ids currently on a
    // session are fetched, which is at most a handful.
    const sessionUserIds = [...new Set(
      (sessionsRes.data || []).map(s => s.user_id).filter(Boolean)
    )]
    const nameById = new Map<string, string>()
    if (sessionUserIds.length > 0) {
      const { data: agentUsers } = await supabase
        .from('users')
        .select('clerk_id, first_name, last_name, email, username')
        .in('clerk_id', sessionUserIds)
      for (const u of agentUsers || []) {
        const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
        // Falls back through the identifiers most likely to be filled in, and
        // only shows the raw id when the user row is genuinely missing.
        nameById.set(u.clerk_id, full || u.username || u.email || u.clerk_id)
      }
    }
    const nameFor = (id: string | null) =>
      (id && nameById.get(id)) || id || 'Unknown'

    const amdTotal = [...amd.values()].reduce((a, b) => a + b, 0)
    const amdDistribution = [...amd.entries()]
      .map(([result, count]) => ({
        result,
        count,
        pct: amdTotal > 0 ? (count / amdTotal) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      concurrency,
      inFlight,
      inFlightCount: inFlight.length,
      sourceMix,
      dialsLast24h: (dayRes.data || []).length,
      amd: {
        distribution: amdDistribution,
        total: amdTotal,
      },
      recordings: {
        answered,
        withRecordingId: answeredWithRecordingId,
        withAnyRecording: answeredWithAnyRecording,
        // The metric that sat near zero for weeks while playback was broken.
        captureRatePct: answered > 0 ? (answeredWithRecordingId / answered) * 100 : null,
      },
      agents: (sessionsRes.data || []).map(s => ({
        id: s.id,
        userId: s.user_id,
        // A Clerk id tells you nothing at a glance. Reading
        // "e060ea9f-433a-4d83..." off a live-ops panel and working out which
        // customer that is defeats the point of a live-ops panel.
        name: nameFor(s.user_id),
        campaignId: s.campaign_id,
        mode: s.dialer_mode,
        state: s.state,
        lastHeartbeatSeconds: Math.round(
          (now - new Date(s.last_heartbeat).getTime()) / 1000
        ),
      })),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/ops-live' })
  }
}
