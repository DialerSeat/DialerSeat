// app/api/leads/create/route.ts
// =============================================================================
// CREATE NEW LEAD
// =============================================================================
// Used by the Sheets-style editor "+ Add row" button. Creates a single lead
// attached to the given campaign. Server generates the id and timestamps.
//
// Body:
//   {
//     campaign_id: 'uuid',
//     first_name?: string,
//     last_name?: string,
//     phone?: string,        // required for a usable lead, but accepted blank
//                            // so empty rows can be added and edited in place
//     email?: string,
//     state?: string,
//     city?: string,
//     extra_data?: {...},
//   }
//
// Returns: { success: true, lead: {...} }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Active subscription gate
    const { data: sub } = await supabaseAdmin
      .from('users')
      .select('subscription_status')
      .eq('clerk_id', userId)
      .single()
    if (!sub || sub.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'subscription_required', detail: 'Resubscribe to add leads.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { campaign_id, ...fields } = body
    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id_required' }, { status: 400 })
    }

    // Verify ownership of the campaign
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, total_leads')
      .eq('id', campaign_id)
      .single()
    if (!campaign || campaign.user_id !== userId) {
      return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 })
    }

    // Build the row. Phone may be blank — user can fill it in the editor.
    const now = new Date().toISOString()
    const insert = {
      user_id: userId,
      campaign_id,
      first_name: fields.first_name || '',
      last_name: fields.last_name || '',
      phone: fields.phone || '',
      email: fields.email || null,
      state: fields.state || null,
      city: fields.city || null,
      notes: fields.notes || '',
      extra_data: fields.extra_data || {},
      disposition: null,
      dial_attempts: 0,
      last_called_at: null,
      created_at: now,
      updated_at: now,
    }

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert(insert)
      .select('*')
      .single()

    if (error || !lead) {
      console.error('leads/create insert failed:', error)
      return NextResponse.json({ error: 'db_error', detail: error?.message }, { status: 500 })
    }

    // Bump the campaign's total_leads counter and updated_at
    await supabaseAdmin
      .from('campaigns')
      .update({
        total_leads: (campaign.total_leads || 0) + 1,
        updated_at: now,
      })
      .eq('id', campaign_id)

    return NextResponse.json({ success: true, lead })
  } catch (err: any) {
    console.error('leads/create unhandled:', err)
    return NextResponse.json({ error: 'server_error', detail: err.message }, { status: 500 })
  }
}