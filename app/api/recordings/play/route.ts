import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { resolvePlayableUrl, streamRecording } from '@/lib/telnyxRecording'
import { canAccessCall } from '@/lib/teamCallAccess'

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

  // ── A TEAM OWNER MAY PLAY THEIR AGENTS' CALLS ──────────────────────────
  // This was .eq('user_id', userId), so an owner paying for fifteen seats
  // could not play one of them. The row is now fetched without that filter and
  // the decision made explicitly, because the check is an AND of three things
  // a WHERE clause on one column cannot express: the caller owns a team, the
  // call's campaign is attached to it, and the agent is a member of it. See
  // lib/teamCallAccess.ts.
  //
  // user_id and campaign_id are selected purely to feed that check.
  const { data: call, error } = await supabase
    .from('calls')
    .select('id, user_id, campaign_id, recording_id, recording_url, call_control_id')
    .eq('id', callId)
    .single()

  if (error || !call) {
    return new Response('Recording not found', { status: 404 })
  }
  if (!(await canAccessCall(supabase, userId, call))) {
    // 404 rather than 403: a 403 confirms the call exists, which is an
    // existence oracle over every call id on the platform.
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
