// app/api/campaigns/script-links/reorder/route.ts
// =============================================================================
// CAMPAIGN ↔ SCRIPT LINKS — REORDER
// =============================================================================
// Reorders the enabled scripts on a campaign. Body:
//   { campaign_id, order: [scriptId, ...] }
// Owner only. Only ids actually linked to the campaign are reordered; the rest
// are left as-is. Mirrors campaigns.script to the new top script.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign_id, order } = await req.json()
    if (!campaign_id || !Array.isArray(order)) {
      return NextResponse.json({ success: false, error: 'campaign_id and order required' }, { status: 400 })
    }

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

    const { data: links } = await supabaseAdmin
      .from('campaign_script_links')
      .select('script_id')
      .eq('campaign_id', campaign_id)
    const linked = new Set((links || []).map(l => l.script_id))

    let i = 0
    for (const scriptId of order) {
      if (!linked.has(scriptId)) continue
      await supabaseAdmin
        .from('campaign_script_links')
        .update({ sort_order: i })
        .eq('campaign_id', campaign_id)
        .eq('script_id', scriptId)
      i++
    }

    // Mirror the new top script to campaigns.script.
    const { data: top } = await supabaseAdmin
      .from('campaign_script_links')
      .select('script_id')
      .eq('campaign_id', campaign_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (top?.script_id) {
      const { data: s } = await supabaseAdmin
        .from('scripts')
        .select('body')
        .eq('id', top.script_id)
        .maybeSingle()
      await supabaseAdmin.from('campaigns').update({ script: s?.body || '' }).eq('id', campaign_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('script-links/reorder error:', error)
    return apiError(error, { route: 'campaigns/script-links/reorder' })
  }
}
