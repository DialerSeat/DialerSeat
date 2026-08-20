import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// THE FLOOR — WHO IS WORKING RIGHT NOW, AND WHO IS NOT
//
// Two questions in one place because they are the same question asked over two
// timescales. "Who is live" is what a manager watches during a shift. "Which
// seats barely dialed this week" is what they look at before renewal — and it
// is deliberately shown to the owner even though it costs us money, because a
// vendor who discovers on their own that they paid for eight idle seats trusts
// the invoice less than one we showed it to.
//
// A session is LIVE if its heartbeat is recent. The heartbeat runs every ~5s,
// so anything older than 90 seconds is a closed laptop, not a working agent —
// counting those would tell a manager their floor is full when half of it went
// home.
// ─────────────────────────────────────────────────────────────────────────

const LIVE_HEARTBEAT_SECONDS = 90

// ── WHY THESE ARE NOT `.in(everyAgentId)` ────────────────────────────────
// A PostgREST filter travels in the URL. Ten thousand Clerk ids in an `.in()`
// is roughly 350KB of query string against a limit around 31KB — the request
// does not slow down, it 414s and the page shows an empty floor. So both of the
// big lookups below are scoped by something small (a heartbeat cutoff, a list
// of campaign ids) and narrowed in memory afterwards.
const MEMBER_CAP = 10000
const LIVE_SESSION_CAP = 5000
// The roster is shown quietest-first, which is the only part anybody acts on.
// Returning ten thousand rows so a browser can render the bottom two hundred is
// ten thousand rows nobody reads.
const USAGE_ROWS = 250

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const range = req.nextUrl.searchParams.get('range') || 'week'
    const days = range === 'today' ? 1 : range === 'month' ? 30 : 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('owner_id', userId)

    const teamIds = (teams || []).map((t: any) => t.id)
    if (teamIds.length === 0) {
      return NextResponse.json({
        success: true, live: [], usage: [], usageTotal: 0, usageShown: 0,
        liveCount: 0, teams: [],
      })
    }
    const teamNameById = new Map((teams || []).map((t: any) => [t.id, t.name]))

    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, seat_suspended_at, billing_override, joined_via_code')
      .in('team_id', teamIds)
      .eq('status', 'active')
      .limit(MEMBER_CAP)

    const memberRows = members || []
    if (memberRows.length === 0) {
      return NextResponse.json({
        success: true, live: [], usage: [], usageTotal: 0, usageShown: 0,
        liveCount: 0, teams: teams || [],
      })
    }

    const clerkIds = Array.from(new Set(memberRows.map((m: any) => m.user_id)))

    // agent_sessions.user_id is the users.id UUID, not the Clerk id. Two
    // different identifiers for the same person, and joining on the wrong one
    // returns an empty floor rather than an error.
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('id, clerk_id, email, first_name, last_name')
      .in('clerk_id', clerkIds)

    const byClerk = new Map((userRows || []).map((u: any) => [u.clerk_id, u]))
    const byUuid = new Map((userRows || []).map((u: any) => [u.id, u]))
    const displayName = (u: any) =>
      u ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Agent') : 'Agent'

    // ── LIVE ─────────────────────────────────────────────────────────────
    const liveCutoff = new Date(Date.now() - LIVE_HEARTBEAT_SECONDS * 1000).toISOString()
    const userUuids = (userRows || []).map((u: any) => u.id)

    let live: any[] = []
    if (userUuids.length > 0) {
      // Every session that is live ANYWHERE, then narrowed to this owner's
      // people in memory. Bounded by how many agents are simultaneously dialing
      // on the whole platform, which is a far smaller number than how many
      // agents exist — and it keeps the agent ids out of the URL.
      const mine = new Set(userUuids)
      const { data: allSessions } = await supabaseAdmin
        .from('agent_sessions')
        .select('user_id, team_id, campaign_id, state, dialer_mode, last_heartbeat, session_started_at, current_call_id')
        .gte('last_heartbeat', liveCutoff)
        .limit(LIVE_SESSION_CAP)

      const sessions = (allSessions || []).filter((sn: any) => mine.has(sn.user_id))

      const campaignIds = Array.from(
        new Set((sessions || []).map((s: any) => s.campaign_id).filter(Boolean))
      )
      const campaignName = new Map<string, string>()
      if (campaignIds.length > 0) {
        const { data: camps } = await supabaseAdmin
          .from('campaigns')
          .select('id, name')
          .in('id', campaignIds)
        for (const c of camps || []) campaignName.set(c.id, c.name)
      }

      live = (sessions || []).map((s: any) => {
        const u = byUuid.get(s.user_id)
        return {
          userId: u?.clerk_id ?? null,
          name: displayName(u),
          state: s.state,
          onCall: !!s.current_call_id,
          mode: s.dialer_mode,
          campaign: s.campaign_id ? (campaignName.get(s.campaign_id) || 'Campaign') : null,
          teamName: s.team_id ? (teamNameById.get(s.team_id) || null) : null,
          startedAt: s.session_started_at,
          lastHeartbeat: s.last_heartbeat,
        }
      })
    }

    // ── USAGE OVER THE RANGE ─────────────────────────────────────────────
    // Counted per agent from their own call rows. An agent on two of this
    // owner's teams is one person with one usage figure, which is why this is
    // keyed by clerk id rather than by membership.
    // Scoped by the team's campaigns — a handful of ids — rather than by every
    // agent. Same rows, a query string that fits, and it stays correct however
    // many agents the owner has.
    const { data: teamCampaignRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id')
      .in('team_id', teamIds)

    const scopedCampaignIds = Array.from(
      new Set((teamCampaignRows || []).map((r: any) => r.campaign_id).filter(Boolean))
    )

    // ── ONE ROW PER AGENT, NOT ONE PER CALL ───────────────────────────────
    // This pulled every call row for the range and counted them in JavaScript.
    // Fifty seats at a thousand leads a day is 350,000 rows across a week —
    // past any cap, and a cap here means an owner's usage figures quietly
    // describe a fraction of the week while looking like the whole of it.
    //
    // Grouped in Postgres, a floor of fifty is fifty rows however hard they
    // dial.
    const memberSet = new Set(clerkIds)
    const stats = new Map<string, { calls: number; talk: number; today: number; last: string | null }>()

    if (scopedCampaignIds.length > 0) {
      const { data: agg } = await supabaseAdmin.rpc('call_agg_by_agent', {
        p_campaign_ids: scopedCampaignIds,
        p_since: since.toISOString(),
        p_today: todayStart.toISOString(),
      })

      for (const r of agg || []) {
        // A campaign can also be dialed by its owner outside any team, so rows
        // are narrowed to actual members rather than assumed to be theirs.
        if (!memberSet.has(r.user_id)) continue
        stats.set(r.user_id, {
          calls: Number(r.calls) || 0,
          talk: Number(r.talk_seconds) || 0,
          today: Number(r.calls_today) || 0,
          last: r.last_call_at || null,
        })
      }
    }

    // One row per membership: the same person on two teams is two seats, and
    // two seats is what the owner is paying for.
    const usage = memberRows.map((m: any) => {
      const u = byClerk.get(m.user_id)
      const st = stats.get(m.user_id) || { calls: 0, talk: 0, today: 0, last: null }
      return {
        memberId: m.id,
        userId: m.user_id,
        name: displayName(u),
        email: u?.email ?? null,
        teamName: teamNameById.get(m.team_id) || 'Team',
        suspended: !!m.seat_suspended_at,
        calls: st.calls,
        callsToday: st.today,
        talkSeconds: st.talk,
        lastCallAt: st.last,
      }
    }).sort((a, b) => a.calls - b.calls)

    // Quietest first, capped. The count of everybody is still reported, so the
    // page can say "showing the 250 quietest of 8,431" rather than implying the
    // list is the whole roster.
    const usageShown = usage.slice(0, USAGE_ROWS)

    return NextResponse.json({
      success: true,
      range,
      days,
      liveWindowSeconds: LIVE_HEARTBEAT_SECONDS,
      live: live.sort((a, b) => (b.onCall ? 1 : 0) - (a.onCall ? 1 : 0)),
      usage: usageShown,
      usageTotal: usage.length,
      usageShown: usageShown.length,
      liveCount: live.length,
      teams: teams || [],
    })
  } catch (error: any) {
    console.error('Floor error:', error)
    return apiError(error, { route: 'teams/floor' })
  }
}
