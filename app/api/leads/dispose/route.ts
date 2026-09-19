import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'
import { lifetimeAttemptCap, MAX_CLIENT_REPORTED_SECONDS } from '@/lib/dialerConstants'
import { addSuppression, DNC_DISPOSITION_SCOPE } from '@/lib/suppression'
import { canonical as canonicalDisp } from '@/lib/dispositions'

export async function POST(req: Request) {
  try {
    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_id, campaign_id, disposition, duration, notes, source } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'No lead_id' }, { status: 400 })
    }

    const user_id = authUserId

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      // phone is selected for the DO NOT CALL suppression write below.
      .select('id, user_id, dial_attempts, campaign_id, phone')
      .eq('id', lead_id)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    if (lead.user_id !== user_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const currentAttempts = lead.dial_attempts || 0
    const newAttempts = currentAttempts + 1

    // LIFETIME cap, not the per-pass 1x/2x/3x repeat count — see
    // lib/dialerConstants.ts. This was hardcoded to 3, which meant a campaign
    // set to 3x spent a lead's entire allowance on one visit and retired it
    // permanently after a single pass.
    //
    // NINE IS THE LEAD'S LIFESPAN, ON EVERY MODE. The repeat count decides
    // how many times in a row a lead is dialled on one visit; it does not
    // decide how many dials the lead gets in total. 1x, 2x and 3x all resolve
    // to nine here, which is intended and not a collapsed ladder to be
    // repaired — an earlier comment in this file described a 3/6/9 ladder
    // that was never the rule.
    let attemptCap = lifetimeAttemptCap(1)
    if (lead.campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('dial_repeat_count')
        .eq('id', lead.campaign_id)
        .maybeSingle()
      attemptCap = lifetimeAttemptCap(campaign?.dial_repeat_count)
    }

    // ── DO NOT CALL SUPPRESSES THE NUMBER, NOT JUST THIS LEAD ──────────────
    // Marking the lead 'dnc' only protects this row. The same person in a
    // second campaign is a different lead with no disposition, and the next
    // CSV import re-creates them clean — so a request to stop calling was
    // only ever honoured until the next upload. Suppression is keyed on the
    // NUMBER, which is what the person actually asked about.
    //
    // Scoped to this user: one tenant's opt-out is not another tenant's
    // business, and a shared list would leak who they've been calling.
    //
    // Awaited but non-fatal — if this write fails the lead is still marked,
    // and the alternative (failing the disposition) would leave the agent
    // stuck on a lead they've already handled.
    // Scope comes from DNC_DISPOSITION_SCOPE so this route and
    // /api/leads/update cannot disagree about how far a DNC reaches. It used
    // to be hard-coded 'user' here, which is broader than the product rule:
    // a campaign is one opt-in form, and another campaign is a separate form
    // the same person filled out.
    if (canonicalDisp(disposition) === 'DO NOT CALL' && lead.phone) {
      const result = await addSuppression({
        phone: lead.phone,
        userId: user_id,
        campaignId: lead.campaign_id ?? null,
        scope: lead.campaign_id ? DNC_DISPOSITION_SCOPE : 'user',
        reason: 'Agent marked DO NOT CALL',
        source: 'disposition',
      })
      if (!result.ok) {
        console.error('[leads/dispose] suppression write failed:', result.error)
      }
    }

    // ── WAS A CALL EVER PLACED FOR THIS LEAD? ───────────────────────────
    // Asked against the calls table rather than trusting the client's elapsed
    // timer, which reads about a second for a lead that was never rung. If
    // /api/calls/outbound has written nothing for this lead in the last few
    // minutes then nothing dialled it, and the disposition belongs to the
    // lead alone.
    //
    // Windowed rather than lifetime: a lead called last week and skipped
    // today was still not called today, and should not have that old row
    // treated as this visit's evidence.
    const { count: recentCallCount } = await supabaseAdmin
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('lead_id', lead_id)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    const neverDialled = (recentCallCount ?? 0) === 0

    // ── AN ATTEMPT MEANS A DIAL, NOT A GLANCE ───────────────────────────
    // Passing over a lead nobody rang used to spend one of its lifetime
    // attempts, so a queue worked by skipping retired leads that were never
    // called once. The counter governs when a lead is set aside for good; it
    // has to count dials.
    const effectiveAttempts = neverDialled ? currentAttempts : newAttempts

    let newStatus = 'called'
    if (disposition === 'DO NOT CALL') newStatus = 'dnc'
    else if (disposition === 'CLOSED') newStatus = 'closed'
    else if (disposition === 'APPOINTMENT') newStatus = 'appointment'
    else if (disposition === 'NOT INTERESTED') newStatus = 'called'
    else if (disposition === 'SKIPPED') newStatus = effectiveAttempts >= attemptCap ? 'maxed' : 'uncalled'
    else if (disposition === 'NO_ANSWER') {
      newStatus = effectiveAttempts >= attemptCap ? 'maxed' : 'no_answer'
    }

    // ── A SKIP MUST NOT ERASE A JUDGEMENT ─────────────────────────────────
    // leads.disposition was overwritten with SKIPPED on every skip, so an
    // agent passing over a lead they had CLOSED last week wiped the close.
    // Skipping is the dialer moving on; it says nothing about the lead, and
    // it has no business overwriting something somebody decided.
    //
    // The lead's STATUS still changes — back to uncalled, or maxed once the
    // attempt cap is reached — because that is real and is what governs
    // whether it comes round again.
    const isSkip = disposition === 'SKIPPED'

    const updates: Record<string, any> = {
      status: newStatus,
      ...(isSkip ? {} : { disposition }),
      dial_attempts: effectiveAttempts,
      // Stamped even when nothing was dialled. This is what moves the lead
      // down the queue, and a skipped lead that keeps its place is served
      // again immediately.
      last_called_at: new Date().toISOString(),
      // ── THE LAST CALL IS NOW THIS ONE ───────────────────────────────────
      // Kept in step with leads.disposition on this path, so a lead that
      // reached a machine yesterday and was spoken to today leaves the
      // voicemail queue rather than sitting in it having already been handled.
      // Without this, the queue would only ever grow.
      // Null on a skip, for the same reason: the last call did not reach a
      // disposition. Writing SKIPPED here would put "skipped" into the queue
      // filters that read this column, where it means nothing.
      last_call_disposition: isSkip ? null : disposition,
      last_call_at: new Date().toISOString(),
    }

    if (notes && String(notes).trim()) {
      updates.notes = String(notes).trim()
    }

    const { error: updateErr } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id', lead_id)

    if (updateErr) {
      console.error('Dispose error:', updateErr)
      return apiError(updateErr, { route: 'leads/dispose' })
    }

    const trimmedNotes = String(notes ?? '').trim()
    if (trimmedNotes) {
      await supabaseAdmin.from('lead_notes').insert({
        lead_id,
        user_id,
        note: trimmedNotes,
        disposition: disposition ?? null,
        source: source || 'dialer',
      })
    }

    if (campaign_id && disposition !== 'SKIPPED') {
      await supabaseAdmin.rpc('increment_called_leads', { campaign_id_input: campaign_id })
    }

    // ─────────────────────────────────────────────────────────────────────
    // Update the existing calls row (created by /api/calls/outbound at dial
    // start) instead of inserting a new one. Match the most recent open call
    // for this lead. If we somehow can't find one (manual dial, edge case),
    // insert a fallback row so we don't lose the disposition data.
    // ─────────────────────────────────────────────────────────────────────
    const { data: openCall } = await supabaseAdmin
      .from('calls')
      // duration and created_at come back because the client's own elapsed
      // timer is no longer trusted over them — see the guard below.
      .select('id, duration, created_at')
      .eq('user_id', user_id)
      .eq('lead_id', lead_id)
      .is('disposition', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let resolvedCallId: string | null = null
    let clampedFrom: number | null = null
    if (openCall?.id) {
      resolvedCallId = openCall.id
      // ── NEVER WRITE duration: 0 OVER A FINISHED CALL ────────────────────
      // 0 is not "no time elapsed", it is the sentinel this codebase uses for
      // STILL IN FLIGHT (see dialerPacing's abandon-rate math and the hangup
      // handler, which writes Math.max(1, ...) specifically so it can never
      // produce one).
      //
      // The hangup webhook closes the call correctly, and then this ran a
      // moment later with whatever the client had, which for a call that never
      // connected is nothing, and `duration || 0` turned that into a 0 that
      // overwrote it. The call was then permanently "in flight": 567 of them
      // in three days, 65-82% of some days, every one with a completed event
      // on file and a duration saying it had never ended. That is where the
      // "100 calls in flight" reading came from.
      //
      // So duration is only written when the client actually has one. The
      // webhook owns this column otherwise, and it is the only party that
      // knows when the call really stopped.
      //
      // ── AND THE MIRROR IMAGE: A HUGE CLIENT VALUE IS JUST AS WRONG ───────
      // The guard above only ever blocked a client 0. A client value that is
      // absurdly LARGE sailed straight through and overwrote a correct
      // webhook duration, which is where every "rogue call" in Live Ops came
      // from. Measured over seven days, 14 of 1,236 answered calls carried a
      // duration that disagreed with their own talk_seconds by more than a
      // minute. The worst read as a 3h 7m call; its real talk time was 12
      // seconds. One row claimed 53 minutes on a call that was never answered
      // at all.
      //
      // The cause is the agent's tab, not the carrier. duration arrives from
      // the browser's own elapsed timer, so a disposition modal left open
      // over lunch posts however long the tab has been sitting there. The
      // carrier never billed any of it: the longest leg Telnyx actually
      // charged for across the same week was 34.3 minutes, on a call whose
      // talk_seconds agreed at 34 minutes. This was always a display bug
      // sitting on top of correct money — but it is the display the floor
      // runs on, so a lie here reads as the dialer being broken.
      //
      // Two rules now:
      //   1. If the webhook already closed this call, the client NEVER wins.
      //      The carrier knows when the call stopped; a browser does not.
      //   2. If the webhook never closed it, the client's number is the only
      //      one there is — but it is a guess, so it is capped, and the cap
      //      is recorded rather than applied silently.
      const callUpdates: Record<string, unknown> = {
        disposition,
        campaign_id, // backfill in case it was missing
      }
      const webhookClosed =
        typeof openCall.duration === 'number' && openCall.duration > 0
      if (!webhookClosed && typeof duration === 'number' && duration > 0) {
        const claimed = Math.round(duration)
        if (claimed > MAX_CLIENT_REPORTED_SECONDS) {
          clampedFrom = claimed
          callUpdates.duration = MAX_CLIENT_REPORTED_SECONDS
        } else {
          callUpdates.duration = claimed
        }
      }
      await supabaseAdmin
        .from('calls')
        .update(callUpdates)
        .eq('id', openCall.id)
    } else if (neverDialled) {
      // ── A SKIP IS NOT A CALL ──────────────────────────────────────────
      // Skipping a lead off the queue without ringing it used to land here
      // and insert a calls row anyway: no phone_number, no call_control_id,
      // no agent_call_control_id, no dial_source, and duration 1 from a
      // client timer for a call that never started. Seven of them in one
      // evening from a single agent, each reading as a one-second call.
      //
      // Nothing dialled it and nothing billed for it, so it is not a call.
      // The damage is to anything counting rows here as dials — cost per
      // dial above all, which is a number the business is steered by.
      //
      // The outcome is not lost: the lead's own row is updated above with
      // last_called_at, which is what moves it down the queue, and the
      // forensic trail below still records the disposition against the lead.
      console.log(
        `[leads/dispose] ${disposition ?? 'disposition'} on lead ${lead_id} `
        + 'with no call placed — recording no calls row'
      )
    } else {
      // Fallback insert — a call was placed but its row could not be matched
      // (manual dial, edge case). Same reasoning as above: this row has no
      // hangup webhook coming to correct it, so a 0 here would read as
      // in-flight forever. 1 is the floor the hangup handler uses.
      const { data: inserted } = await supabaseAdmin.from('calls').insert({
        user_id,
        lead_id,
        campaign_id,
        disposition,
        duration: typeof duration === 'number' && duration > 0 ? duration : 1,
      }).select('id').maybeSingle()
      resolvedCallId = inserted?.id ?? null
    }

    // Forensic trail (fire-and-forget; never blocks the response).
    void logCallEvent({
      event_type: 'disposition_set',
      call_id: resolvedCallId,
      user_id,
      campaign_id: campaign_id ?? null,
      lead_id: lead_id ?? null,
      status: disposition ?? null,
      source: 'dialer',
      // clamped/ignored are here so a suspicious duration is visible in the
      // forensic trail instead of only in the column it failed to change.
      detail: {
        duration: duration || 0,
        ...(clampedFrom !== null ? { duration_clamped_from: clampedFrom } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'leads/dispose' })
  }
}