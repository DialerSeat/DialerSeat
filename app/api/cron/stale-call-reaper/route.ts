import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SESSION_DEAD_HEARTBEAT_MIN = 5  // heartbeat is ~5s; 5min silence = gone
const BATCH_LIMIT = 500

// =============================================================================
// STALE-CALL REAPER — Telnyx: room-reaping half removed
// =============================================================================
// This cron used to do two jobs: reap stale call_rooms rows, and free
// agent_sessions stuck with a current_call_id pointing at a call that's
// long over. Under the direct-bridge Telnyx architecture (no conference,
// no call_rooms — see TELNYX-MIGRATION-DESIGN.md), call_rooms is never
// written to at all, so that half of this job would always find zero rows
// — dead code, removed. The wedged-session half is still very much
// needed (this is exactly the "agent stuck marked on_call forever after a
// webhook was missed" failure mode) and is unchanged below.
// =============================================================================

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/stale-call-reaper')

    const sessionCutoff = new Date(Date.now() - SESSION_DEAD_HEARTBEAT_MIN * 60_000).toISOString()

    const { data: wedged, error: sessErr } = await db
      .from('agent_sessions')
      .select('id, user_id, current_call_id, last_heartbeat')
      .not('current_call_id', 'is', null)
      .lt('last_heartbeat', sessionCutoff)
      .limit(BATCH_LIMIT)

    if (sessErr) {
      console.error('[reaper] wedged-session lookup failed:', sessErr.message)
    }

    let sessionsFreed = 0
    if (wedged && wedged.length > 0) {
      for (const s of wedged) {
        await logCallEvent({
          event_type: 'reaped',
          call_id: s.current_call_id ?? null,
          source: 'reaper',
          detail: {
            kind: 'wedged_session',
            session_id: s.id,
            dead_heartbeat_minutes: Math.round((Date.now() - new Date(s.last_heartbeat).getTime()) / 60000),
          },
        })
      }
      const ids = wedged.map(s => s.id)
      const { error: updErr, count } = await db
        .from('agent_sessions')
        .update({ current_call_id: null, state: 'idle' }, { count: 'exact' })
        .in('id', ids)
      if (updErr) {
        console.error('[reaper] failed to free wedged sessions:', updErr.message)
      } else {
        sessionsFreed = count ?? ids.length
      }
    }

    return NextResponse.json({
      success: true,
      sessionsFreed,
      thresholds: { sessionDeadHeartbeatMin: SESSION_DEAD_HEARTBEAT_MIN },
    })
  } catch (error) {
    return apiError(error, { route: 'cron/stale-call-reaper' })
  }
}
