import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Manually polls the telephony provider for the user's recordings and back-fills the calls table.
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

    // Fetch ALL recent recordings from the telephony provider
    const recsUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings.json?PageSize=200`
    const recsRes = await fetch(recsUrl, { headers: { Authorization: authHeader } })

    if (!recsRes.ok) {
      const text = await recsRes.text()
      return NextResponse.json({ success: false, error: `Provider error ${recsRes.status}: ${text}` }, { status: 500 })
    }

    const recsJson = await recsRes.json()
    const recordings = recsJson.recordings || []

    let synced = 0
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    for (const rec of recordings) {
      // Each recording has a CallSid (parent call) and ConferenceSid (if conference recording)
      const recCallSid: string = rec.call_sid
      const recConfSid: string = rec.conference_sid
      const recDuration = parseInt(rec.duration || '0', 10)
      const recUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings/${rec.sid}`

      // Try to find a matching call.
      // Strategy: match by call_sid first
      let matched: any = null
      if (recCallSid) {
        const { data } = await supabase
          .from('calls')
          .select('*')
          .eq('signalwire_call_id', recCallSid)
          .eq('user_id', userId)
          .single()
        if (data) matched = data
      }

      // Fall back: match by lead_call_sid in call_rooms -> user calls
      if (!matched && recCallSid) {
        const { data: room } = await supabase
          .from('call_rooms')
          .select('*')
          .eq('lead_call_sid', recCallSid)
          .eq('user_id', userId)
          .single()
        if (room) {
          const roomTime = new Date(room.created_at).getTime()
          const windowStart = new Date(roomTime - 60_000).toISOString()
          const windowEnd = new Date(roomTime + 5 * 60_000).toISOString()
          const { data: callByRoom } = await supabase
            .from('calls')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (callByRoom) matched = callByRoom
        }
      }

      // Fall back: match by recording date (within 5 min) to user's most recent call near that time
      if (!matched) {
        const recDate = new Date(rec.date_created).getTime()
        const windowStart = new Date(recDate - 5 * 60_000).toISOString()
        const windowEnd = new Date(recDate + 60_000).toISOString()
        const { data: callByTime } = await supabase
          .from('calls')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', windowStart)
          .lte('created_at', windowEnd)
          .is('recording_url', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (callByTime) matched = callByTime
      }

      if (matched && !matched.recording_url) {
        await supabase
          .from('calls')
          .update({
            recording_url: recUrl,
            recording_duration: recDuration,
            recording_status: 'completed',
            recording_expires_at: expiresAt,
          })
          .eq('id', matched.id)
        synced++
      }
    }

    return NextResponse.json({ success: true, synced, total: recordings.length })
  } catch (err: any) {
    console.error('Sync error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}