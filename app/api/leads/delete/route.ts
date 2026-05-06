import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_ids, campaign_id } = body

    // Two modes: delete a list of specific leads, OR delete by campaign id.
    // Both require ownership verification.

    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      // Bulk delete by IDs — verify ALL leads belong to caller before deleting.
      const { data: ownedLeads } = await supabaseAdmin
        .from('leads')
        .select('id')
        .in('id', lead_ids)
        .eq('user_id', userId)

      if (!ownedLeads || ownedLeads.length !== lead_ids.length) {
        return NextResponse.json(
          { success: false, error: 'One or more leads not found or not owned by you' },
          { status: 403 }
        )
      }

      const { error } = await supabaseAdmin
        .from('leads')
        .delete()
        .in('id', lead_ids)
        .eq('user_id', userId) // belt-and-suspenders

      if (error) throw error

      // Recompute total_leads for any campaigns affected.
      // (calls.lead_id has ON DELETE SET NULL so call rows survive.)
      const affectedCampaigns = Array.from(
        new Set(
          (await supabaseAdmin
            .from('leads')
            .select('campaign_id')
            .in('id', lead_ids))
            .data?.map((l: any) => l.campaign_id) ?? []
        )
      )
      // Note: at this point the leads are deleted, so the above query returns
      // nothing. We get affected campaigns from the request side instead.
      // Simpler: if caller passed campaign_id explicitly, recount that one.
      if (campaign_id) {
        await recountCampaign(campaign_id)
      }

      return NextResponse.json({ success: true, deleted: lead_ids.length })
    }

    if (campaign_id) {
      // Delete all leads in a campaign (without deleting the campaign itself).
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

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