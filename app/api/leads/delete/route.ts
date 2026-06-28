// app/api/leads/delete/route.ts
// =============================================================================
// DELETE LEADS
// =============================================================================
// Two modes (unchanged from the previous version):
//   1. Pass `lead_ids: string[]` — bulk delete specific leads (used by the
//      Sheets-style editor in /dashboard/campaigns).
//   2. Pass `campaign_id` only — wipe ALL leads in a campaign (used by the
//      campaign-clear flow; doesn't delete the campaign itself).
//
// FIX from previous version:
//   The earlier recount-affected-campaigns logic queried for campaign_ids
//   AFTER the delete had run, so it always returned empty. That meant if the
//   caller deleted leads spanning multiple campaigns by lead_ids and didn't
//   pass campaign_id, total_leads counters drifted off forever.
//
//   Now we collect affected campaign_ids BEFORE the delete (via the same
//   ownership-verification query), then recount each affected campaign
//   AFTER the delete. Single source of truth: total_leads always matches
//   the actual row count.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_ids, campaign_id } = body

    // ── Mode 1: bulk delete by lead_ids ─────────────────────────────────
    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      // Verify ownership AND capture campaign_ids in one query.
      const { data: ownedLeads, error: ownErr } = await supabaseAdmin
        .from('leads')
        .select('id, campaign_id')
        .in('id', lead_ids)
        .eq('user_id', userId)

      if (ownErr) {
        return apiError(ownErr, { route: 'leads/delete' })
      }

      if (!ownedLeads || ownedLeads.length !== lead_ids.length) {
        return NextResponse.json(
          { success: false, error: 'One or more leads not found or not owned by you' },
          { status: 403 }
        )
      }

      // Collect affected campaign_ids BEFORE deleting so we can recount them after.
      const affectedCampaignIds = Array.from(
        new Set(ownedLeads.map(l => l.campaign_id).filter(Boolean))
      )

      // Delete
      const { error: delErr } = await supabaseAdmin
        .from('leads')
        .delete()
        .in('id', lead_ids)
        .eq('user_id', userId) // belt-and-suspenders

      if (delErr) {
        return apiError(delErr, { route: 'leads/delete' })
      }

      // Recount every affected campaign.
      await Promise.all(affectedCampaignIds.map(cid => recountCampaign(cid)))

      return NextResponse.json({ success: true, deleted: lead_ids.length })
    }

    // ── Mode 2: wipe all leads in a campaign ────────────────────────────
    if (campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('id, user_id')
        .eq('id', campaign_id)
        .maybeSingle()

      if (!campaign) {
        return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
      }

      if (campaign.user_id !== userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const { error } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('campaign_id', campaign_id)
        .eq('user_id', userId)

      if (error) throw error

      await supabaseAdmin
        .from('campaigns')
        .update({ total_leads: 0, called_leads: 0 })
        .eq('id', campaign_id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Must provide lead_ids or campaign_id' },
      { status: 400 }
    )
  } catch (error: any) {
    return apiError(error, { route: 'leads/delete' })
  }
}

// ── Helper: recount total_leads for a campaign ───────────────────────────
// Uses a head:true count query (cheap — doesn't materialize rows).
async function recountCampaign(campaignId: string) {
  const { count } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  await supabaseAdmin
    .from('campaigns')
    .update({ total_leads: count ?? 0 })
    .eq('id', campaignId)
}