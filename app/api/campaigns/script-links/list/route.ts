// app/api/campaigns/script-links/list/route.ts
// =============================================================================
// CAMPAIGN ↔ SCRIPT LINKS — LIST
// =============================================================================
// For a given campaign, returns every script in the caller's library (own +
// team) annotated with whether it's enabled on this campaign and, if so, its
// per-campaign sort_order. Powers the campaign settings toggles and the lead
// editor's draggable enabled-script order.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Verify access (owner or active team member of a team that has this campaign).
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .maybeSingle()
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    const isOwner = campaign.user_id === userId
    if (!isOwner) {
      const { data: tc } = await supabaseAdmin
        .from('team_campaigns')
        .select('team_id')
        .eq('campaign_id', campaignId)
      const teamIds = (tc || []).map(t => t.team_id)
      let ok = false
      if (teamIds.length > 0) {
        const { data: m } = await supabaseAdmin
          .from('team_members')
          .select('id')
          .in('team_id', teamIds)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle()
        ok = !!m
      }
      if (!ok) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // The caller's library (own + team).
    const { data: memberships } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('status', 'active')
    const teamIds = (memberships || []).map(m => m.team_id).filter(Boolean)

    const { data: own } = await supabaseAdmin
      .from('scripts')
      .select('id, user_id, team_id, name, body, sort_order')
      .eq('user_id', userId)

    let teamScripts: any[] = []
    if (teamIds.length > 0) {
      const { data: ts } = await supabaseAdmin
        .from('scripts')
        .select('id, user_id, team_id, name, body, sort_order')
        .in('team_id', teamIds)
        .neq('user_id', userId)
      teamScripts = ts || []
    }

    const library = [...(own || []), ...teamScripts]

    // Enabled links for this campaign.
    const { data: links } = await supabaseAdmin
      .from('campaign_script_links')
      .select('script_id, sort_order')
      .eq('campaign_id', campaignId)
    const linkMap = new Map((links || []).map(l => [l.script_id, l.sort_order]))

    const scripts = library.map(s => ({
      id: s.id,
      name: s.name,
      body: s.body,
      is_team: !!s.team_id,
      owned: s.user_id === userId,
      enabled: linkMap.has(s.id),
      link_sort_order: linkMap.has(s.id) ? linkMap.get(s.id) : null,
    }))

    // Sort: enabled first (by link order), then the rest by library order/name.
    scripts.sort((a, b) => {
      if (a.enabled && b.enabled) return (a.link_sort_order! - b.link_sort_order!)
      if (a.enabled) return -1
      if (b.enabled) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ success: true, scripts, isOwner })
  } catch (error: any) {
    console.error('script-links/list error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
