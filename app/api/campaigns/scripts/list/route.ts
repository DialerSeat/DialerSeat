import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaign_id required' }, { status: 400 })
    }

    // Verify campaign access — either owner OR team member
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, script')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    // Quick check: is the user the owner OR on a team that has this campaign?
    const isOwner = campaign.user_id === userId
    if (!isOwner) {
      const { data: teamAccess } = await supabaseAdmin
        .from('team_campaigns')
        .select('team_id')
        .eq('campaign_id', campaignId)
        .limit(1)
        .maybeSingle()
      if (!teamAccess) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      // Verify they're on that team
      const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', teamAccess.team_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (!membership) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: scripts } = await supabaseAdmin
      .from('campaign_scripts')
      .select('id, name, body, is_default, sort_order, created_at, updated_at')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    // Lazy backfill: if no scripts exist yet but campaigns.script has text, create one
    if ((!scripts || scripts.length === 0) && campaign.script && campaign.script.trim()) {
      const { data: created } = await supabaseAdmin
        .from('campaign_scripts')
        .insert({
          campaign_id: campaignId,
          name: 'Main Script',
          body: campaign.script,
          is_default: true,
          sort_order: 0,
        })
        .select('id, name, body, is_default, sort_order, created_at, updated_at')
        .single()
      return NextResponse.json({ success: true, scripts: created ? [created] : [] })
    }

    return NextResponse.json({ success: true, scripts: scripts || [] })
  } catch (error: any) {
    console.error('Scripts list error:', error)
    return apiError(error, { route: 'campaigns/scripts/list' })
  }
}