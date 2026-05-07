import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    // Auth check — only the lead's owner can dispose it
    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_id, campaign_id, disposition, duration, notes, source } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'No lead_id' }, { status: 400 })
    }

    // Always trust the authenticated user, never the body's user_id
    const user_id = authUserId

    // Verify ownership before mutating
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

    // Map disposition to status
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

    // Denormalized "latest note preview" on the lead row for fast display
    if (notes && String(notes).trim()) {
      updates.notes = String(notes).trim()
    }

    const { error: updateErr } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id', lead_id)

    if (updateErr) {
      console.error('Dispose error:', updateErr)
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    // Append-only note history — only insert if there's actual text
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

    // Update campaign called count (skip when disposition is SKIPPED)
    if (campaign_id && disposition !== 'SKIPPED') {
      await supabaseAdmin.rpc('increment_called_leads', { campaign_id_input: campaign_id })
    }

    // Save call record
    await supabaseAdmin.from('calls').insert({
      user_id,
      lead_id,
      campaign_id,
      disposition,
      duration: duration || 0,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}