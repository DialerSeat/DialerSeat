import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

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
      .select('id, user_id, dial_attempts')
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

    let newStatus = 'called'
    if (disposition === 'DO NOT CALL') newStatus = 'dnc'
    else if (disposition === 'CLOSED') newStatus = 'closed'
    else if (disposition === 'APPOINTMENT') newStatus = 'appointment'
    else if (disposition === 'NOT INTERESTED') newStatus = 'called'
    else if (disposition === 'SKIPPED') newStatus = newAttempts >= 3 ? 'maxed' : 'uncalled'
    else if (disposition === 'NO_ANSWER') {
      newStatus = newAttempts >= 3 ? 'maxed' : 'no_answer'
    }

    const updates: Record<string, any> = {
      status: newStatus,
      disposition: disposition,
      dial_attempts: newAttempts,
      last_called_at: new Date().toISOString(),
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

      const { data: inserted } = await supabaseAdmin.from('calls').insert({
        user_id,
        lead_id,
        campaign_id,
        disposition,
        duration: duration || 0,
      }).select('id').maybeSingle()
      resolvedCallId = inserted?.id ?? null
    }

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