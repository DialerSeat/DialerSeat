import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { deleteTelnyxRecording } from '@/lib/telnyxRecording'

const supabase = getServiceClient('recordings/delete')

// =============================================================================
// RECORDINGS DELETE (Telnyx)
// =============================================================================
// This route used to be able to clear only OUR OWN reference: Telnyx's
// recording id, needed for DELETE /v2/recordings/{id}, is a separate field on
// the call.recording.saved webhook and appears nowhere in the download URL,
// which is an S3 link. The code tried to regex an id out of that URL anyway.
// It never matched, so the underlying audio stayed on Telnyx forever while
// the UI reported the recording deleted.
//
// calls.recording_id now stores that id, so the delete is real on both sides.
// A user who deletes a recording gets it deleted.
// =============================================================================

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { call_id } = await req.json()
    if (!call_id) {
      return NextResponse.json({ success: false, error: 'Missing call_id' }, { status: 400 })
    }

    const { data: call, error: fetchErr } = await supabase
      .from('calls')
      .select('id, user_id, recording_id, recording_url, call_control_id')
      .eq('id', call_id)
      .maybeSingle()

    if (fetchErr || !call) {
      return NextResponse.json({ success: false, error: 'Recording not found' }, { status: 404 })
    }

    if (call.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Provider-side delete, by calls.recording_id. This is a real delete
    // now: the old version regexed an id out of recording_url, which is an
    // S3 link containing no id, so "delete" only ever cleared our own row
    // while the audio stayed on Telnyx. A user who deletes a recording is
    // asking for it to be gone.
    const apiKey = process.env.TELNYX_API_KEY
    if (apiKey) {
      const gone = await deleteTelnyxRecording(call, apiKey)
      if (!gone) {
        console.warn(`[recordings/delete] Telnyx-side delete did not confirm for call ${call_id}`)
      }
    }

    const { error: updateErr } = await supabase
      .from('calls')
      .update({
        recording_url: null,
        recording_id: null,
        recording_status: 'deleted',
        recording_duration: 0,
        recording_expires_at: null,
      })
      .eq('id', call_id)

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete recording error:', error)
    return apiError(error, { route: 'recordings/delete' })
  }
}
