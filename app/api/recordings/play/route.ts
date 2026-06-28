import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

const supabase = getServiceClient('recordings/play')

// Streams the recording from SignalWire, but only if the requesting user owns it.
// SignalWire recording URLs require Basic Auth, so we proxy + add the auth header here.
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

  // Fetch the recording from SignalWire with project auth
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  if (!projectId || !apiToken) {
    return new Response('SignalWire credentials missing', { status: 500 })
  }

  const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')

  // SignalWire offers .mp3 by appending .mp3 to the recording URL
  const url = call.recording_url.endsWith('.mp3')
    ? call.recording_url
    : `${call.recording_url}.mp3`

  const upstream = await fetch(url, { headers: { Authorization: authHeader } })

  if (!upstream.ok) {
    return new Response(`SignalWire error: ${upstream.status}`, { status: 502 })
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