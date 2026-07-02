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

    if (Array.isArray(lead_ids) && lead_ids.length > 0) {

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

      const affectedCampaignIds = Array.from(
        new Set(ownedLeads.map(l => l.campaign_id).filter(Boolean))
      )

      const { error: delErr } = await supabaseAdmin
        .from('leads')
        .delete()
        .in('id', lead_ids)
        .eq('user_id', userId) // belt-and-suspenders

      if (delErr) {
        return apiError(delErr, { route: 'leads/delete' })
      }

      await Promise.all(affectedCampaignIds.map(cid => recountCampaign(cid)))

      return NextResponse.json({ success: true, deleted: lead_ids.length })
    }

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