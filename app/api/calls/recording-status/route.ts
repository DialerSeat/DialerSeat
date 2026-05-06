import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const recordingSid = formData.get('RecordingSid') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    const recordingStatus = formData.get('RecordingStatus') as string
    const recordingDuration = formData.get('RecordingDuration') as string

    console.log('Recording status update:', {
      callSid,
      recordingSid,
      recordingUrl,
      recordingStatus,
      recordingDuration,
    })

    if (!callSid) {
      return NextResponse.json({ success: true })
    }

    // SignalWire fires this webhook with status 'completed' when the recording
    // is ready. URL points at their CDN; the existing /api/recordings/play
    // proxy reads it with project-level auth headers.
    const updates: Record<string, any> = {
      recording_status: recordingStatus || 'completed',
    }

    if (recordingUrl) {
      // SignalWire's RecordingUrl is the base; .mp3 gets appended for playback
      updates.recording_url = recordingUrl
    }

    if (recordingDuration) {
      updates.recording_duration = parseInt(recordingDuration)
    }

    await supabaseAdmin
      .from('calls')
      .update(updates)
      .eq('signalwire_call_id', callSid)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Recording webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}