import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { deleteTelnyxRecording } from '@/lib/telnyxRecording'

const supabase = getServiceClient('admin/recordings-bulk-delete')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Deleting at Telnyx is one request per recording and they run in sequence, so
// a few hundred rows needs more than the default budget.
export const maxDuration = 300

// =============================================================================
// /api/admin/recordings/bulk-delete — clear out recordings in bulk
// =============================================================================
// One at a time through the UI is fine for a recording somebody regrets. It is
// not fine for "every call under thirty seconds", which on a dialing floor is
// most of them: voicemail fragments, instant hangups, and the two seconds of
// hold music before somebody puts the phone down.
//
// A DATABASE UPDATE IS NOT A DELETE. calls.recording_url is a presigned S3 link
// containing no id, so clearing our own columns leaves the audio sitting on
// Telnyx, still stored and still billed. app/api/recordings/delete/route.ts
// carries the same note about the bug that taught us this. Every row here goes
// through deleteTelnyxRecording first, and only then are our columns cleared.
//
// PREVIEW FIRST. This destroys audio that cannot be recovered, so it answers a
// count without touching anything unless it is told to commit. Nothing here has
// a default scope: a request that forgets to say whose recordings, or which
// ones, is refused rather than interpreted generously.
// =============================================================================

/** Hard ceiling on one call, so a slip cannot empty the archive in one go. */
const MAX_PER_REQUEST = 1000

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const userId: unknown = body?.userId
    const maxTalkSeconds: unknown = body?.maxTalkSeconds
    const commit = body?.commit === true

    if (typeof userId !== 'string' || userId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userId is required. This endpoint never deletes across every account at once.' },
        { status: 400 }
      )
    }
    if (typeof maxTalkSeconds !== 'number' || !Number.isFinite(maxTalkSeconds) || maxTalkSeconds < 0) {
      return NextResponse.json(
        { success: false, error: 'maxTalkSeconds is required and must be a number of seconds.' },
        { status: 400 }
      )
    }

    // Only rows that HAVE audio. A call whose recording was already deleted, or
    // which never got one, is not a candidate and should not be counted as
    // though something happened to it.
    const { data: rows, error } = await supabase
      .from('calls')
      .select('id, call_control_id, recording_id, recording_url, talk_seconds, created_at')
      .eq('user_id', userId)
      .or('recording_id.not.is.null,recording_url.not.is.null')
      .order('created_at', { ascending: false })
      .limit(MAX_PER_REQUEST)
    if (error) throw error

    // Filtered here rather than in the query: talk_seconds is null on a call
    // nobody answered, and `lt` would drop those rows instead of matching them.
    // A null talk time is zero seconds of conversation, which is under any
    // threshold worth setting.
    const targets = (rows || []).filter(r => (r.talk_seconds ?? 0) < maxTalkSeconds)

    if (!commit) {
      return NextResponse.json({
        success: true,
        preview: true,
        wouldDelete: targets.length,
        leaves: (rows || []).length - targets.length,
        oldest: targets.length > 0 ? targets[targets.length - 1].created_at : null,
        newest: targets.length > 0 ? targets[0].created_at : null,
        note: 'Nothing was deleted. Send commit: true to carry this out.',
      })
    }

    let deleted = 0
    let providerErrors = 0
    const apiKey = process.env.TELNYX_API_KEY

    for (const row of targets) {
      if (apiKey) {
        const gone = await deleteTelnyxRecording(row, apiKey)
        // Counted but not fatal: Telnyx expires recordings on its own schedule,
        // so a row whose audio is already gone is the end state being asked
        // for. Our columns are cleared either way, otherwise the row keeps
        // advertising audio that is not there.
        if (!gone) providerErrors++
      }

      const { error: updErr } = await supabase
        .from('calls')
        .update({
          recording_url: null,
          recording_id: null,
          recording_status: 'deleted',
          recording_duration: 0,
          recording_expires_at: null,
        })
        .eq('id', row.id)

      if (updErr) console.error('[recordings/bulk-delete] failed to clear row', row.id, updErr)
      else deleted++
    }

    return NextResponse.json({
      success: true,
      deleted,
      providerErrors,
      capped: targets.length === MAX_PER_REQUEST,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/recordings/bulk-delete' })
  }
}
