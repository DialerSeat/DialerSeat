// app/api/campaigns/script-links/toggle/route.ts
// =============================================================================
// CAMPAIGN ↔ SCRIPT LINKS — TOGGLE
// =============================================================================
// Enables or disables a library script on a campaign. Body:
//   { campaign_id, script_id, enabled }
// Owner of the campaign only. When enabling, the link gets the next sort_order.
// Keeps campaigns.script mirrored to the top (lowest sort_order) enabled script.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

async function mirrorTopScript(campaignId: string) {
  const { data: top } = await supabaseAdmin
    .from('campaign_script_links')
    .select('script_id')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (top?.script_id) {
    const { data: s } = await supabaseAdmin
      .from('scripts')
      .select('body')
      .eq('id', top.script_id)
      .maybeSingle()
    await supabaseAdmin.from('campaigns').update({ script: s?.body || '' }).eq('id', campaignId)
  } else {
    await supabaseAdmin.from('campaigns').update({ script: '' }).eq('id', campaignId)
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign_id, script_id, enabled } = await req.json()
    if (!campaign_id || !script_id || typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'campaign_id, script_id, enabled required' }, { status: 400 })
    }

    // Campaign must be owned by the caller.
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

    // Script must be in the caller's library (own or team they belong to).
    const { data: script } = await supabaseAdmin
      .from('scripts')
      .select('id, user_id, team_id')
      .eq('id', script_id)
      .maybeSingle()
    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }
    if (script.user_id !== userId) {
      let allowed = false
      if (script.team_id) {
        const { data: m } = await supabaseAdmin
          .from('team_members')
          .select('id')
          .eq('team_id', script.team_id)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle()
        allowed = !!m
      }
      if (!allowed) {
        return NextResponse.json({ success: false, error: 'Script not in your library' }, { status: 403 })
      }
    }

    if (enabled) {
      const { data: existing } = await supabaseAdmin
        .from('campaign_script_links')
        .select('id')
        .eq('campaign_id', campaign_id)
        .eq('script_id', script_id)
        .maybeSingle()
      if (!existing) {
        const { data: maxRow } = await supabaseAdmin
          .from('campaign_script_links')
          .select('sort_order')
          .eq('campaign_id', campaign_id)
          .order('sort_order', { ascending: false })
          .limit(1)
        const nextOrder = maxRow && maxRow.length > 0 ? (maxRow[0].sort_order + 1) : 0
        const { error } = await supabaseAdmin
          .from('campaign_script_links')
          .insert({ campaign_id, script_id, sort_order: nextOrder })
        if (error) throw error
      }
    } else {
      const { error } = await supabaseAdmin
        .from('campaign_script_links')
        .delete()
        .eq('campaign_id', campaign_id)
        .eq('script_id', script_id)
      if (error) throw error
    }

    await mirrorTopScript(campaign_id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('script-links/toggle error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
