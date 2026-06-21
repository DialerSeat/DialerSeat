import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { isCallableNow } from '@/lib/callingWindow'
import { requireUser } from '@/lib/requireUser'

// SECURITY (was IDOR): this route took ?user_id from the query string and used
// it for BOTH personal lead scoping AND team-membership verification. That let
// any signed-in user (a) pull another user's personal leads, and (b) spoof
// membership by passing a real member's id. Identity now comes from the Clerk
// session; the query param is ignored.

// How many candidate leads to evaluate before giving up.
// We over-fetch then filter in JS because Supabase can't run our time-zone
// logic. Most pools at 50-200 leads, this is plenty.
const CANDIDATE_LIMIT = 50

// Fetch the campaign's dialer mode + AMD setting so the client can drive
// per-call behavior (especially for ALL_ACTIVE which dials across many
// campaigns each with its own mode). Falls back to power+AMD-on if not set.
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

    // ── TEAM SCOPE ──
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

      // Fetch a batch of candidates, then filter by calling window in JS
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      const callable = (candidates || []).find(c => isCallableNow({
        phone: c.phone,
        state: c.state,
      }).allowed)

      if (!callable) {
        // Distinguish between "no leads" and "all leads outside callable window"
        const hasAnyCandidates = (candidates?.length || 0) > 0
        return NextResponse.json({
          success: false,
          error: hasAnyCandidates
            ? 'All available leads are outside their local 8am-9pm calling window. Try again in a few hours.'
            : 'No more team leads',
          tcpaBlocked: hasAnyCandidates,
        }, { status: 404 })
      }

      const campaign = await fetchCampaignMode(callable.campaign_id)
      return NextResponse.json({ success: true, lead: callable, campaign })
    }

    // ── PERSONAL SCOPE ──
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Filter to only leads currently inside their local TCPA window
    const callable = (candidates || []).find(c => isCallableNow({
      phone: c.phone,
      state: c.state,
    }).allowed)

    if (!callable) {
      const hasAnyCandidates = (candidates?.length || 0) > 0
      return NextResponse.json({
        success: false,
        error: hasAnyCandidates
          ? 'All available leads are outside their local 8am-9pm calling window. Try again in a few hours.'
          : 'No more leads',
        tcpaBlocked: hasAnyCandidates,
      }, { status: 404 })
    }

    const campaign = await fetchCampaignMode(callable.campaign_id)
    return NextResponse.json({ success: true, lead: callable, campaign })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}