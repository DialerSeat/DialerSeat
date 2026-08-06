import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { resolvePlayableUrl, streamRecording } from '@/lib/telnyxRecording'

const supabase = getServiceClient('admin/user-data/recordings/play')

// Admin-only: stream/download an arbitrary user's call recording, for the
// Data Explorer's Recordings tab. Mirrors /api/recordings/play (which is
// hard-scoped to the session's own user_id) but authorizes by admin role
// instead of ownership — this route must never be reachable by a regular
// user, since it can fetch any customer's recording.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { searchParams } = new URL(req.url)
  const callId = searchParams.get('call_id')
  const download = searchParams.get('download') === '1'

  if (!callId) {
    return new Response('call_id required', { status: 400 })
  }

  const { data: call, error } = await supabase
    .from('calls')
    .select('id, recording_id, recording_url, call_control_id')
    .eq('id', callId)
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
    return new Response('Recording is no longer available from the carrier', { status: 410 })
  }
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
