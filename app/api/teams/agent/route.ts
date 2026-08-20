import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

const DEFAULT_CONVERSIONS = ['APPOINTMENT', 'CLOSED']
const CONTACT_DISPOSITIONS = new Set([
  'APPOINTMENT', 'CLOSED', 'NOT INTERESTED', 'DO NOT CALL', 'completed',
])
const LIVE_HEARTBEAT_SECONDS = 90

// ─────────────────────────────────────────────────────────────────────────
// ONE AGENT, AS SEEN BY THE OWNER PAYING FOR THEM
//
// Everything an owner knows about somebody was scattered: their seat in All
// Users, their campaigns in the tree, their dialing buried in a floor-wide
// table. Answering "how is this person doing" meant reading three screens and
// holding the join in your head.
//
// SCOPED TO THIS OWNER'S TEAM CAMPAIGNS, ALWAYS. An agent may dial their own
// leads on their own subscription, and that work is none of the owner's
// business — it is not on a campaign they provided and not on a seat they are
// paying for. Counting it here would show an owner activity they have no claim
// to, and inflate the numbers they judge a seat by.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = req.nextUrl.searchParams.get('userId')
    const range = req.nextUrl.searchParams.get('range') || 'week'
    if (!agentId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })
    }

    const days = range === 'today' ? 1 : range === 'month' ? 30 : 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // ── TWO WAYS TO BE ENTITLED TO THIS PAGE ─────────────────────────────
    // You own a team they are on, or it is you. An agent has every right to see
    // their own numbers — it is their work — and building a second endpoint for
    // it would be two implementations of one query drifting apart.
    //
    // The SCOPE differs, though: an owner sees this person across the teams the
    // owner runs, and an agent sees themselves across the teams they belong to.
    // Neither ever sees a team they have nothing to do with.
    const isSelf = agentId === userId

    let teams: any[] = []
    if (isSelf) {
      const { data: myMemberships } = await supabaseAdmin
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(200)
      const myTeamIds = Array.from(
        new Set((myMemberships || []).map((m: any) => m.team_id).filter(Boolean))
      )
      if (myTeamIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('teams')
          .select('id, name')
          .in('id', myTeamIds)
        teams = data || []
      }
    } else {
      const { data } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('owner_id', userId)
      teams = data || []
    }

    const teamIds = (teams || []).map((t: any) => t.id)
    if (teamIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No teams' }, { status: 404 })
    }
    const teamNameById = new Map((teams || []).map((t: any) => [t.id, t.name]))

    // The membership IS the authorisation. Somebody who is not on one of this
    // owner's teams is not theirs to look at, and a userId in a query string
    // is not proof of anything.
    const { data: memberships } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, status, accepted_at, created_at, joined_via_code, billing_override, seat_suspended_at, seat_suspend_reason, billing_takeover_at')
      .eq('user_id', agentId)
      .in('team_id', teamIds)
      .in('status', ['active', 'pending'])

    const memberRows = memberships || []
    if (memberRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not on any of your teams' },
        { status: 403 }
      )
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, clerk_id, email, first_name, last_name, created_at')
      .eq('clerk_id', agentId)
      .maybeSingle()

    const name =
      [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
      user?.email ||
      'Agent'

    // ── CAMPAIGNS THEY CAN DIAL, ON THIS OWNER'S TEAMS ───────────────────
    const memberIds = memberRows.map((m: any) => m.id)
    const { data: access } = await supabaseAdmin
      .from('team_campaign_access')
      .select('id, team_id, team_member_id, campaign_id, payer, access_source, granted_at')
      .in('team_member_id', memberIds)
      .eq('is_active', true)
      .limit(500)

    const accessRows = access || []
    const campaignIds = Array.from(new Set(accessRows.map((a: any) => a.campaign_id)))

    // Everything attached to this owner's teams — the boundary for what counts
    // as "work they did for me".
    const { data: teamCampaignRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id, team_id')
      .in('team_id', teamIds)
      .limit(2000)

    const ownerCampaignIds = Array.from(
      new Set((teamCampaignRows || []).map((r: any) => r.campaign_id).filter(Boolean))
    )

    const campaignMeta = new Map<string, any>()
    const allIds = Array.from(new Set([...campaignIds, ...ownerCampaignIds]))
    if (allIds.length > 0) {
      const { data: camps } = await supabaseAdmin
        .from('campaigns')
        .select('id, name, status, dialer_mode, conversion_dispositions')
        .in('id', allIds)
      for (const c of camps || []) campaignMeta.set(c.id, c)
    }

    // ── DIALING, ON THIS OWNER'S CAMPAIGNS ONLY ──────────────────────────
    // Aggregated in Postgres. One agent at a thousand calls a day passes the
    // old 20,000-row cap inside a month, and a capped month reports three
    // weeks as though it were four.
    let totalCalls = 0
    let conversions = 0
    let contacted = 0
    let talk = 0
    let talkCalls = 0
    let lastCallAt: string | null = null
    const byDay = new Map<string, number>()
    const byCampaign = new Map<string, { calls: number; conversions: number }>()

    if (ownerCampaignIds.length > 0) {
      const { data: agg } = await supabaseAdmin.rpc('call_agg_by_day_campaign', {
        p_campaign_ids: ownerCampaignIds,
        p_since: since.toISOString(),
        p_until: null,
        p_agent: agentId,
      })

      for (const r of agg || []) {
        const n = Number(r.calls) || 0
        const t = Number(r.talk_seconds) || 0
        const disp = (r.disposition || '').toUpperCase()
        const meta = campaignMeta.get(r.campaign_id)
        const convSet = new Set<string>(
          (Array.isArray(meta?.conversion_dispositions) && meta.conversion_dispositions.length > 0
            ? meta.conversion_dispositions
            : DEFAULT_CONVERSIONS
          ).map((d: string) => d.toUpperCase())
        )
        const isConv = !!disp && convSet.has(disp)

        totalCalls += n
        if (isConv) conversions += n
        if (r.disposition && CONTACT_DISPOSITIONS.has(r.disposition)) contacted += n
        talk += t
        if (t > 0) talkCalls += n

        byDay.set(r.day, (byDay.get(r.day) || 0) + n)

        const bc = byCampaign.get(r.campaign_id) || { calls: 0, conversions: 0 }
        bc.calls += n
        if (isConv) bc.conversions += n
        byCampaign.set(r.campaign_id, bc)
      }

      // The grouping loses exact timestamps, so "last call" comes from its own
      // one-row query rather than being inferred from the newest day — a day
      // bucket cannot tell you whether they stopped at nine or at five.
      const { data: lastRow } = await supabaseAdmin
        .from('calls')
        .select('created_at')
        .eq('user_id', agentId)
        .in('campaign_id', ownerCampaignIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastCallAt = lastRow?.created_at ?? null
    }

    // Empty days included, so a gap reads as a day off rather than vanishing
    // from the line and making the pattern look denser than it was.
    const series: Array<{ label: string; value: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const k = d.toISOString().slice(0, 10)
      series.push({ label: k, value: byDay.get(k) || 0 })
    }

    // ── ARE THEY WORKING RIGHT NOW ───────────────────────────────────────
    let liveNow: any = null
    if (user?.id) {
      const cutoff = new Date(Date.now() - LIVE_HEARTBEAT_SECONDS * 1000).toISOString()
      const { data: session } = await supabaseAdmin
        .from('agent_sessions')
        .select('state, dialer_mode, campaign_id, current_call_id, session_started_at, last_heartbeat')
        .eq('user_id', user.id)
        .gte('last_heartbeat', cutoff)
        .order('last_heartbeat', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (session) {
        liveNow = {
          state: session.state,
          onCall: !!session.current_call_id,
          mode: session.dialer_mode,
          campaign: session.campaign_id
            ? (campaignMeta.get(session.campaign_id)?.name || 'Campaign')
            : null,
          startedAt: session.session_started_at,
        }
      }
    }

    return NextResponse.json({
      success: true,
      range,
      days,
      agent: {
        userId: agentId,
        name,
        email: user?.email ?? null,
        joinedPlatformAt: user?.created_at ?? null,
      },
      liveNow,
      memberships: memberRows.map((m: any) => ({
        memberId: m.id,
        teamId: m.team_id,
        teamName: teamNameById.get(m.team_id) || 'Team',
        status: m.status,
        suspended: !!m.seat_suspended_at,
        suspendReason: m.seat_suspend_reason || null,
        pickedUp: !!m.billing_takeover_at,
        billingOverride: m.billing_override || null,
        joinedViaCode: m.joined_via_code || null,
        joinedAt: m.accepted_at || m.created_at,
      })),
      campaigns: accessRows.map((a: any) => {
        const meta = campaignMeta.get(a.campaign_id)
        const stat = byCampaign.get(a.campaign_id)
        return {
          campaignId: a.campaign_id,
          name: meta?.name || 'Campaign',
          status: meta?.status || null,
          teamName: teamNameById.get(a.team_id) || 'Team',
          payer: a.payer,
          calls: stat?.calls || 0,
          conversions: stat?.conversions || 0,
        }
      }).sort((a: any, b: any) => b.calls - a.calls),
      stats: {
        calls: totalCalls,
        conversions,
        conversionRate: totalCalls > 0
          ? Math.round((conversions / totalCalls) * 1000) / 10
          : null,
        contactRate: totalCalls > 0
          ? Math.round((contacted / totalCalls) * 1000) / 10
          : null,
        talkSeconds: talk,
        avgTalkSeconds: talkCalls > 0 ? Math.round(talk / talkCalls) : null,
        lastCallAt,
        // Named so nobody mistakes this for everything the person did.
        scope: isSelf
          ? 'Your team campaigns only'
          : 'Your team campaigns only',
        isSelf,
      },
      series,
    })
  } catch (error: any) {
    console.error('Agent detail error:', error)
    return apiError(error, { route: 'teams/agent' })
  }
}
