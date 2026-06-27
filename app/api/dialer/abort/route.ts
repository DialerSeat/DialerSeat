import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// =============================================================================
// /api/dialer/abort — HARD SERVER-SIDE SHUTDOWN for one agent
// =============================================================================
// When the agent hits ABORT/TERMINATE, the client tears down what it can, but
// it cannot silence calls it doesn't have SIDs for — e.g. a predictive/auto
// dial that was placed server-side and is now being ANSWERED in the background
// (the "numbers making noise after I aborted" bug). This endpoint is the
// server's half of the kill switch:
//
//   1. Find every recent call_room for this user (last few minutes) and hang up
//      BOTH legs (lead + agent) via SignalWire. This stops in-flight ringing and
//      already-answered background calls.
//   2. Release every lead this agent's sessions have claimed, so the controller
//      doesn't think work is still in progress and the leads return to the pool.
//   3. Mark the agent's sessions paused so the heartbeat controller won't
//      immediately re-fill on the next beat.
//
// Idempotent and best-effort: every step is wrapped so a single failure can't
// block the others. Returns counts for observability.
// =============================================================================

const LOOKBACK_MINUTES = 10

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
    // SignalWire returns 200 on success; a call that's already gone may 404 —
    // treat that as fine (it's already not ringing).
    return res.ok || res.status === 404
  } catch (e) {
    console.error('[abort] hangup failed for sid', sid, e)
    return false
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let hungUp = 0
    let claimsReleased = 0

    // ── 1. Hang up both legs of every recent call_room for this user ──────────
    const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()
    const { data: rooms, error: roomErr } = await supabase
      .from('call_rooms')
      .select('lead_call_sid, agent_call_sid')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
    if (roomErr) {
      console.error('[abort] call_rooms lookup failed:', roomErr)
    }

    const sids = new Set<string>()
    for (const r of rooms || []) {
      if (r.lead_call_sid) sids.add(r.lead_call_sid)
      if (r.agent_call_sid) sids.add(r.agent_call_sid)
    }
    // Hang them up in parallel; each is best-effort.
    const results = await Promise.all([...sids].map(hangupSid))
    hungUp = results.filter(Boolean).length

    // ── 2. Release this agent's claimed leads ────────────────────────────────
    // Find the agent's session ids, then clear claims tied to them so the
    // controller stops treating those leads as in-flight.
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
      if (relErr) {
        console.error('[abort] lead claim release failed:', relErr)
      } else {
        claimsReleased = released?.length || 0
      }
    }

    // ── 3. Pause the agent's sessions so the controller won't re-fill ─────────
    const { error: pauseErr } = await supabase
      .from('agent_sessions')
      .update({ state: 'paused', current_call_id: null })
      .eq('user_id', userId)
    if (pauseErr) {
      console.error('[abort] session pause failed:', pauseErr)
    }

    return NextResponse.json({ success: true, hungUp, claimsReleased })
  } catch (error: any) {
    console.error('[abort] unexpected error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
