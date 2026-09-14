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
//
// ── WHY THE CRITERIA ARE THE SHAPE THEY ARE ─────────────────────────────────
// This first shipped keyed on ONE user id and on talk_seconds, and both were
// wrong in practice.
//
//   One id. A person can hold more than one account — the same agent turned up
//   under two clerk ids, with every recording on the second — so a delete
//   scoped to "the" account silently missed half the audio and reported
//   success. userIds is a list for that reason.
//
//   talk_seconds. "Recordings under thirty seconds" is a statement about the
//   RECORDING, and recording_duration is what the screens show and what Telnyx
//   stores. Those two numbers are not the same: recording starts at bridge and
//   talk is measured from answer. Filtering one while the operator reads the
//   other deletes a different set than the one they were looking at.
//
// Both spellings are still accepted. maxTalkSeconds keeps working for anything
// already calling it, and `all` exists because dead air is dead air at any
// length — asking for a threshold high enough to catch a three-minute
// recording is a worse instruction than saying what you mean.
// =============================================================================

/** Hard ceiling on one call, so a slip cannot empty the archive in one go. */
const MAX_PER_REQUEST = 1000

interface Row {
  id: string
  user_id: string | null
  call_control_id: string | null
  recording_id: string | null
  recording_url: string | null
  recording_duration: number | null
  talk_seconds: number | null
  created_at: string
}

/** Every call still holding audio for these accounts. */
async function rowsFor(userIds: string[]): Promise<Row[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('id, user_id, call_control_id, recording_id, recording_url, recording_duration, talk_seconds, created_at')
    .in('user_id', userIds)
    .or('recording_id.not.is.null,recording_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(MAX_PER_REQUEST)
  if (error) throw error
  return (data || []) as Row[]
}

// ── GET: who has audio, and how much of it is short ─────────────────────────
// So the operator picks a real person off a list instead of pasting a clerk id,
// and sees the count before deciding. Accounts are grouped by NAME, because the
// duplicate-account case is exactly the one that goes wrong unsupervised.
export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const { data: calls, error } = await supabase
      .from('calls')
      .select('user_id, recording_duration')
      .or('recording_id.not.is.null,recording_url.not.is.null')
      .limit(20000)
    if (error) throw error

    const byUser = new Map<string, { recordings: number; under30: number; seconds: number }>()
    for (const c of (calls || []) as Array<{ user_id: string | null; recording_duration: number | null }>) {
      if (!c.user_id) continue
      const row = byUser.get(c.user_id) ?? { recordings: 0, under30: 0, seconds: 0 }
      row.recordings++
      const d = c.recording_duration ?? 0
      row.seconds += d
      if (d < 30) row.under30++
      byUser.set(c.user_id, row)
    }

    const ids = [...byUser.keys()]
    const nameById = new Map<string, string>()
    if (ids.length > 0) {
      const { data: us } = await supabase
        .from('users').select('clerk_id, first_name, last_name, email').in('clerk_id', ids)
      for (const u of (us || []) as Array<{
        clerk_id: string; first_name: string | null; last_name: string | null; email: string | null
      }>) {
        nameById.set(u.clerk_id, [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
          || u.email || u.clerk_id.slice(0, 12))
      }
    }

    // One entry per PERSON, carrying every account they hold.
    const byName = new Map<string, {
      name: string; userIds: string[]; recordings: number; under30: number; seconds: number
    }>()
    for (const [uid, v] of byUser) {
      const name = nameById.get(uid) ?? uid.slice(0, 12)
      const row = byName.get(name) ?? { name, userIds: [], recordings: 0, under30: 0, seconds: 0 }
      row.userIds.push(uid)
      row.recordings += v.recordings
      row.under30 += v.under30
      row.seconds += v.seconds
      byName.set(name, row)
    }

    return NextResponse.json({
      success: true,
      people: [...byName.values()].sort((a, b) => b.recordings - a.recordings),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/recordings/bulk-delete' })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const commit = body?.commit === true

    // One id or several. Both spellings, because the single-id form is what
    // already exists and the list is what the duplicate-account case needs.
    const userIds: string[] = Array.isArray(body?.userIds)
      ? body.userIds.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
      : typeof body?.userId === 'string' && body.userId.length > 0
        ? [body.userId]
        : []

    if (userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds is required. This endpoint never deletes across every account at once.' },
        { status: 400 }
      )
    }

    const all = body?.all === true
    const maxRecordingSeconds = typeof body?.maxRecordingSeconds === 'number'
      && Number.isFinite(body.maxRecordingSeconds) && body.maxRecordingSeconds >= 0
      ? body.maxRecordingSeconds : null
    const maxTalkSeconds = typeof body?.maxTalkSeconds === 'number'
      && Number.isFinite(body.maxTalkSeconds) && body.maxTalkSeconds >= 0
      ? body.maxTalkSeconds : null

    // Exactly one rule, stated explicitly. A request carrying none is a
    // request that forgot to say what it meant, and the generous reading of
    // that is "everything" — which is the one thing it must never assume.
    if (!all && maxRecordingSeconds === null && maxTalkSeconds === null) {
      return NextResponse.json({
        success: false,
        error: 'Say which recordings: maxRecordingSeconds, maxTalkSeconds, or all: true.',
      }, { status: 400 })
    }

    const rows = await rowsFor(userIds)

    // Null is zero seconds of audio, and zero is under any threshold worth
    // setting — so these are filtered here rather than in the query, where
    // `lt` would drop the null rows instead of matching them.
    const targets = all ? rows : rows.filter(r => {
      if (maxRecordingSeconds !== null && (r.recording_duration ?? 0) < maxRecordingSeconds) return true
      if (maxTalkSeconds !== null && (r.talk_seconds ?? 0) < maxTalkSeconds) return true
      return false
    })

    if (!commit) {
      return NextResponse.json({
        success: true,
        preview: true,
        wouldDelete: targets.length,
        leaves: rows.length - targets.length,
        audioSeconds: targets.reduce((n, r) => n + (r.recording_duration ?? 0), 0),
        accounts: userIds.length,
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
      // No key configured means nothing was deleted at Telnyx, only unlinked
      // here — which looks identical on screen and is not the same thing.
      providerSkipped: !apiKey,
      capped: targets.length === MAX_PER_REQUEST,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/recordings/bulk-delete' })
  }
}
