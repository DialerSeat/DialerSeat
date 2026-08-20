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
      return NextResponse.json({ success: true, live: [], usage: [], teams: [] })
    }
    const teamNameById = new Map((teams || []).map((t: any) => [t.id, t.name]))

    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, seat_suspended_at, billing_override, joined_via_code')
      .in('team_id', teamIds)
      .eq('status', 'active')

    const memberRows = members || []
    if (memberRows.length === 0) {
      return NextResponse.json({ success: true, live: [], usage: [], teams: teams || [] })
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
      const { data: sessions } = await supabaseAdmin
        .from('agent_sessions')
        .select('user_id, team_id, campaign_id, state, dialer_mode, last_heartbeat, session_started_at, current_call_id')
        .in('user_id', userUuids)
        .gte('last_heartbeat', liveCutoff)

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
    const { data: calls } = await supabaseAdmin
      .from('calls')
      .select('user_id, talk_seconds, disposition, created_at')
      .in('user_id', clerkIds)
      .gte('created_at', since.toISOString())
      .limit(50000)

    const stats = new Map<string, { calls: number; talk: number; today: number; last: string | null }>()
    for (const c of calls || []) {
      const cur = stats.get(c.user_id) || { calls: 0, talk: 0, today: 0, last: null }
      cur.calls++
      cur.talk += typeof c.talk_seconds === 'number' ? c.talk_seconds : 0
      if (new Date(c.created_at) >= todayStart) cur.today++
      if (!cur.last || c.created_at > cur.last) cur.last = c.created_at
      stats.set(c.user_id, cur)
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

    return NextResponse.json({
      success: true,
      range,
      days,
      liveWindowSeconds: LIVE_HEARTBEAT_SECONDS,
      live: live.sort((a, b) => (b.onCall ? 1 : 0) - (a.onCall ? 1 : 0)),
      usage,
      teams: teams || [],
    })
  } catch (error: any) {
    console.error('Floor error:', error)
    return apiError(error, { route: 'teams/floor' })
  }
}
