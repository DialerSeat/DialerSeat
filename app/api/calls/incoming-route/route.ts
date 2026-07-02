import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('calls/incoming-route')

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ incoming: false, reason: 'no user row' })
    }

    const { data: session } = await supabase
      .from('agent_sessions')
      .select('id, current_call_id, state, dialer_mode, campaign_id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ incoming: false, reason: 'no session' })
    }

    if (!session.current_call_id) {
      return NextResponse.json({
        incoming: false,
        session_state: session.state,
        session_id: session.id,
      })
    }

    const { data: call } = await supabase
      .from('calls')
      .select('id, signalwire_call_id, lead_id, phone_number, created_at, was_abandoned, disposition')
      .eq('id', session.current_call_id)
      .maybeSingle()

    if (!call) {

      console.warn(`[incoming-route] session ${session.id} has current_call_id=${session.current_call_id} but no call row`)
      try {
        await supabase
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', session.id)
      } catch {}
      return NextResponse.json({ incoming: false, reason: 'stale current_call_id cleared' })
    }

    if (call.disposition || call.was_abandoned) {
      try {
        await supabase
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', session.id)
      } catch {}
      return NextResponse.json({
        incoming: false,
        reason: `call already ${call.disposition ? 'dispositioned' : 'abandoned'}`,
      })
    }

    let lead: any = null
    if (call.lead_id) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, city, state, campaign_id, dial_attempts, extra_data')
        .eq('id', call.lead_id)
        .maybeSingle()
      if (leadRow) lead = leadRow
    }

    let roomName: string | null = null
    try {
      const { data: room } = await supabase
        .from('call_rooms')
        .select('room_name')
        .eq('lead_call_sid', call.signalwire_call_id)
        .maybeSingle()
      if (room) roomName = room.room_name
    } catch {}

    return NextResponse.json({
      incoming: true,
      call: {
        id: call.id,
        sid: call.signalwire_call_id,
        lead_id: call.lead_id,
        phone_number: call.phone_number,
        started_at: call.created_at,
        room_name: roomName,
      },
      lead,
      session_id: session.id,
    })
  } catch (err: unknown) {
    console.error('[incoming-route] unhandled', err)
    return NextResponse.json({ incoming: false, error: 'server error' }, { status: 500 })
  }
}