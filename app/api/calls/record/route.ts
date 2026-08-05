import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

// =============================================================================
// MID-CALL RECORDING CONTROL
// =============================================================================
// Telnyx Call Control can start and stop a recording on a call that is
// already up (actions/record_start, actions/record_stop), so the agent does
// not have to decide before dialing whether a call is worth recording. The
// campaign toggle stays the default; this is the override for the moment
// something on a live call becomes worth keeping.
//
// INTERACTION WITH THE CAMPAIGN TOGGLE — the part that needs care:
//   app/api/calls/events/route.ts DELETES any recording that arrives for a
//   campaign with recording disabled, on the reasoning that we never asked
//   for it so it must have come from Telnyx account-level recording. A
//   manually started recording would trip exactly that rule and be destroyed
//   moments after the agent deliberately asked for it.
//
//   So a manual start marks the call with recording_status = 'manual', and
//   the webhook treats that as explicit consent to keep the recording
//   regardless of what the campaign says. Reusing the existing column avoids
//   a migration for a single boolean.
//
// SECURITY: the call must belong to the requesting user. Without that check
// this is an endpoint for recording other people's calls by guessing ids.
// =============================================================================

type RecordAction = 'start' | 'stop'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const sid: string | undefined = body?.sid
    const action: RecordAction = body?.action === 'stop' ? 'stop' : 'start'

    if (!sid) {
      return NextResponse.json({ success: false, error: 'Missing call sid' }, { status: 400 })
    }

    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Telnyx not configured' }, { status: 500 })
    }

    // Ownership check — never act on a call the caller doesn't own.
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('id, user_id, recording_status')
      .eq('signalwire_call_id', sid)
      .maybeSingle()

    if (!callRow) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })
    }
    if (callRow.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const telnyxAction = action === 'start' ? 'record_start' : 'record_stop'
    const payload =
      action === 'start'
        ? {
            format: 'mp3',
            // Dual channel keeps agent and lead on separate tracks, matching
            // what the campaign-level recording already produces so the two
            // sources are interchangeable downstream.
            channels: 'dual',
          }
        : {}

    const res = await fetch(`https://api.telnyx.com/v2/calls/${sid}/actions/${telnyxAction}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[calls/record] ${telnyxAction} failed for ${sid} (${res.status}): ${text.slice(0, 300)}`)
      // A record_stop on a call with no active recording, or a record_start on
      // one already recording, comes back as an error that is not really a
      // failure of intent — surface it plainly rather than as a 500.
      return NextResponse.json(
        {
          success: false,
          error:
            action === 'start'
              ? 'Could not start recording — the call may have already ended.'
              : 'Could not stop recording — it may have already stopped.',
        },
        { status: 400 }
      )
    }

    if (action === 'start') {
      // Marks this recording as explicitly requested, so the campaign-toggle
      // enforcement in the events webhook keeps it instead of deleting it.
      await supabaseAdmin
        .from('calls')
        .update({ recording_status: 'manual' })
        .eq('id', callRow.id)
    }

    void logCallEvent({
      event_type: action === 'start' ? 'recording_started' : 'recording_stopped',
      signalwire_call_id: sid,
      user_id: userId,
      source: 'dialer',
    })

    return NextResponse.json({ success: true, recording: action === 'start' })
  } catch (error) {
    return apiError(error, { route: 'calls/record' })
  }
}
