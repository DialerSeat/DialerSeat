import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'
import {
  claimTelephonyEvent,
  markTelephonyEventProcessed,
  markTelephonyEventFailed,
} from '@/lib/telephony-idempotency'

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string | null
    const conferenceSid = formData.get('ConferenceSid') as string | null
    const recordingSid = formData.get('RecordingSid') as string | null
    const recordingUrl = formData.get('RecordingUrl') as string | null
    const recordingStatus = formData.get('RecordingStatus') as string | null
    const recordingDuration = formData.get('RecordingDuration') as string | null
    const accountSid = formData.get('AccountSid') as string | null

    // Log the entire payload so we can see what SignalWire actually sends
    console.log('Recording webhook payload:', Object.fromEntries(formData.entries()))

    // Only act on completed recordings; ignore in-progress / absent
    if (recordingStatus && recordingStatus !== 'completed') {
      console.log(`Ignoring recording status: ${recordingStatus}`)
      return NextResponse.json({ success: true, skipped: true })
    }

    // ── Idempotency: a duplicate 'completed' recording webhook must not re-run
    // (e.g. re-attaching a recording_url the AMD voicemail-cleanup just deleted).
    // Key off RecordingSid (stable, unique per recording); fall back to CallSid.
    const idemSid = recordingSid || callSid
    if (idemSid) {
      const claim = await claimTelephonyEvent({
        callSid: idemSid,
        webhook: 'recording',
        status: recordingStatus || 'completed',
        sequenceNo: null,
      })
      if (!claim.shouldProcess) {
        return NextResponse.json({ success: true, deduped: claim.reason })
      }
      try {
        const result = await applyRecordingUpdate({
          formData, callSid, conferenceSid, recordingSid, recordingUrl, recordingDuration, recordingStatus,
        })
        await markTelephonyEventProcessed(claim.eventKey)
        return NextResponse.json({ success: true, matched: result.matched })
      } catch (workErr) {
        await markTelephonyEventFailed(claim.eventKey, workErr)
        throw workErr
      }
    }

    // No SID at all to key on — fall through to a best-effort apply (rare).
    const result = await applyRecordingUpdate({
      formData, callSid, conferenceSid, recordingSid, recordingUrl, recordingDuration, recordingStatus,
    })
    return NextResponse.json({ success: true, matched: result.matched })
  } catch (error: any) {
    console.error('Recording webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Applies the recording fields to the matching calls row. Extracted so the
// idempotency wrapper above stays readable; behavior is unchanged from before.
async function applyRecordingUpdate(args: {
  formData: FormData
  callSid: string | null
  conferenceSid: string | null
  recordingSid: string | null
  recordingUrl: string | null
  recordingDuration: string | null
  recordingStatus: string | null
}): Promise<{ matched: boolean }> {
  const { formData, callSid, conferenceSid, recordingSid, recordingUrl, recordingDuration, recordingStatus } = args

  const updates: Record<string, any> = {
    recording_status: recordingStatus || 'completed',
  }
  if (recordingUrl) updates.recording_url = recordingUrl
  if (recordingDuration) updates.recording_duration = parseInt(recordingDuration)

  let matched = false

  // Path 1: direct CallSid match (works for non-conference recordings)
  if (callSid) {
    const { data, error } = await supabaseAdmin
      .from('calls')
      .update(updates)
      .eq('signalwire_call_id', callSid)
      .select('id')

    if (!error && data && data.length > 0) {
      matched = true
      console.log(`Recording matched via CallSid: ${callSid}`)
    }
  }

  // Path 2: conference recording — match through call_rooms table
  if (!matched) {
    const friendlyName = formData.get('FriendlyName') as string | null
    const conferenceName = friendlyName || conferenceSid

    if (conferenceName) {
      const { data: room } = await supabaseAdmin
        .from('call_rooms')
        .select('lead_call_sid')
        .eq('room_name', conferenceName)
        .maybeSingle()

      if (room?.lead_call_sid) {
        const { data, error } = await supabaseAdmin
          .from('calls')
          .update(updates)
          .eq('signalwire_call_id', room.lead_call_sid)
          .select('id')

        if (!error && data && data.length > 0) {
          matched = true
          console.log(`Recording matched via room: ${conferenceName} -> ${room.lead_call_sid}`)
        }
      }
    }
  }

  if (!matched) {
    console.warn('Recording webhook did not match any call row', {
      callSid,
      conferenceSid,
      recordingSid,
    })
  }

  return { matched }
}