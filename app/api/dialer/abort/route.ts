import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError, apiUnauthorized } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('dialer/abort')

// =============================================================================
// /api/dialer/abort — HARD SERVER-SIDE SHUTDOWN for one agent (ALL modes)
// =============================================================================
// ABORT must INSTANTLY terminate every call in process for this agent, in every
// dialer mode (preview, power, progressive, predictive). The client tears down
// what it can, but it cannot silence calls it has no SID for — predictive/auto
// dials placed server-side and answered in the background. This endpoint is the
// server half of the kill switch and sweeps TWO sources so nothing slips the net:
//
//   A. call_rooms  — both legs (lead + agent) of every recent room for the user.
//   B. calls       — every recent calls row with a signalwire_call_id for the
//                    user. This catches calls that were PLACED (calls row +
//                    SID exist) but whose call_rooms row hasn't been written yet
//                    — the race that progressive/predictive can hit. Every mode
//                    writes a calls row with the SID, so this covers them all.
//
// Hanging up an already-finished call is a harmless 404 (treated as success).
// Then: release this agent's lead claims and pause their sessions so the
// controller can't immediately re-fill. Best-effort + idempotent throughout.
// =============================================================================

const LOOKBACK_MINUTES = 15

async function hangupSid(sid: string): Promise<boolean> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  if (!spaceUrl || !projectId || !apiToken || !sid) return false
  try {
    const res = await fetch(
      `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${sid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }).toString(),
      }
    )
    // 200 = hung up; 404 = already gone (fine). Both count as "no longer ringing".
    return res.ok || res.status === 404
  } catch (e) {
    console.error('[abort] hangup failed for sid', sid, e)
    return false
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return apiUnauthorized()

    const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()

    // ── Gather every SID to kill, from BOTH sources, in parallel ─────────────
    const [roomsRes, callsRes] = await Promise.all([
      supabase
        .from('call_rooms')
        .select('lead_call_sid, agent_call_sid')
        .eq('user_id', userId)
        .gte('created_at', sinceIso),
      supabase
        .from('calls')
        .select('signalwire_call_id')
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
        .not('signalwire_call_id', 'is', null),
    ])

    if (roomsRes.error) console.error('[abort] call_rooms lookup failed:', roomsRes.error)
    if (callsRes.error) console.error('[abort] calls lookup failed:', callsRes.error)

    const sids = new Set<string>()
    for (const r of roomsRes.data || []) {
      if (r.lead_call_sid) sids.add(r.lead_call_sid)
      if (r.agent_call_sid) sids.add(r.agent_call_sid)
    }
    for (const c of callsRes.data || []) {
      if (c.signalwire_call_id) sids.add(c.signalwire_call_id)
    }

    // Hang them ALL up in parallel — instant, not sequential.
    const results = await Promise.all([...sids].map(hangupSid))
    const hungUp = results.filter(Boolean).length

    // ── Release this agent's claimed leads ───────────────────────────────────
    let claimsReleased = 0
    const { data: sessions } = await supabase
      .from('agent_sessions')
      .select('id')
      .eq('user_id', userId)
    const sessionIds = (sessions || []).map(s => s.id).filter(Boolean)
    if (sessionIds.length > 0) {
      const { data: released, error: relErr } = await supabase
        .from('leads')
        .update({ claimed_at: null, claimed_by_session_id: null })
        .in('claimed_by_session_id', sessionIds)
        .select('id')
      if (relErr) console.error('[abort] lead claim release failed:', relErr)
      else claimsReleased = released?.length || 0
    }

    // ── Pause the agent's sessions so the controller won't re-fill ───────────
    const { error: pauseErr } = await supabase
      .from('agent_sessions')
      .update({ state: 'paused', current_call_id: null })
      .eq('user_id', userId)
    if (pauseErr) console.error('[abort] session pause failed:', pauseErr)

    return NextResponse.json({ success: true, hungUp, sidsFound: sids.size, claimsReleased })
  } catch (error) {
    return apiError(error, { route: 'dialer/abort' })
  }
}
