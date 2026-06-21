import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string | null
    const conferenceSid = formData.get('ConferenceSid') as string | null
    const recordingSid = formData.get('RecordingSid') as string | null
    const recordingUrl = formData.get('RecordingUrl') as string | null
    const recordingStatus = formData.get('RecordingStatus') as string | null
    const recordingDuration = formData.get('RecordingDuration') as string | null
    const accountSid = formData.get('AccountSid') as string | null

    // Log the entire payload so we can see what SignalWire actually sends
    console.log('Recording webhook payload:', Object.fromEntries(formData.entries()))

    // Only act on completed recordings; ignore in-progress / absent
    if (recordingStatus && recordingStatus !== 'completed') {
      console.log(`Ignoring recording status: ${recordingStatus}`)
      return NextResponse.json({ success: true, skipped: true })
    }

    const updates: Record<string, any> = {
      recording_status: recordingStatus || 'completed',
    }
    if (recordingUrl) updates.recording_url = recordingUrl
    if (recordingDuration) updates.recording_duration = parseInt(recordingDuration)

    let matched = false

    // Path 1: direct CallSid match (works for non-conference recordings)
    if (callSid) {
      const { data, error } = await supabaseAdmin
        .from('calls')
        .update(updates)
        .eq('signalwire_call_id', callSid)
        .select('id')

      if (!error && data && data.length > 0) {
        matched = true
        console.log(`Recording matched via CallSid: ${callSid}`)
      }
    }

    // Path 2: conference recording — match through call_rooms table
    // ConferenceSid alone doesn't tell us which call, but the conference name
    // we set was the room name. SignalWire echoes FriendlyName for the conference.
    if (!matched) {
      const friendlyName = formData.get('FriendlyName') as string | null
      const conferenceName = friendlyName || conferenceSid

      if (conferenceName) {
        const { data: room } = await supabaseAdmin
          .from('call_rooms')
          .select('lead_call_sid')
          .eq('room_name', conferenceName)
          .maybeSingle()

        if (room?.lead_call_sid) {
          const { data, error } = await supabaseAdmin
            .from('calls')
            .update(updates)
            .eq('signalwire_call_id', room.lead_call_sid)
            .select('id')

          if (!error && data && data.length > 0) {
            matched = true
            console.log(`Recording matched via room: ${conferenceName} -> ${room.lead_call_sid}`)
          }
        }
      }
    }

    if (!matched) {
      console.warn('Recording webhook did not match any call row', {
        callSid,
        conferenceSid,
        recordingSid,
      })
    }

    return NextResponse.json({ success: true, matched })
  } catch (error: any) {
    console.error('Recording webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}