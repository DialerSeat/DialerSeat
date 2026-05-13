import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaign_id, name, body: scriptBody, is_default } = body

    if (!campaign_id || !name) {
      return NextResponse.json({ success: false, error: 'campaign_id and name required' }, { status: 400 })
    }

    // Owner-only — agents can't create scripts on campaigns they don't own
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaign_id)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    // Compute next sort_order
    const { data: existing } = await supabaseAdmin
      .from('campaign_scripts')
      .select('sort_order')
      .eq('campaign_id', campaign_id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0
    const shouldBeDefault = !!is_default || nextOrder === 0  // first script auto-becomes default

    // If making this default, unset any other defaults first
    if (shouldBeDefault) {
      await supabaseAdmin
        .from('campaign_scripts')
        .update({ is_default: false })
        .eq('campaign_id', campaign_id)
        .eq('is_default', true)
    }

    const { data: created, error } = await supabaseAdmin
      .from('campaign_scripts')
      .insert({
        campaign_id,
        name: name.slice(0, 80),
        body: scriptBody || '',
        is_default: shouldBeDefault,
        sort_order: nextOrder,
      })
      .select('id, name, body, is_default, sort_order, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, script: created })
  } catch (error: any) {
    console.error('Script create error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}