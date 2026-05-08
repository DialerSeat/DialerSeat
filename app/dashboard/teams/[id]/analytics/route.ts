import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Per-team analytics for the dashboard at /dashboard/teams/[id].
 *
 * Owner sees: leaderboard (all members), team totals, recent calls feed, own stats.
 * Member sees: only their own stats + team totals (no peer leaderboard for privacy).
 *
 * Query params:
 *   range: 'today' | 'week' | 'month' | 'all' (default: 'week')
 */

type Range = 'today' | 'week' | 'month' | 'all'

function rangeStart(range: Range): Date | null {
  const now = new Date()
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (range === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (range === 'month') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return d
  }
  return null
}

const CONVERSION_DISPOS = new Set(['CLOSED', 'APPOINTMENT'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params
    const { searchParams } = new URL(req.url)
    const rangeParam = (searchParams.get('range') || 'week') as Range
    const validRanges: Range[] = ['today', 'week', 'month', 'all']
    const range: Range = validRanges.includes(rangeParam) ? rangeParam : 'week'

    // Verify team exists + viewer role
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (teamErr) throw teamErr
    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })

    const isOwner = team.owner_id === userId
    let viewerMembership: any = null

    if (!isOwner) {
      const { data: m } = await supabaseAdmin
        .from('team_members')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (!m) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      viewerMembership = m
    }

    // Compose member id list — owner is always included as a "member" for their own stats
    const { data: memberRows } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active')

    const memberClerkIds = Array.from(new Set([
      team.owner_id,
      ...(memberRows || []).map((m: any) => m.user_id),
    ]))

    // Resolve identities
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('clerk_id, email, first_name, last_name, last_seen_at')
      .in('clerk_id', memberClerkIds)

    const userById: Record<string, any> = {}
    for (const u of userRows || []) userById[u.clerk_id] = u

    // Get campaigns attached to this team — calls are scoped through these
    const { data: tcRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id')
      .eq('team_id', teamId)

    const campaignIds = (tcRows || []).map((r: any) => r.campaign_id)

    // Build calls query — scoped to team's attached campaigns
    let callsQuery = supabaseAdmin
      .from('calls')
      .select('id, user_id, campaign_id, lead_id, disposition, duration, created_at, leads(first_name, last_name, phone)')
      .in('campaign_id', campaignIds.length > 0 ? campaignIds : ['__none__'])

    const since = rangeStart(range)
    if (since) callsQuery = callsQuery.gte('created_at', since.toISOString())

    // Member sees only their own calls; owner sees all team calls
    if (!isOwner) {
      callsQuery = callsQuery.eq('user_id', userId)
    } else {
      callsQuery = callsQuery.in('user_id', memberClerkIds)
    }

    callsQuery = callsQuery.order('created_at', { ascending: false }).limit(2000)

    const { data: calls, error: callsErr } = await callsQuery
    if (callsErr) throw callsErr

    // Roll up per-member stats
    type MemberStat = {
      userId: string
      name: string
      email: string | null
      lastSeenAt: string | null
      isOwner: boolean
      calls: number
      connected: number
      conversions: number
      talkSeconds: number
    }
    const statsByUser: Record<string, MemberStat> = {}

    const seedFor = (uid: string): MemberStat => {
      const u = userById[uid]
      const name = u
        ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || uid.slice(0, 12)
        : uid.slice(0, 12)
      return {
        userId: uid,
        name,
        email: u?.email || null,
        lastSeenAt: u?.last_seen_at || null,
        isOwner: uid === team.owner_id,
        calls: 0,
        connected: 0,
        conversions: 0,
        talkSeconds: 0,
      }
    }

    // Seed every active member so they appear with zeros if no activity
    for (const uid of memberClerkIds) statsByUser[uid] = seedFor(uid)

    let teamTotals = { calls: 0, connected: 0, conversions: 0, talkSeconds: 0 }

    for (const c of calls || []) {
      const uid = c.user_id
      if (!statsByUser[uid]) statsByUser[uid] = seedFor(uid)
      const s = statsByUser[uid]
      s.calls++
      teamTotals.calls++
      if (c.duration && c.duration > 0) {
        s.connected++
        s.talkSeconds += c.duration
        teamTotals.connected++
        teamTotals.talkSeconds += c.duration
      }
      if (c.disposition && CONVERSION_DISPOS.has(c.disposition)) {
        s.conversions++
        teamTotals.conversions++
      }
    }

    const leaderboard = Object.values(statsByUser).sort((a, b) => {
      if (b.conversions !== a.conversions) return b.conversions - a.conversions
      return b.calls - a.calls
    })

    // Viewer's own stats
    const viewerStats = statsByUser[userId] || seedFor(userId)

    // Recent calls feed (owner only) — last 50
    let recentCalls: any[] = []
    if (isOwner) {
      recentCalls = (calls || []).slice(0, 50).map((c: any) => {
        const lead = c.leads || {}
        const u = userById[c.user_id]
        const memberName = u
          ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || c.user_id.slice(0, 12)
          : c.user_id.slice(0, 12)
        const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone || '—'
        return {
          id: c.id,
          memberName,
          leadName,
          phone: lead.phone || null,
          disposition: c.disposition || null,
          duration: c.duration || 0,
          createdAt: c.created_at,
        }
      })
    }

    return NextResponse.json({
      success: true,
      range,
      viewerRole: isOwner ? 'owner' : 'member',
      team: { id: team.id, name: team.name },
      totals: teamTotals,
      leaderboard: isOwner ? leaderboard : [], // members don't see peers
      viewerStats,
      recentCalls,
    })
  } catch (error: any) {
    console.error('Team analytics error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}