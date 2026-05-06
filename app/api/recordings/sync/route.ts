import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Manually polls SignalWire for the user's recordings and back-fills the calls table.
// Triggered when the user opens the recordings page or hits a "sync" button.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN

    if (!spaceUrl || !projectId || !apiToken) {
      return NextResponse.json({ success: false, error: 'Telephony credentials missing' }, { status: 500 })
    }

    const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')

    // Fetch the user's call_rooms (so we can map recordings -> users via room/conference)
    const { data: rooms } = await supabase
      .from('call_rooms')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No call rooms found' })
    }

    // Fetch ALL recent recordings from SignalWire
    const recsUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings.json?PageSize=200`
    const recsRes = await fetch(recsUrl, { headers: { Authorization: authHeader } })

    if (!recsRes.ok) {
      const text = await recsRes.text()
      return NextResponse.json({ success: false, error: `Provider error ${recsRes.status}: ${text}` }, { status: 500 })
    }

    const recsJson = await recsRes.json()
    const recordings = recsJson.recordings || []

    let synced = 0
    let skipped = 0
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    for (const rec of recordings) {
      const recCallSid: string | null = rec.call_sid || null
      const recDuration = parseInt(rec.duration || '0', 10)
      const recUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings/${rec.sid}`

      // Strategy 1: match by call_sid directly on the calls table
      let matched: any = null

      if (recCallSid) {
        // CRITICAL FIX: was .single() — that throws when no row found.
        // Now using .maybeSingle() which returns null cleanly.
        const { data } = await supabase
          .from('calls')
          .select('*')
          .eq('signalwire_call_id', recCallSid)
          .eq('user_id', userId)
          .maybeSingle()
        if (data) matched = data
      }

      // Strategy 2: match through call_rooms.lead_call_sid -> nearby calls
      if (!matched && recCallSid) {
        const { data: room } = await supabase
          .from('call_rooms')
          .select('*')
          .eq('lead_call_sid', recCallSid)
          .eq('user_id', userId)
          .maybeSingle()

        if (room) {
          const roomTime = new Date(room.created_at).getTime()
          const windowStart = new Date(roomTime - 60_000).toISOString()
          const windowEnd = new Date(roomTime + 5 * 60_000).toISOString()
          // CRITICAL FIX: removed .single() — replaced with .limit(1)
          // and reading first element. .single() throws on 0 results.
          const { data: callsByRoom } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
            .order('created_at', { ascending: false })
            .limit(1)
          if (callsByRoom && callsByRoom.length > 0) matched = callsByRoom[0]
        }
      }

      // Strategy 3: match by recording timestamp ± window
      if (!matched) {
        const recDate = new Date(rec.date_created).getTime()
        const windowStart = new Date(recDate - 5 * 60_000).toISOString()
        const windowEnd = new Date(recDate + 60_000).toISOString()
        // CRITICAL FIX: same — was .single(), now .limit(1) + array read
        const { data: callsByTime } = await supabase
          .from('calls')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', windowStart)
          .lte('created_at', windowEnd)
          .is('recording_url', null)
          .order('created_at', { ascending: false })
          .limit(1)
        if (callsByTime && callsByTime.length > 0) matched = callsByTime[0]
      }

      if (matched && !matched.recording_url) {
        const { error: updateErr } = await supabase
          .from('calls')
          .update({
            recording_url: recUrl,
            recording_duration: recDuration,
            recording_status: 'completed',
            recording_expires_at: expiresAt,
            signalwire_call_id: matched.signalwire_call_id || recCallSid,
          })
          .eq('id', matched.id)

        if (updateErr) {
          console.warn(`Failed to update call ${matched.id}:`, updateErr)
        } else {
          synced++
        }
      } else if (matched?.recording_url) {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      total: recordings.length,
    })
  } catch (err: any) {
    console.error('Sync error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}