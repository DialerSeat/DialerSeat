import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('recordings/sync')

// =============================================================================
// RECORDINGS SYNC — manual backfill/reconcile tool (Telnyx)
// =============================================================================
// Under the live call flow, app/api/calls/events/route.ts's
// call.recording.saved handler already writes recording_url the moment a
// recording finishes — this route is a manual backstop for anything that
// slipped through (a missed webhook delivery, a call that predates the
// webhook being configured, etc.), not something the live flow depends on.
//
// SIMPLER THAN THE OLD SIGNALWIRE VERSION: that version needed a 3-tier
// fallback match (direct CallSid -> call_rooms lookup -> time-window
// heuristic) because conference recordings had no direct call SID to
// match against. Telnyx's /v2/recordings response includes
// call_control_id directly on every recording — the same identifier
// stored in calls.call_control_id — so matching is always direct. No
// call_rooms table, no time-window guessing.
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Telnyx credentials missing' }, { status: 500 })
    }

    // Pull this user's recent calls that are still missing a recording_url
    // — no point paging through Telnyx's whole recordings list otherwise.
    const { data: pendingCallsRaw } = await supabase
      .from('calls')
      .select('id, call_control_id')
      .eq('user_id', userId)
      .is('recording_url', null)
      .not('call_control_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    const pendingCalls = (pendingCallsRaw || []) as Array<{ id: string; call_control_id: string }>

    if (!pendingCalls || pendingCalls.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No calls pending a recording' })
    }

    let synced = 0
    let notFound = 0

    // Telnyx's list-recordings filter is by call_leg_id, not
    // call_control_id — we only stored call_control_id (see
    // placeOutboundCall.ts's comment on why). Fetch each recording
    // directly isn't possible without knowing the recording's own id
    // either, so instead we page through /v2/recordings filtered by
    // created_at recency and match call_control_id client-side. This is
    // a manual/occasional tool, not hot-path code, so the extra request
    // volume here is an acceptable tradeoff for staying correct without
    // needing to store call_leg_id as well.
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const pendingIds = new Set(pendingCalls.map(c => c.call_control_id))
    const callByControlId = new Map(pendingCalls.map(c => [c.call_control_id, c]))

    let page = 1
    let matched = 0
    const maxPages = 10 // 10 * 250 = 2500 recordings scanned, generous ceiling for a manual tool

    while (page <= maxPages && matched < pendingIds.size) {
      const params = new URLSearchParams({
        'filter[created_at][gte]': sinceIso,
        'page[size]': '250',
        'page[number]': String(page),
      })
      const res = await fetch(`https://api.telnyx.com/v2/recordings?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ success: false, error: `Provider error ${res.status}: ${text}` }, { status: 500 })
      }
      const json = await res.json()
      const recordings: Array<{
        call_control_id?: string
        download_urls?: { mp3?: string; wav?: string }
        duration_millis?: number
        status?: string
      }> = json.data || []

      if (recordings.length === 0) break

      for (const rec of recordings) {
        if (!rec.call_control_id || !callByControlId.has(rec.call_control_id)) continue
        if (rec.status !== 'completed') continue

        const call = callByControlId.get(rec.call_control_id)!
        const recordingUrl = rec.download_urls?.mp3 || rec.download_urls?.wav
        if (!recordingUrl) continue

        const { error: updateErr } = await supabase
          .from('calls')
          .update({
            recording_url: recordingUrl,
            recording_duration: Math.round((rec.duration_millis || 0) / 1000),
            recording_status: 'completed',
            recording_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', call.id)

        if (updateErr) {
          console.warn(`[recordings/sync] failed to update call ${call.id}:`, updateErr)
        } else {
          synced++
        }
        matched++
        callByControlId.delete(rec.call_control_id)
      }

      page++
    }

    notFound = pendingIds.size - synced

    return NextResponse.json({
      success: true,
      synced,
      notFound,
      totalPending: pendingIds.size,
    })
  } catch (err: any) {
    console.error('Sync error:', err)
    return apiError(err, { route: 'recordings/sync' })
  }
}
