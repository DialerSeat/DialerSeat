import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

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
    .select('*')
    .eq('id', callId)
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
