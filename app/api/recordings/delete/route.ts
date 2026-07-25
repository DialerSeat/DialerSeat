import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('recordings/delete')

// =============================================================================
// RECORDINGS DELETE (Telnyx)
// =============================================================================
// WHAT'S DIFFERENT FROM THE SIGNALWIRE VERSION: SignalWire's recording SID
// was embeddable in the URL path itself
// (.../Recordings/{sid}) and trivially regex-extractable to build a DELETE
// request. Telnyx's recording id (needed for DELETE /v2/recordings/{id})
// is a SEPARATE field on the call.recording.saved webhook
// (payload.recording_id) — it does not appear anywhere in the
// download_urls themselves, so it can't be recovered from the stored URL
// alone.
//
// We do NOT add a new column to store it (per instruction to keep the
// shared schema as-is beyond the one recording_enabled migration already
// on the table). Practical effect: this route reliably clears OUR OWN
// reference to the recording (which is what actually matters for the
// user — the recording disappears from their Recordings page and stops
// being playable through us) but can't always also delete the underlying
// file from Telnyx's storage, since we may not have the id to target.
//
// This is a real, known limitation — flagging it plainly rather than
// silently no-op'ing: if deleting the underlying file at Telnyx is a hard
// requirement (e.g. for compliance/retention reasons), the fix is to
// capture payload.recording_id in the call.recording.saved handler
// (app/api/calls/events/route.ts) and store it — which does need a small
// column addition when that's actually wanted. Until then, this route
// does the best it safely can with the existing schema.
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
      .select('id, user_id, recording_url, signalwire_call_id')
      .eq('id', call_id)
      .maybeSingle()

    if (fetchErr || !call) {
      return NextResponse.json({ success: false, error: 'Recording not found' }, { status: 404 })
    }

    if (call.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Best-effort provider-side delete: only possible if the id happens to
    // be present in the stored URL path (it generally won't be for
    // Telnyx's S3-backed URLs — see header comment). Attempted anyway in
    // case a future storage/webhook change makes it recoverable; failure
    // here never blocks clearing our own reference below.
    if (call.recording_url) {
      try {
        const apiKey = process.env.TELNYX_API_KEY
        const match = call.recording_url.match(/\/recordings\/([A-Za-z0-9-]+)/i)
        const recordingId = match?.[1]

        if (apiKey && recordingId) {
          const delRes = await fetch(`https://api.telnyx.com/v2/recordings/${recordingId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (!delRes.ok) {
            console.warn('Telnyx recording delete failed:', delRes.status, await delRes.text())
          } else {
            console.log('Deleted recording from Telnyx:', recordingId)
          }
        }
      } catch (e) {
        console.warn('Telnyx recording delete error (continuing):', e)
      }
    }

    const { error: updateErr } = await supabase
      .from('calls')
      .update({
        recording_url: null,
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
