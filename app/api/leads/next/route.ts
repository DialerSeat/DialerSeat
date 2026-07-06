import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { isCallableNow } from '@/lib/callingWindow'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const CANDIDATE_LIMIT = 50

async function fetchCampaignMode(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('dialer_mode, amd_enabled')
    .eq('id', campaignId)
    .maybeSingle()
  return {
    dialer_mode: (data?.dialer_mode as string) || 'power',
    amd_enabled: data?.amd_enabled !== false,
  }
}

export async function GET(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const user_id = gate.userId

    const { searchParams } = new URL(req.url)
    const campaign_id = searchParams.get('campaign_id')
    const team_id = searchParams.get('team_id')

    if (team_id) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id, owner_id')
        .eq('id', team_id)
        .maybeSingle()

      if (!team) {
        return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
      }

      const isOwner = team.owner_id === user_id
      if (!isOwner) {
        const { data: membership } = await supabaseAdmin
          .from('team_members')
          .select('id')
          .eq('team_id', team_id)
          .eq('user_id', user_id)
          .eq('status', 'active')
          .maybeSingle()
        if (!membership) {
          return NextResponse.json({ success: false, error: 'Not a member of this team' }, { status: 403 })
        }
      }

      const { data: tcRows } = await supabaseAdmin
        .from('team_campaigns')
        .select('campaign_id, campaigns(status)')
        .eq('team_id', team_id)

      const teamCampaignIds = (tcRows || [])
        .filter((tc: any) => tc.campaigns?.status === 'active')
        .map((tc: any) => tc.campaign_id)

      if (teamCampaignIds.length === 0) {
        return NextResponse.json({ success: false, error: 'No active campaigns in team' }, { status: 404 })
      }

      let scopedCampaignIds: string[]
      if (campaign_id && campaign_id !== 'all') {
        if (!teamCampaignIds.includes(campaign_id)) {
          return NextResponse.json({ success: false, error: 'Campaign not in team' }, { status: 403 })
        }
        scopedCampaignIds = [campaign_id]
      } else {
        scopedCampaignIds = teamCampaignIds
      }

      const { data: candidates, error } = await supabaseAdmin
        .from('leads')
        .select('*, extra_data')
        .in('campaign_id', scopedCampaignIds)
        .neq('status', 'dnc')
        .neq('status', 'closed')
        .neq('status', 'appointment')
        .neq('status', 'maxed')
        .or(`status.eq.uncalled,status.eq.no_answer`)
        .not('phone', 'is', null)
        .neq('phone', '')
        .order('dial_attempts', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(CANDIDATE_LIMIT)

      if (error) {
        return apiError(error, { route: 'leads/next' })
      }

      let callable: any = null
      let blockReason: string | null = null
      for (const c of candidates || []) {
        const result = isCallableNow({ phone: c.phone, state: c.state })
        if (result.allowed) { callable = c; break }
        if (!blockReason) blockReason = result.reason || null
      }

      if (!callable) {

        const hasAnyCandidates = (candidates?.length || 0) > 0
        return NextResponse.json({
          success: false,
          // Previously hardcoded to an "outside 8am-9pm window" message no
          // matter which of isCallableNow's checks actually failed (e.g. a
          // federal holiday), which read as a clock bug when the real reason
          // was the calendar date.
          error: hasAnyCandidates
            ? (blockReason || 'All available leads are outside their local calling window. Try again later.')
            : 'No more team leads',
          tcpaBlocked: hasAnyCandidates,
        }, { status: 404 })
      }

      const campaign = await fetchCampaignMode(callable.campaign_id)
      return NextResponse.json({ success: true, lead: callable, campaign })
    }

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
      .limit(CANDIDATE_LIMIT)

    if (campaign_id && campaign_id !== 'all') {
      query = query.eq('campaign_id', campaign_id)
    } else {
      query = query.in('campaign_id', activeCampaignIds)
    }

    const { data: candidates, error } = await query

    if (error) {
      return apiError(error, { route: 'leads/next' })
    }

    let callable: any = null
    let blockReason: string | null = null
    for (const c of candidates || []) {
      const result = isCallableNow({ phone: c.phone, state: c.state })
      if (result.allowed) { callable = c; break }
      if (!blockReason) blockReason = result.reason || null
    }

    if (!callable) {
      const hasAnyCandidates = (candidates?.length || 0) > 0
      return NextResponse.json({
        success: false,
        error: hasAnyCandidates
          ? (blockReason || 'All available leads are outside their local calling window. Try again later.')
          : 'No more leads',
        tcpaBlocked: hasAnyCandidates,
      }, { status: 404 })
    }

    const campaign = await fetchCampaignMode(callable.campaign_id)
    return NextResponse.json({ success: true, lead: callable, campaign })
  } catch (error: any) {
    return apiError(error, { route: 'leads/next' })
  }
}