import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { shouldMaskCampaign } from '@/lib/leadMasking'
import { supabaseAdmin } from '@/lib/supabase'
import { placeOutboundCall } from '@/lib/placeOutboundCall'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

// =============================================================================
// OUTBOUND CALL — user-initiated dial
// =============================================================================

// ── HOW LONG A FINISHED CALL IS ALLOWED TO LOOK OPEN ────────────────────
// A call is not closed the moment the agent leaves it. The lead's leg is held
// for AGENT_LEG_MIN_SECONDS to clear the short-duration threshold, and the
// hangup webhook writes the row after that, so an ended call reads as open for
// roughly ten seconds. Anything inside that is the tail of the previous call,
// not a second one.
//
// Above it, an open row means a call that is genuinely still up: a dial placed
// while actually on a call arrives well after the hold has expired. Below it,
// the client's own one-call-at-a-time guard and the in-flight latch cover the
// double-click case, and the leg-watchdog sweeps anything they both miss.
const CONCURRENT_CALL_GRACE_MS = 20_000

export async function POST(req: Request) {
  try {
    // Subscription gate — returns 403 if no active sub
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { to, leadId, campaignId, teamId, record, amd } = body

    // ── ON A MASKED CAMPAIGN THE CLIENT DOES NOT KNOW THE NUMBER ────────
    // The queue sends back "(•••) •••-4821" instead of the real thing, so the
    // number has to be resolved here from the lead id. Which is the safer
    // arrangement regardless: a dialer that places calls to whatever
    // destination a browser hands it is trusting the wrong end of the wire.
    let destination = to
    if (leadId && (await shouldMaskCampaign(campaignId, userId))) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('phone, campaign_id')
        .eq('id', leadId)
        .maybeSingle()

      if (!lead?.phone) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        )
      }
      // The lead must actually belong to the campaign it was claimed under —
      // otherwise a masked campaign becomes a way to dial any lead by id.
      if (campaignId && lead.campaign_id && lead.campaign_id !== campaignId) {
        return NextResponse.json(
          { success: false, error: 'Lead is not on this campaign' },
          { status: 403 }
        )
      }
      destination = lead.phone
    }

    if (!destination) {
      return NextResponse.json(
        { success: false, error: 'Missing destination' },
        { status: 400 }
      )
    }

    // ── ONE LIVE CALL PER AGENT, ENFORCED WHERE IT CANNOT BE SKIPPED ────
    // The dialer has this guard, and that was the only place it existed. A
    // browser running older code does not have it, and an agent on a stale
    // tab placed a second dial 19 seconds into a live call: the first leg was
    // never hung up by anything and sat open, connected and billing, with no
    // tab pointing at it any more. The client is not a safe place to keep the
    // only copy of a rule about spending money.
    //
    // Predictive is exempt by design — its whole purpose is several lines in
    // flight per agent — so the mode is read before deciding. Read from the
    // campaign rather than trusting the caller, for the same reason the
    // destination is.
    let modeForConcurrency: string | null = null
    if (campaignId) {
      const { data: campaignRow } = await supabaseAdmin
        .from('campaigns')
        .select('dialer_mode')
        .eq('id', campaignId)
        .maybeSingle()
      modeForConcurrency = campaignRow?.dialer_mode ?? null
    }

    if (modeForConcurrency !== 'predictive') {
      // ── ONLY A CALL THAT IS GENUINELY STILL UP ────────────────────────
      // This first shipped refusing on ANY open row, which broke ordinary
      // dialing within the hour: a call is not closed the instant the agent
      // skips it. The compliance hold keeps the leg for AGENT_LEG_MIN_SECONDS
      // and the hangup webhook lands after that, so a row sits open for
      // roughly ten seconds into its own teardown — and the next dial, 300ms
      // later, was being refused by the corpse of the call it followed. The
      // agent saw leads skipped without being tried.
      //
      // It was also hanging those legs up, which on a call still inside its
      // hold is worse than the bug it was added for: that hold exists to keep
      // calls off the short-duration surcharge.
      //
      // So the bar is now age. A dial placed while genuinely on a call comes
      // well after the hold has expired; the tail of a finished call never
      // does. Nothing is hung up and nothing is rewritten here — the
      // leg-watchdog owns that, and unlike this request it holds an
      // authoritative list of what Telnyx actually has up.
      const staleBefore = new Date(Date.now() - CONCURRENT_CALL_GRACE_MS).toISOString()
      const { count: liveCount } = await supabaseAdmin
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('hangup_cause', null)
        .or('duration.is.null,duration.eq.0')
        .lt('created_at', staleBefore)
        // Bounded, so a permanently stuck row cannot deny an agent their next
        // dial for the rest of the day. Past this the watchdog owns it.
        .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

      if ((liveCount ?? 0) > 0) {
        console.warn(
          `[calls/outbound] refused a dial for ${userId} — ${liveCount} call(s) `
          + 'still open past the grace period'
        )
        return NextResponse.json(
          {
            success: false,
            error: 'You are already on a call. Finish or skip it before dialing again.',
          },
          { status: 409 }
        )
      }
    }

    const result = await placeOutboundCall({
      to: destination,
      userId,
      leadId,
      campaignId,
      teamId,
      source: 'user_dial',
      // The manual dialer's record toggle. Ignored on anything carrying a
      // campaign — placeOutboundCall enforces that, not this route.
      recordManual: record === true,
      // Passed through only when the client actually expressed a preference.
      // `undefined` is meaningfully different from `false` here: false turns
      // detection off, undefined leaves today's behaviour untouched.
      amdManual: typeof amd === 'boolean' ? amd : undefined,
    })

    if (!result.success) {
      const status = result.httpStatus || 500

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          detail: result.detail,
          leadState: result.leadState,
          leadLocalTime: result.leadLocalTime,
          retryAfter: result.retryAfter,
        },
        { status }
      )
    }

    void logCallEvent({
      event_type: 'initiated',
      call_control_id: result.callControlId ?? null,
      user_id: userId,
      lead_id: leadId ?? null,
      campaign_id: campaignId ?? null,
      status: result.status ?? null,
      source: 'dialer',
      detail: {
        amdEnabled: result.amdEnabled,
        dialerMode: result.dialerMode,
      },
    })

    // NOTE: response keys (callSid, agentCallSid, roomName) are kept as-is
    // for frontend compatibility — app/dashboard/dialer/page.tsx reads
    // data.callSid/data.agentCallSid unchanged. Only the INTERNAL
    // PlaceCallResult field names changed when placeOutboundCall.ts was
    // rewritten for native Call Control (callSid -> callControlId,
    // agentCallSid -> agentCallControlId, roomName removed entirely since
    // there's no conference room under the direct-bridge design — see
    // TELNYX-MIGRATION-DESIGN.md). roomName is sent back as null rather
    // than omitted, so existing frontend code that reads
    // data.roomName doesn't hit an undefined-vs-missing-key surprise.
    return NextResponse.json({
      success: true,
      callSid: result.callControlId,
      agentCallSid: result.agentCallControlId,
      roomName: null,
      fromNumber: result.fromNumber,
      status: result.status,
      amdEnabled: result.amdEnabled,
      dialerMode: result.dialerMode,
      ringTimeout: result.ringTimeout,
    })

  } catch (error: any) {
    // 🔥 FIX: expose real error instead of hiding it in apiError()
    console.error("OUTBOUND CALL ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      },
      { status: 500 }
    )
  }
}