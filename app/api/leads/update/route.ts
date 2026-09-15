import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { auth } from '@clerk/nextjs/server'
import { addSuppression, DNC_DISPOSITION_SCOPE } from '@/lib/suppression'
import { canonical } from '@/lib/dispositions'
import { lifetimeAttemptCap } from '@/lib/dialerConstants'

const supabase = getServiceClient('leads/update')

export async function POST(req: NextRequest) {
  try {
    // Always use authenticated user — never trust body.user_id
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_id, disposition, notes, source } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'lead_id required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('leads')
      .select('id, user_id, disposition, phone, campaign_id, dial_attempts')
      .eq('id', lead_id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (disposition !== undefined) updates.disposition = disposition || null
    if (notes !== undefined) updates.notes = notes

    // ── A DISPOSITION IS AN ATTEMPT, AND ATTEMPTS ARE CAPPED ─────────────
    // /api/leads/dispose bumps dial_attempts and retires a lead as 'maxed'
    // once it passes the campaign's lifetime cap. This route did neither, and
    // this is the route that gets used — api/leads/bulk-update's own comment
    // sends readers here for dispositions.
    //
    // The cap has therefore never fired once. Measured 15 Sept: ZERO leads in
    // the entire table have status 'maxed', while 62 sit past three attempts
    // and still dialable, the worst on eighteen. The setting was decorative.
    //
    // What it cost: over 30 days, 4th-and-later attempts were 153 dials — 9%
    // of everything dialled — and produced ONE conversation. First attempts
    // return 2.99 conversations per 100 dials; 4th+ return 0.65, at twice the
    // cost each.
    //
    // Only when a disposition is actually being set. Editing notes alone is
    // not an attempt and must not consume one.
    if (disposition !== undefined && disposition) {
      const currentAttempts = existing.dial_attempts || 0
      const newAttempts = currentAttempts + 1

      // LIFETIME cap, not the per-pass 1x/2x/3x repeat count — the same
      // lifetimeAttemptCap() dispose uses, so the two routes cannot disagree
      // about when a lead is finished. 1x -> 3, 2x -> 6, 3x -> 9.
      let attemptCap = lifetimeAttemptCap(1)
      if (existing.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('dial_repeat_count')
          .eq('id', existing.campaign_id)
          .maybeSingle()
        attemptCap = lifetimeAttemptCap(campaign?.dial_repeat_count)
      }

      updates.dial_attempts = newAttempts
      updates.last_called_at = new Date().toISOString()

      // Terminal outcomes win over the cap: somebody who closed or booked is
      // not 'maxed', whatever their attempt count. Mirrors dispose exactly.
      const d = canonical(disposition)
      if (d === 'DO NOT CALL') updates.status = 'dnc'
      else if (d === 'CLOSED') updates.status = 'closed'
      else if (d === 'APPOINTMENT') updates.status = 'appointment'
      else if (d === 'NOT INTERESTED') updates.status = 'called'
      else if (d === 'SKIPPED') updates.status = newAttempts >= attemptCap ? 'maxed' : 'uncalled'
      else if (d === 'NO_ANSWER') updates.status = newAttempts >= attemptCap ? 'maxed' : 'no_answer'
      else updates.status = newAttempts >= attemptCap ? 'maxed' : 'called'
    }

    // ── DO NOT CALL HAS TO REACH THE SUPPRESSION LIST FROM HERE TOO ────────
    // /api/leads/dispose already did this and this route did not — and this
    // is the route that gets used. api/leads/bulk-update's own comment sends
    // readers here ("to change a disposition use /api/leads/update"), so the
    // documented path for dispositions was the one without the write.
    //
    // The result: 15 leads marked DO NOT CALL, 15 distinct numbers, and
    // suppression_list holding ZERO rows. Marking the lead retires that ROW;
    // the same person in another row of the same campaign stayed dialable,
    // and the next CSV import recreated them clean.
    //
    // Scoped per campaign — see DNC_DISPOSITION_SCOPE in lib/suppression for
    // why, and for the one constant that widens it if the policy changes.
    //
    // Non-fatal: if the write fails the lead is still marked, and failing the
    // disposition would strand the agent on a lead they have already handled.
    // canonical() rather than a raw string compare: 'DNC' and 'DO_NOT_CALL'
    // are documented aliases in lib/dispositions and both mean this.
    if (canonical(disposition) === 'DO NOT CALL' && existing.phone) {
      const result = await addSuppression({
        phone: existing.phone,
        userId,
        campaignId: existing.campaign_id,
        scope: existing.campaign_id ? DNC_DISPOSITION_SCOPE : 'user',
        reason: 'Agent marked DO NOT CALL',
        source: 'disposition',
      })
      if (!result.ok) {
        console.error('[leads/update] suppression write failed:', result.error)
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return apiError(error, { route: 'leads/update' })
    }

    // Append to notes history if notes were provided AND non-empty
    const trimmedNotes = String(notes ?? '').trim()
    if (trimmedNotes) {
      await supabase.from('lead_notes').insert({
        lead_id,
        user_id: userId,
        note: trimmedNotes,
        disposition: disposition ?? null,
        // 'source' identifies which page made the edit. Defaults to
        // leads_tab for backward compatibility with any caller that
        // doesn't pass it (the original behavior before recordings_tab
        // edits existed) — recordings page passes 'recordings_tab'
        // explicitly.
        source: typeof source === 'string' && source ? source : 'leads_tab',
      })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return apiError(err, { route: 'leads/update' })
  }
}