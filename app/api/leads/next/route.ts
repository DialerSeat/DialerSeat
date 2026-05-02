import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const campaign_id = searchParams.get('campaign_id')

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'No user_id' }, { status: 400 })
    }

    // Get active campaign IDs for this user first
    const { data: activeCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'active')

    const activeCampaignIds = activeCampaigns?.map(c => c.id) || []

    if (activeCampaignIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No active campaigns' }, { status: 404 })
    }

    let query = supabaseAdmin
      .from('leads')
      .select('*, extra_data')
      .eq('user_id', user_id)
      .neq('status', 'dnc')
      .neq('status', 'closed')
      .neq('status', 'appointment')
      .neq('status', 'maxed')
      .or(`status.eq.uncalled,status.eq.no_answer`)
      .not('phone', 'is', null)
      .neq('phone', '')
      .order('dial_attempts', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)

    if (campaign_id && campaign_id !== 'all') {
      // Specific campaign selected
      query = query.eq('campaign_id', campaign_id)
    } else {
      // ALL mode — only pull from active campaigns
      query = query.in('campaign_id', activeCampaignIds)
    }

    const { data, error } = await query.single()

    console.log('Next lead query result:', { data: data?.id, phone: data?.phone, error: error?.message, user_id, campaign_id })

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'No more leads' }, { status: 404 })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}