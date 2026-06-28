import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('recordings/delete')

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

    // Ownership check + grab recording_url so we can delete from SignalWire
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

    // Delete from SignalWire (best-effort — if it fails, we still clear our DB)
    if (call.recording_url) {
      try {
        const projectId = process.env.SIGNALWIRE_PROJECT_ID!
        const apiToken = process.env.SIGNALWIRE_API_TOKEN!
        const spaceUrl = process.env.SIGNALWIRE_SPACE_URL!
        const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        // Extract recording SID from URL — SignalWire URLs look like:
        // https://{space}/api/laml/2010-04-01/Accounts/{project}/Recordings/{recording_sid}
        const match = call.recording_url.match(/Recordings\/([A-Za-z0-9-]+)/)
        const recordingSid = match?.[1]

        if (recordingSid) {
          const delUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Recordings/${recordingSid}.json`
          const delRes = await fetch(delUrl, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
          })
          if (!delRes.ok) {
            console.warn('SignalWire delete failed:', delRes.status, await delRes.text())
          } else {
            console.log('Deleted recording from SignalWire:', recordingSid)
          }
        }
      } catch (e) {
        console.warn('SignalWire delete error (continuing):', e)
      }
    }

    // Clear recording fields on the call row but keep the row so analytics stay accurate
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