import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { deleteTelnyxRecording } from '@/lib/telnyxRecording'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BATCH_LIMIT = 200

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient('cron/recording-retention')

    const { data: expired, error } = await supabase
      .from('calls')
      .select('id, recording_id, recording_url, call_control_id')
      .lt('recording_expires_at', new Date().toISOString())
      .or('recording_url.not.is.null,recording_id.not.is.null')
      .neq('recording_status', 'deleted')
      .limit(BATCH_LIMIT)

    if (error) return apiError(error, { route: 'cron/recording-retention' })

    if (!expired || expired.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'nothing expired' })
    }

    // Same limitation as app/api/recordings/delete/route.ts: Telnyx's
    // recording id (needed for DELETE /v2/recordings/{id}) isn't
    // embeddable in the stored download URL the way SignalWire's SID
    // was — this is a best-effort attempt that mostly won't find a match,
    // but clearing OUR OWN recording_url reference below (which is what
    // actually stops it being served/played through us) always succeeds
    // regardless. See recordings/delete/route.ts's header comment for the
    // full reasoning and the real fix if hard provider-side deletion
    // becomes a requirement.
    const apiKey = process.env.TELNYX_API_KEY

    let deleted = 0
    let providerErrors = 0

    for (const row of expired) {

      if (apiKey) {
        // Deletes by calls.recording_id. The previous version tried to regex
        // an id out of recording_url, which is an S3 link with no id in it —
        // so no recording was ever actually removed from Telnyx.
        const gone = await deleteTelnyxRecording(row, apiKey)
        if (!gone) {
          providerErrors++
          console.warn(`[recording-retention] could not delete recording for call ${row.id} at Telnyx`)
        }
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

      if (updErr) {
        console.error('[recording-retention] failed to clear row', row.id, updErr)
      } else {
        deleted++
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      providerErrors,
      hadMore: expired.length === BATCH_LIMIT,
    })
  } catch (error) {
    return apiError(error, { route: 'cron/recording-retention' })
  }
}
