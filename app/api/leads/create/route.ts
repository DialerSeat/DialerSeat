import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabaseAdmin = getServiceClient('leads/create')

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, total_leads')
      .eq('id', campaign_id)
      .single()
    if (!campaign || campaign.user_id !== userId) {
      return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 })
    }

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

    await supabaseAdmin
      .from('campaigns')
      .update({
        total_leads: (campaign.total_leads || 0) + 1,
      })
      .eq('id', campaign_id)

    return NextResponse.json({ success: true, lead })
  } catch (err: any) {
    console.error('leads/create unhandled:', err)
    return NextResponse.json({ error: 'server_error', detail: err.message }, { status: 500 })
  }
}