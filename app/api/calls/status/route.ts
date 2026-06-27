import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'
import {
  claimTelephonyEvent,
  markTelephonyEventProcessed,
  markTelephonyEventFailed,
  markTelephonyEventSkipped,
} from '@/lib/telephony-idempotency'

// =============================================================================
// SignalWire call-status webhook
// =============================================================================
// Hardened against at-least-once, out-of-order delivery (see
// lib/telephony-idempotency.ts). Three layers protect call state:
//   1. DEDUP    — claimTelephonyEvent() processes each (CallSid, status)
//                 transition exactly once.
//   2. ORDER    — SequenceNumber rejects a stale callback that arrives after a
//                 newer one.
//   3. PRESERVE — even a new, in-order event never overwrites a real duration or
//                 disposition with an empty/null value (the "0s duration" bug:
//                 a 'ringing' update carries no CallDuration, so blindly writing
//                 parseInt('') = 0 used to clobber a real value).
// Always returns 200 on duplicates/stale events so SignalWire stops retrying.
// =============================================================================

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const durationRaw = formData.get('CallDuration') as string | null
    const sequenceRaw = formData.get('SequenceNumber') as string | null

    console.log('Call status update:', { callSid, callStatus, duration: durationRaw, seq: sequenceRaw })

    if (!callSid) {
      return NextResponse.json({ success: true })
    }

    const sequenceNo =
      sequenceRaw != null && sequenceRaw !== '' && !isNaN(parseInt(sequenceRaw))
        ? parseInt(sequenceRaw)
        : null

    // ── Claim (dedup + ordering) ───────────────────────────────────────────
    const claim = await claimTelephonyEvent({
      callSid,
      webhook: 'status',
      status: callStatus || null,
      sequenceNo,
    })
    if (!claim.shouldProcess) {
      // Duplicate, in-flight, or stale-out-of-order — acknowledge so retries stop.
      return NextResponse.json({ success: true, deduped: claim.reason })
    }

    try {
      // Map SignalWire status -> our disposition (terminal statuses only).
      let disposition: string | null = null
      if (callStatus === 'completed') disposition = 'completed'
      else if (callStatus === 'no-answer') disposition = 'no_answer'
      else if (callStatus === 'busy') disposition = 'busy'
      else if (callStatus === 'failed') disposition = 'failed'
      else if (callStatus === 'canceled') disposition = 'canceled'

      // PRESERVE guard: only write duration when this callback actually carried a
      // positive one. A blank/zero CallDuration (ringing/in-progress, or a stale
      // event) must never overwrite a real value.
      const parsedDuration =
        durationRaw != null && durationRaw !== '' ? parseInt(durationRaw) : NaN
      const haveDuration = !isNaN(parsedDuration) && parsedDuration > 0

      const updates: Record<string, any> = {}
      if (haveDuration) updates.duration = parsedDuration
      if (disposition) updates.disposition = disposition

      if (Object.keys(updates).length === 0) {
        // Nothing meaningful to write (e.g. a 'ringing' with no duration).
        // Record the event as handled so we don't reprocess it.
        await markTelephonyEventSkipped(claim.eventKey)
        return NextResponse.json({ success: true, noop: true })
      }

      // Fetch current row so we don't downgrade an existing disposition/duration.
      const { data: current } = await supabaseAdmin
        .from('calls')
        .select('duration, disposition')
        .eq('signalwire_call_id', callSid)
        .maybeSingle()

      // Don't overwrite an already-recorded positive duration with a smaller one.
      if (
        haveDuration &&
        current &&
        typeof current.duration === 'number' &&
        current.duration > parsedDuration
      ) {
        delete updates.duration
      }
      // Don't overwrite a meaningful disposition that a human/agent flow set
      // (e.g. CLOSED, APPOINTMENT) with a generic carrier status. Only fill a
      // disposition that is currently empty or itself a generic carrier status.
      const GENERIC = new Set<any>([
        'completed', 'no_answer', 'busy', 'failed', 'canceled',
      ])
      if (
        updates.disposition &&
        current &&
        current.disposition &&
        !GENERIC.has(current.disposition)
      ) {
        delete updates.disposition
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('calls')
          .update(updates)
          .eq('signalwire_call_id', callSid)
      }

      await markTelephonyEventProcessed(claim.eventKey)
      return NextResponse.json({ success: true })
    } catch (workErr) {
      await markTelephonyEventFailed(claim.eventKey, workErr)
      throw workErr
    }
  } catch (error: any) {
    console.error('Status webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
