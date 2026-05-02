import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { lead_id, campaign_id, user_id, disposition, duration } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'No lead_id' }, { status: 400 })
    }

    // Get current lead data
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('dial_attempts')
      .eq('id', lead_id)
      .single()

    const currentAttempts = lead?.dial_attempts || 0
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

    const { error } = await supabaseAdmin
      .from('leads')
      .update({
        status: newStatus,
        disposition: disposition,
        dial_attempts: newAttempts,
        last_called_at: new Date().toISOString(),
      })
      .eq('id', lead_id)

    if (error) {
      console.error('Dispose error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Update campaign called count
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