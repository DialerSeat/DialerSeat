import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'
import { sweepTelnyxEvents, TELNYX_EVENT_RETENTION_HOURS } from '@/lib/telnyxIdempotency'
import { hangupCallControlId } from '@/lib/placeOutboundCall'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SESSION_DEAD_HEARTBEAT_MIN = 5  // heartbeat is ~5s; 5min silence = gone

// ── SCHEDULING CONSTRAINT — READ BEFORE CHANGING vercel.json ────────────────
// This route WANTS to run every ~10 minutes: the threshold above is 5 minutes,
// and a wedged agent session blocks that agent from dialing until it's reaped.
// Daily means someone can be stuck for up to 24 hours.
//
// It runs DAILY anyway because Vercel's Hobby plan rejects any sub-daily cron
// at DEPLOY time — "Hobby accounts are limited to daily cron jobs" — which
// fails the whole deployment, not just the cron. A */10 here once blocked a
// release containing everything else.
//
// To get the real cadence back, either move the project to Pro (which allows
// minute granularity) or hit this endpoint from an external scheduler with the
// CRON_SECRET bearer token. Do not reintroduce */10 here while on Hobby.
// ────────────────────────────────────────────────────────────────────────────
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
    let legsHungUp = 0
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
      // ── AND CLOSE THE LEG, NOT JUST THE ROW ──────────────────────────
      // This freed the agent's SESSION and left the call itself running.
      // Clearing current_call_id makes the agent dialable again; it does
      // nothing to the leg, which is still up on the lead's phone with
      // nobody on it. The row said idle and the line said connected.
      //
      // Safe to end here precisely because of the condition that selected
      // these rows: the heartbeat is ~5 seconds and has been silent for
      // SESSION_DEAD_HEARTBEAT_MIN. The browser holding that call is gone,
      // so there is no one left for the hold to protect and nothing to
      // wait for.
      //
      // Best-effort per leg. A hangup that fails — already ended, unknown
      // id — must not stop the rest of the batch being freed, and Telnyx
      // returning "not found" is the ordinary case for a call that closed
      // normally while the row went stale.
      for (const w of wedged) {
        if (!w.current_call_id) continue
        try {
          await hangupCallControlId(w.current_call_id)
          legsHungUp++
        } catch (e: any) {
          console.warn(
            '[reaper] could not hang up wedged leg', w.current_call_id,
            e?.message || e
          )
        }
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

    // Janitorial: the Telnyx webhook dedupe table is a lock, not a log, and
    // takes millions of rows a day at scale. Swept here rather than on its own
    // schedule because this cron already exists for exactly this kind of work
    // and runs often enough that each sweep stays small.
    const dedupeRowsSwept = await sweepTelnyxEvents()

    return NextResponse.json({
      success: true,
      sessionsFreed,
      legsHungUp,
      dedupeRowsSwept,
      thresholds: {
        sessionDeadHeartbeatMin: SESSION_DEAD_HEARTBEAT_MIN,
        telnyxEventRetentionHours: TELNYX_EVENT_RETENTION_HOURS,
      },
    })
  } catch (error) {
    return apiError(error, { route: 'cron/stale-call-reaper' })
  }
}
