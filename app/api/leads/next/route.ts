import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { isCallableNow } from '@/lib/callingWindow'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

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
        // Distinguish between "no leads" and "all leads outside callable window".
        // Surface the REAL reason from isCallableNow (e.g. "Unknown state —
        // cannot determine calling window", a Sunday-calling restriction, or an
        // actual too-early/too-late window) instead of a hardcoded 8am-9pm
        // message that's misleading when the true cause is something else
        // (like a lead missing state data / an unrecognized area code).
        const hasAnyCandidates = (candidates?.length || 0) > 0
        return NextResponse.json({
          success: false,
          error: hasAnyCandidates
            ? (blockReason || 'All available leads are outside their local calling window. Try again later.')
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

    // If the client asked for a specific campaign, check THAT campaign's
    // status directly rather than only checking "does this user have any
    // active campaign at all". Previously, requesting a specific inactive
    // campaign_id while the user had zero active campaigns produced the
    // generic 'No active campaigns' message (fine), but if the user had a
    // DIFFERENT active campaign, the code silently queried leads under the
    // requested (inactive) campaign anyway — worse, if that campaign had no
    // matching leads it surfaced as 'No more leads', which reads exactly like
    // the campaign is exhausted rather than simply turned off.
    if (campaign_id && campaign_id !== 'all' && !activeCampaignIds.includes(campaign_id)) {
      const { data: requested } = await supabaseAdmin
        .from('campaigns')
        .select('id, status, user_id')
        .eq('id', campaign_id)
        .maybeSingle()

      if (!requested || requested.user_id !== user_id) {
        return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: false,
        error: `Campaign is ${requested.status || 'inactive'}, not active. Turn it on to start dialing.`,
      }, { status: 404 })
    }

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

    // Filter to only leads currently inside their local TCPA window, keeping
    // the real reason for the first blocked lead so a data problem (missing
    // state, unrecognized area code) isn't misreported as a time-of-day issue.
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