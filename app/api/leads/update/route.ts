import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { auth } from '@clerk/nextjs/server'
import { addSuppression, DNC_DISPOSITION_SCOPE } from '@/lib/suppression'
import { canonical } from '@/lib/dispositions'

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
      .select('id, user_id, disposition, phone, campaign_id')
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