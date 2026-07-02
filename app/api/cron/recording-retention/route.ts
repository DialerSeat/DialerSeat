import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

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
      .select('id, recording_url')
      .lt('recording_expires_at', new Date().toISOString())
      .not('recording_url', 'is', null)
      .neq('recording_status', 'deleted')
      .limit(BATCH_LIMIT)

    if (error) return apiError(error, { route: 'cron/recording-retention' })

    if (!expired || expired.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'nothing expired' })
    }

    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN
    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const authH =
      projectId && apiToken
        ? 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')
        : null

    let deleted = 0
    let swErrors = 0

    for (const row of expired) {

      if (row.recording_url && authH && spaceUrl && projectId) {
        try {
          const match = row.recording_url.match(/Recordings\/([A-Za-z0-9-]+)/)
          const recordingSid = match?.[1]
          if (recordingSid) {
            const delUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings/${recordingSid}.json`
            const delRes = await fetch(delUrl, { method: 'DELETE', headers: { Authorization: authH } })
            if (!delRes.ok && delRes.status !== 404) {
              swErrors++
              console.warn('[recording-retention] SignalWire delete failed:', delRes.status)
            }
          }
        } catch (e) {
          swErrors++
          console.warn('[recording-retention] SignalWire delete error (continuing):', e)
        }
      }

      const { error: updErr } = await supabase
        .from('calls')
        .update({
          recording_url: null,
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
      swErrors,
      hadMore: expired.length === BATCH_LIMIT,
    })
  } catch (error) {
    return apiError(error, { route: 'cron/recording-retention' })
  }
}
