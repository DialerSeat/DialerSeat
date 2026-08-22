import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'
import { lifetimeAttemptCap } from '@/lib/dialerConstants'
import { addSuppression } from '@/lib/suppression'

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
    // permanently after a single pass. Now 1x -> 3, 2x -> 6, 3x -> 9, so the
    // repeat setting controls pacing within a pass and the lead still gets
    // three passes before being set aside.
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
    if (disposition === 'DO NOT CALL' && lead.phone) {
      const result = await addSuppression({
        phone: lead.phone,
        userId: user_id,
        scope: 'user',
        reason: 'Agent marked DO NOT CALL',
        source: 'disposition',
      })
      if (!result.ok) {
        console.error('[leads/dispose] suppression write failed:', result.error)
      }
    }

    let newStatus = 'called'
    if (disposition === 'DO NOT CALL') newStatus = 'dnc'
    else if (disposition === 'CLOSED') newStatus = 'closed'
    else if (disposition === 'APPOINTMENT') newStatus = 'appointment'
    else if (disposition === 'NOT INTERESTED') newStatus = 'called'
    else if (disposition === 'SKIPPED') newStatus = newAttempts >= attemptCap ? 'maxed' : 'uncalled'
    else if (disposition === 'NO_ANSWER') {
      newStatus = newAttempts >= attemptCap ? 'maxed' : 'no_answer'
    }

    const updates: Record<string, any> = {
      status: newStatus,
      disposition: disposition,
      dial_attempts: newAttempts,
      last_called_at: new Date().toISOString(),
      // ── THE LAST CALL IS NOW THIS ONE ───────────────────────────────────
      // Kept in step with leads.disposition on this path, so a lead that
      // reached a machine yesterday and was spoken to today leaves the
      // voicemail queue rather than sitting in it having already been handled.
      // Without this, the queue would only ever grow.
      last_call_disposition: disposition,
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
      .select('id')
      .eq('user_id', user_id)
      .eq('lead_id', lead_id)
      .is('disposition', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let resolvedCallId: string | null = null
    if (openCall?.id) {
      resolvedCallId = openCall.id
      await supabaseAdmin
        .from('calls')
        .update({
          disposition,
          duration: duration || 0,
          campaign_id, // backfill in case it was missing
        })
        .eq('id', openCall.id)
    } else {
      // Fallback insert — lead has no open call row (rare, e.g., disposition
      // came through without a prior outbound dial attempt)
      const { data: inserted } = await supabaseAdmin.from('calls').insert({
        user_id,
        lead_id,
        campaign_id,
        disposition,
        duration: duration || 0,
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
      detail: { duration: duration || 0 },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'leads/dispose' })
  }
}