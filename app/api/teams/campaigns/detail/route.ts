import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// ONE CAMPAIGN, EVERYTHING ABOUT IT
//
// The team view can only ever show a campaign as a row: a name, a lead count,
// a pause button. Everything an owner actually does to a campaign — see who is
// on it, take someone off, change how it dials, stop the numbers leaking —
// had no home, so it was spread across the campaigns page, the dialer, and
// nowhere.
//
// Deliberately owner-only. An agent's view of a campaign is the queue panel;
// this is the control surface, and the two should not be the same page
// pretending to be different.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = req.nextUrl.searchParams.get('campaignId')
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, status, dialer_mode, total_leads, called_leads, amd_enabled, recording_enabled, predictive_lines_per_agent, mask_lead_numbers, agent_picks_mode, user_id, created_at')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    // Two ways to be entitled to this page: you made the campaign, or you own a
    // team it is attached to. Checked against the data rather than trusted from
    // the request — this returns a lead list's shape and who can dial it.
    const { data: attachRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id, access_mode')
      .eq('campaign_id', campaignId)

    const teamIds = (attachRows || []).map((r: any) => r.team_id)
    let ownedTeam: any = null
    if (teamIds.length > 0) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('id, name, owner_id')
        .in('id', teamIds)
      ownedTeam = (teams || []).find((t: any) => t.owner_id === userId) || null
    }

    const isCampaignOwner = campaign.user_id === userId
    if (!isCampaignOwner && !ownedTeam) {
      return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
    }

    const accessMode =
      (attachRows || []).find((r: any) => r.team_id === ownedTeam?.id)?.access_mode ?? null

    // Who can dial it. Only meaningful for a campaign attached to a team the
    // viewer owns — a personal campaign has exactly one dialer.
    let agents: any[] = []
    if (ownedTeam) {
      const { data: accessRows } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id, team_member_id, payer, access_source, granted_at')
        .eq('campaign_id', campaignId)
        .eq('team_id', ownedTeam.id)
        .eq('is_active', true)

      const memberIds = (accessRows || []).map((a: any) => a.team_member_id)
      if (memberIds.length > 0) {
        const { data: members } = await supabaseAdmin
          .from('team_members')
          .select('id, user_id, status, seat_suspended_at')
          .in('id', memberIds)

        const userIds = Array.from(new Set((members || []).map((m: any) => m.user_id)))
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', userIds)

        const userById: Record<string, any> = {}
        for (const u of users || []) userById[u.clerk_id] = u

        const memberById: Record<string, any> = {}
        for (const m of members || []) memberById[m.id] = m

        agents = (accessRows || []).map((a: any) => {
          const m = memberById[a.team_member_id]
          const u = m ? userById[m.user_id] : null
          const name = u
            ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email)
            : 'Unknown'
          return {
            accessId: a.id,
            memberId: a.team_member_id,
            userId: m?.user_id ?? null,
            name,
            email: u?.email ?? null,
            payer: a.payer,
            accessSource: a.access_source,
            suspended: !!m?.seat_suspended_at,
          }
        })
      }
    }

    const total = campaign.total_leads || 0
    const called = campaign.called_leads || 0

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        dialerMode: campaign.dialer_mode,
        totalLeads: total,
        calledLeads: called,
        // Stated rather than left to the reader to subtract. "How much is left"
        // is the question an owner actually opens this page with.
        remainingLeads: Math.max(total - called, 0),
        amdEnabled: campaign.amd_enabled,
        recordingEnabled: campaign.recording_enabled,
        predictiveLines: campaign.predictive_lines_per_agent,
        maskLeadNumbers: !!campaign.mask_lead_numbers,
        agentPicksMode: !!campaign.agent_picks_mode,
        createdAt: campaign.created_at,
      },
      team: ownedTeam ? { id: ownedTeam.id, name: ownedTeam.name, accessMode } : null,
      agents,
      isCampaignOwner,
    })
  } catch (error: any) {
    console.error('Campaign detail error:', error)
    return apiError(error, { route: 'teams/campaigns/detail' })
  }
}
