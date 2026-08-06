import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { resolvePlayableUrl, streamRecording } from '@/lib/telnyxRecording'

const supabase = getServiceClient('recordings/play')

// =============================================================================
// RECORDINGS PLAY — authenticated stream of a call recording (Telnyx)
// =============================================================================
// Playback resolves a FRESH download URL from calls.recording_id on every
// request. It does not play calls.recording_url: that is a presigned S3 link
// with X-Amz-Expires=600, dead ten minutes after the call. See
// lib/telnyxRecording.ts for the full account of the bug this fixes.
// =============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const callId = searchParams.get('call_id')
  const download = searchParams.get('download') === '1'

  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!callId) {
    return new Response('call_id required', { status: 400 })
  }

  const { data: call, error } = await supabase
    .from('calls')
    .select('id, recording_id, recording_url, call_control_id')
    .eq('id', callId)
    .eq('user_id', userId)
    .single()

  if (error || !call) {
    return new Response('Recording not found', { status: 404 })
  }
  if (!call.recording_id && !call.recording_url) {
    return new Response('No recording for this call', { status: 404 })
  }

  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    return new Response('Telnyx credentials missing', { status: 500 })
  }

  const resolved = await resolvePlayableUrl(call, apiKey)
  if (!resolved) {
    // Telnyx deletes recordings on its own retention schedule, so a row that
    // has no resolvable audio is a real state, not necessarily a fault.
    return new Response('Recording is no longer available from the carrier', { status: 410 })
  }

  // Learned the id off a legacy row — write it back so the next play is one
  // request instead of two.
  if (resolved.discoveredRecordingId) {
    void supabase
      .from('calls')
      .update({ recording_id: resolved.discoveredRecordingId })
      .eq('id', callId)
      .then(undefined, () => {})
  }

  return streamRecording(resolved.url, {
    range: req.headers.get('range'),
    download,
    filename: `dialerseat-${callId}.mp3`,
  })
}
