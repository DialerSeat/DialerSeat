import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// SignalWire conference-recording webhook
// Possible fields it may send:
//   RecordingUrl, RecordingDuration, RecordingSid, RecordingStatus
//   AccountSid, CallSid (sometimes empty for conference recordings)
//   ConferenceSid, FriendlyName (the conference name = our room name)
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    for (const [k, v] of formData.entries()) {
      params[k] = String(v)
    }
    console.log('Recording webhook FULL payload:', JSON.stringify(params, null, 2))

    const recordingUrl = params.RecordingUrl
    const recordingDuration = parseInt(params.RecordingDuration || '0', 10)
    const callSid = params.CallSid
    const conferenceSid = params.ConferenceSid
    const friendlyName = params.FriendlyName // = our room_name when conference-recording
    const recordingStatus = params.RecordingStatus

    if (!recordingUrl) {
      console.warn('Recording webhook: no RecordingUrl, ignoring')
      return NextResponse.json({ success: false, error: 'Missing RecordingUrl' }, { status: 400 })
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    let matchedCall: any = null
    let matchStrategy = 'none'

    // STRATEGY 1: match by signalwire_call_id if CallSid was provided
    if (callSid) {
      const { data } = await supabase
        .from('calls')
        .select('*')
        .eq('signalwire_call_id', callSid)
        .single()
      if (data) {
        matchedCall = data
        matchStrategy = 'callsid'
      }
    }

    // STRATEGY 2: match by room_name (FriendlyName) -> call_rooms -> recent call by user
    if (!matchedCall && friendlyName) {
      const { data: room } = await supabase
        .from('call_rooms')
        .select('*')
        .eq('room_name', friendlyName)
        .single()

      if (room) {
        // Look up call by lead_call_sid first
        if (room.lead_call_sid) {
          const { data: callBySid } = await supabase
            .from('calls')
            .select('*')
            .eq('signalwire_call_id', room.lead_call_sid)
            .single()
          if (callBySid) {
            matchedCall = callBySid
            matchStrategy = 'room->lead_call_sid'
          }
        }

        // Otherwise grab the most-recent call by this user near the room creation time
        if (!matchedCall) {
          const roomTime = new Date(room.created_at).getTime()
          const windowStart = new Date(roomTime - 60_000).toISOString()
          const windowEnd = new Date(roomTime + 5 * 60_000).toISOString()
          const { data: recentCall } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', room.user_id)
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (recentCall) {
            matchedCall = recentCall
            matchStrategy = 'room->user+timewindow'
          }
        }
      }
    }

    if (!matchedCall) {
      console.warn(
        'Recording could not be matched. CallSid:', callSid,
        'ConferenceSid:', conferenceSid,
        'FriendlyName:', friendlyName,
      )
      return NextResponse.json({
        success: false,
        error: 'No matching call row',
        searched: { callSid, conferenceSid, friendlyName }
      })
    }

    const { error: updateErr } = await supabase
      .from('calls')
      .update({
        recording_url: recordingUrl,
        recording_duration: recordingDuration,
        recording_status: recordingStatus || 'completed',
        recording_expires_at: expiresAt,
        // ALSO store the signalwire_call_id if it was missing — helps future lookups
        ...(matchedCall.signalwire_call_id ? {} : { signalwire_call_id: callSid || conferenceSid }),
      })
      .eq('id', matchedCall.id)

    if (updateErr) {
      console.error('Update failed:', updateErr)
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    console.log(`Recording linked via ${matchStrategy} to call ${matchedCall.id}`)
    return NextResponse.json({ success: true, strategy: matchStrategy, callId: matchedCall.id })
  } catch (err: any) {
    console.error('Recording webhook error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}