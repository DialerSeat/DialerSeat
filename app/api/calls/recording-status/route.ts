import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// SignalWire POSTs here when a recording is ready.
// Form-encoded body. Key fields: RecordingUrl, RecordingDuration, CallSid, ConferenceSid, RecordingSid, RecordingStatus
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const params: Record<string, string> = {}
    for (const [k, v] of formData.entries()) {
      params[k] = String(v)
    }
    console.log('Recording webhook received:', params)

    const recordingUrl = params.RecordingUrl
    const recordingDuration = parseInt(params.RecordingDuration || '0', 10)
    const callSid = params.CallSid
    const conferenceSid = params.ConferenceSid
    const recordingStatus = params.RecordingStatus

    if (!recordingUrl) {
      return NextResponse.json({ success: false, error: 'Missing RecordingUrl' }, { status: 400 })
    }

    // Try to find the call this recording belongs to.
    // Strategy: signalwire_call_id matches the parent call_sid (lead call).
    // If we can't find it, try call_rooms table to map conferenceSid -> user_id.

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Update by call_sid first (most reliable)
    let updated = false
    if (callSid) {
      const { data, error } = await supabase
        .from('calls')
        .update({
          recording_url: recordingUrl,
          recording_duration: recordingDuration,
          recording_status: recordingStatus || 'completed',
          recording_expires_at: expiresAt,
        })
        .eq('signalwire_call_id', callSid)
        .select()

      if (!error && data && data.length > 0) {
        updated = true
        console.log('Recording linked via signalwire_call_id:', callSid)
      }
    }

    // Fall back: store as orphan recording for manual repair if no match
    if (!updated) {
      console.warn('Recording could not be matched to a call. CallSid:', callSid, 'ConferenceSid:', conferenceSid)
      // Try to find via call_rooms if we tracked the room
      try {
        if (conferenceSid) {
          const { data: room } = await supabase
            .from('call_rooms')
            .select('*')
            .eq('lead_call_sid', callSid)
            .single()

          if (room) {
            await supabase.from('orphan_recordings').insert({
              recording_url: recordingUrl,
              recording_duration: recordingDuration,
              call_sid: callSid,
              conference_sid: conferenceSid,
              user_id: room.user_id,
              expires_at: expiresAt,
            })
          }
        }
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Recording webhook error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}