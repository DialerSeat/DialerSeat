import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

const supabase = getServiceClient('recordings/play')

// =============================================================================
// RECORDINGS PLAY — authenticated proxy/stream of a call recording (Telnyx)
// =============================================================================
// calls.recording_url now stores a Telnyx download_urls.mp3 link directly
// (written by the call.recording.saved webhook handler in
// app/api/calls/events/route.ts, or by the manual recordings/sync
// backstop) rather than a SignalWire recording SID we'd construct a URL
// from — so this route no longer needs to build the URL itself, just
// fetch whatever's stored.
//
// AUTH ON THE UPSTREAM FETCH: sending our Bearer token on the request to
// Telnyx's download URL, same as every other Telnyx REST call in this
// codebase. Telnyx's own docs weren't unambiguous on whether the
// recording download link is pre-signed/public or requires auth to fetch
// the actual bytes — sending the header is harmless either way (a
// pre-signed URL that doesn't need it will just ignore an extra header),
// and covers the case where it does require it.
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
    .select('*')
    .eq('id', callId)
    .eq('user_id', userId)
    .single()

  if (error || !call) {
    return new Response('Recording not found', { status: 404 })
  }
  if (!call.recording_url) {
    return new Response('No recording for this call', { status: 404 })
  }

  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    return new Response('Telnyx credentials missing', { status: 500 })
  }

  const upstream = await fetch(call.recording_url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!upstream.ok) {
    return new Response(`Telnyx error: ${upstream.status}`, { status: 502 })
  }

  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
    'Cache-Control': 'private, max-age=3600',
  }
  if (download) {
    const filename = `dialerseat-${callId}.mp3`
    headers['Content-Disposition'] = `attachment; filename="${filename}"`
  }

  return new Response(upstream.body, { status: 200, headers })
}
