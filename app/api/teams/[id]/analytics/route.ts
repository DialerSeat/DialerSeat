import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Per-team analytics for the dashboard at /dashboard/teams/[id]/analytics.
 *
 * History: this handler used to live at app/dashboard/teams/[id]/route.ts.
 * That path collided with the page URL — a `route.ts` and a `page.tsx`
 * can't share an App Router segment, and the browser hitting the page
 * URL was getting either JSON or a 404 depending on Next.js routing
 * resolution. Moving the handler under /api decouples it from the page
 * URL entirely.
 *
 * Owner sees: leaderboard (all members), team totals, recent calls feed,
 *             plus the same totals filterable by campaign or member.
 * Member sees: only their own stats (no peer leaderboard, no calls feed
 *              that exposes other members' activity).
 *
 * Query params:
 *   range:       'today' | 'week' | 'month' | 'custom' | 'all' (default 'week')
 *   start:       ISO date string (required when range='custom')
 *   end:         ISO date string (required when range='custom')
 *   campaign_id: filter calls to one campaign (must be attached to this team)
 *   user_id:     filter calls to one member (owner-only — members are auto-scoped)
 */

type Range = 'today' | 'week' | 'month' | 'custom' | 'all'

function rangeBounds(
  range: Range,
  start: string | null,
  end: string | null
): { since: Date | null; until: Date | null } {
  if (range === 'custom') {
    return {
      since: start ? new Date(start) : null,
      until: end ? new Date(end) : null,
    }
  }
  const now = new Date()
  if (range === 'today') {
    return { since: new Date(now.getFullYear(), now.getMonth(), now.getDate()), until: null }
  }
  if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return { since: d, until: null }
  }
  if (range === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 30)
    return { since: d, until: null }
  }
  return { since: null, until: null }
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
    const validRanges: Range[] = ['today', 'week', 'month', 'custom', 'all']
    const range: Range = validRanges.includes(rangeParam) ? rangeParam : 'week'
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const filterCampaignId = searchParams.get('campaign_id')
    const filterUserId = searchParams.get('user_id')

    // Team + viewer role
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (teamErr) throw teamErr
    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })

    const isOwner = team.owner_id === userId

    if (!isOwner) {
      const { data: m } = await supabaseAdmin
        .from('team_members')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (!m) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Roster — owner always included as a "member" for their own stats
    const { data: memberRows } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active')

    const memberClerkIds = Array.from(new Set([
      team.owner_id,
      ...(memberRows || []).map((m: any) => m.user_id),
    ]))

    // Identity resolution
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('clerk_id, email, first_name, last_name, last_seen_at')
      .in('clerk_id', memberClerkIds)

    const userById: Record<string, any> = {}
    for (const u of userRows || []) userById[u.clerk_id] = u

    // Attached campaigns
    const { data: tcRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id, access_mode, campaigns(id, name)')
      .eq('team_id', teamId)

    const teamCampaigns = (tcRows || []).map((r: any) => ({
      campaignId: r.campaign_id,
      accessMode: r.access_mode,
      name: r.campaigns?.name || null,
    }))
    const campaignIds = teamCampaigns.map(tc => tc.campaignId)

    // Validate campaign filter (must be attached to this team)
    let scopedCampaignIds = campaignIds
    if (filterCampaignId) {
      if (!campaignIds.includes(filterCampaignId)) {
        return NextResponse.json(
          { success: false, error: 'Campaign not attached to this team' },
          { status: 400 }
        )
      }
      scopedCampaignIds = [filterCampaignId]
    }

    // Build calls query
    let callsQuery = supabaseAdmin
      .from('calls')
      .select('id, user_id, campaign_id, lead_id, disposition, duration, created_at, leads(first_name, last_name, phone)')
      .in('campaign_id', scopedCampaignIds.length > 0 ? scopedCampaignIds : ['__none__'])

    const { since, until } = rangeBounds(range, startParam, endParam)
    if (since) callsQuery = callsQuery.gte('created_at', since.toISOString())
    if (until) callsQuery = callsQuery.lte('created_at', until.toISOString())

    // Scope to user: members locked to themselves; owners default to all, optionally filter
    if (!isOwner) {
      callsQuery = callsQuery.eq('user_id', userId)
    } else if (filterUserId) {
      if (!memberClerkIds.includes(filterUserId)) {
        return NextResponse.json(
          { success: false, error: 'User not in this team' },
          { status: 400 }
        )
      }
      callsQuery = callsQuery.eq('user_id', filterUserId)
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

    // Seed by relevant member set so zero-activity members still appear in leaderboard
    const seedSet = filterUserId ? [filterUserId] : memberClerkIds
    for (const uid of seedSet) statsByUser[uid] = seedFor(uid)

    const teamTotals = { calls: 0, connected: 0, conversions: 0, talkSeconds: 0 }

    for (const c of calls || []) {
      const uid = c.user_id
      if (!statsByUser[uid]) statsByUser[uid] = seedFor(uid)
      const s = statsByUser[uid]
      s.calls++; teamTotals.calls++
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

    const viewerStats = statsByUser[userId] || seedFor(userId)

    // Recent calls feed — owner only
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
          campaignId: c.campaign_id,
        }
      })
    }

    return NextResponse.json({
      success: true,
      range,
      viewerRole: isOwner ? 'owner' : 'member',
      team: { id: team.id, name: team.name },
      campaigns: teamCampaigns,
      members: memberClerkIds.map(uid => {
        const u = userById[uid]
        const name = u
          ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || uid.slice(0, 12)
          : uid.slice(0, 12)
        return { userId: uid, name, isOwner: uid === team.owner_id }
      }),
      totals: teamTotals,
      leaderboard: isOwner ? leaderboard : [],
      viewerStats,
      recentCalls,
      filters: {
        campaignId: filterCampaignId,
        userId: filterUserId,
      },
    })
  } catch (error: any) {
    console.error('Team analytics error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}