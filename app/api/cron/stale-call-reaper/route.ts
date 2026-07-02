import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROOM_STALE_MINUTES = 120        // 2h — far beyond any real call
const SESSION_DEAD_HEARTBEAT_MIN = 5  // heartbeat is ~5s; 5min silence = gone
const BATCH_LIMIT = 500

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/stale-call-reaper')

    const roomCutoff = new Date(Date.now() - ROOM_STALE_MINUTES * 60_000).toISOString()
    const sessionCutoff = new Date(Date.now() - SESSION_DEAD_HEARTBEAT_MIN * 60_000).toISOString()

    const { data: staleRooms, error: roomErr } = await db
      .from('call_rooms')
      .select('room_name, user_id, phone_number, lead_call_sid, agent_call_sid, created_at')
      .lt('created_at', roomCutoff)
      .limit(BATCH_LIMIT)

    if (roomErr) return apiError(roomErr, { route: 'cron/stale-call-reaper' })

    let roomsReaped = 0
    if (staleRooms && staleRooms.length > 0) {

      for (const r of staleRooms) {
        await logCallEvent({
          event_type: 'reaped',
          signalwire_call_id: r.lead_call_sid ?? r.agent_call_sid ?? null,
          user_id: r.user_id ?? null,
          source: 'reaper',
          detail: {
            kind: 'call_room',
            room_name: r.room_name,
            phone_number: r.phone_number,
            age_minutes: Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000),
          },
        })
      }
      const roomNames = staleRooms.map(r => r.room_name).filter(Boolean)
      const { error: delErr, count } = await db
        .from('call_rooms')
        .delete({ count: 'exact' })
        .in('room_name', roomNames)
      if (delErr) {
        console.error('[reaper] failed to delete stale rooms:', delErr.message)
      } else {
        roomsReaped = count ?? roomNames.length
      }
    }

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
      roomsReaped,
      sessionsFreed,
      thresholds: { roomStaleMinutes: ROOM_STALE_MINUTES, sessionDeadHeartbeatMin: SESSION_DEAD_HEARTBEAT_MIN },
    })
  } catch (error) {
    return apiError(error, { route: 'cron/stale-call-reaper' })
  }
}
