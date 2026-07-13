import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

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

    const { data: memberRows } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active')

    const memberClerkIds = Array.from(new Set([
      team.owner_id,
      ...(memberRows || []).map((m: any) => m.user_id),
    ]))

    if (filterUserId && !memberClerkIds.includes(filterUserId)) {
      return NextResponse.json(
        { success: false, error: 'User not in this team' },
        { status: 400 }
      )
    }

    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('clerk_id, email, first_name, last_name, last_seen_at')
      .in('clerk_id', memberClerkIds)

    const userById: Record<string, any> = {}
    for (const u of userRows || []) userById[u.clerk_id] = u

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

    let calls: any[] = []
    const { since, until } = rangeBounds(range, startParam, endParam)
    if (scopedCampaignIds.length > 0) {
      let callsQuery = supabaseAdmin
        .from('calls')
        .select('id, user_id, campaign_id, lead_id, disposition, duration, created_at, leads(first_name, last_name, phone)')
        .in('campaign_id', scopedCampaignIds)

      if (since) callsQuery = callsQuery.gte('created_at', since.toISOString())
      if (until) callsQuery = callsQuery.lte('created_at', until.toISOString())

      if (!isOwner) {
        callsQuery = callsQuery.eq('user_id', userId)
      } else if (filterUserId) {
        callsQuery = callsQuery.eq('user_id', filterUserId)
      } else {
        callsQuery = callsQuery.in('user_id', memberClerkIds)
      }

      callsQuery = callsQuery.order('created_at', { ascending: false }).limit(2000)

      const { data, error: callsErr } = await callsQuery
      if (callsErr) throw callsErr
      calls = data || []
    }

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
      spentCents?: number
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

    const seedSet = filterUserId ? [filterUserId] : memberClerkIds
    for (const uid of seedSet) statsByUser[uid] = seedFor(uid)

    const teamTotals = { calls: 0, connected: 0, conversions: 0, talkSeconds: 0 }

    for (const c of calls) {
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

    // ── Campaign-level breakdown — same calls array, grouped differently.
    // Answers "which campaigns are actually performing", not just "which
    // agent is". Visible to the whole team, same as `totals` — it doesn't
    // reveal any one person's individual numbers.
    type CampaignStat = {
      campaignId: string
      name: string | null
      calls: number
      connected: number
      conversions: number
      talkSeconds: number
    }
    const statsByCampaign: Record<string, CampaignStat> = {}
    for (const cid of scopedCampaignIds) {
      const tc = teamCampaigns.find(t => t.campaignId === cid)
      statsByCampaign[cid] = { campaignId: cid, name: tc?.name || null, calls: 0, connected: 0, conversions: 0, talkSeconds: 0 }
    }
    for (const c of calls) {
      const cid = c.campaign_id
      if (!statsByCampaign[cid]) {
        const tc = teamCampaigns.find(t => t.campaignId === cid)
        statsByCampaign[cid] = { campaignId: cid, name: tc?.name || null, calls: 0, connected: 0, conversions: 0, talkSeconds: 0 }
      }
      const cs = statsByCampaign[cid]
      cs.calls++
      if (c.duration && c.duration > 0) { cs.connected++; cs.talkSeconds += c.duration }
      if (c.disposition && CONVERSION_DISPOS.has(c.disposition)) cs.conversions++
    }
    const campaignBreakdown = Object.values(statsByCampaign).sort((a, b) => b.calls - a.calls)

    // ── Trend series — the same calls, bucketed over time instead of
    // collapsed into one snapshot. Daily buckets normally; weekly once the
    // span gets long enough that a day-by-day chart would be unreadable.
    const seriesEndMs = until ? until.getTime() : Date.now()
    let seriesStartMs: number
    if (since) {
      seriesStartMs = since.getTime()
    } else if (calls.length > 0) {
      seriesStartMs = Math.min(...calls.map((c: any) => new Date(c.created_at).getTime()))
    } else {
      seriesStartMs = seriesEndMs
    }
    const daySpan = Math.max(1, Math.ceil((seriesEndMs - seriesStartMs) / 86_400_000))
    const bucketMs = daySpan > 120 ? 7 * 86_400_000 : 86_400_000
    const numBuckets = Math.min(400, Math.max(1, Math.floor((seriesEndMs - seriesStartMs) / bucketMs) + 1))
    const series: { date: string; calls: number; connected: number; conversions: number }[] = []
    for (let i = 0; i < numBuckets; i++) {
      series.push({ date: new Date(seriesStartMs + i * bucketMs).toISOString().slice(0, 10), calls: 0, connected: 0, conversions: 0 })
    }
    for (const c of calls) {
      const idx = Math.floor((new Date(c.created_at).getTime() - seriesStartMs) / bucketMs)
      if (idx >= 0 && idx < series.length) {
        series[idx].calls++
        if (c.duration && c.duration > 0) series[idx].connected++
        if (c.disposition && CONVERSION_DISPOS.has(c.disposition)) series[idx].conversions++
      }
    }

    // ── Seat spend vs output — actual charged amounts, never derived from
    // a plan tier. A Manager+ owner's own $75/wk subscription is separate
    // from what they pay per seat; every seat is billed at the same price
    // regardless of the owner's own plan, so this only means anything if
    // it reads the real amount_cents off each charge. Financial data, so
    // owner-only, same gating as the leaderboard.
    let totalSeatSpendCents = 0
    if (isOwner) {
      let spendQuery = supabaseAdmin
        .from('team_seat_charges')
        .select('agent_id, amount_cents, refunded_amount_cents, created_at')
        .eq('team_id', teamId)
        .eq('status', 'paid')
      if (since) spendQuery = spendQuery.gte('created_at', since.toISOString())
      if (until) spendQuery = spendQuery.lte('created_at', until.toISOString())
      const { data: charges } = await spendQuery

      const spendByAgent = new Map<string, number>()
      for (const ch of charges || []) {
        const net = (ch.amount_cents || 0) - (ch.refunded_amount_cents || 0)
        spendByAgent.set(ch.agent_id, (spendByAgent.get(ch.agent_id) || 0) + net)
        totalSeatSpendCents += net
      }
      for (const stat of leaderboard) {
        stat.spentCents = spendByAgent.get(stat.userId) || 0
      }
    }

    let recentCalls: any[] = []
    if (isOwner) {
      recentCalls = calls.slice(0, 50).map((c: any) => {
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
      campaignBreakdown,
      series,
      totalSeatSpendCents: isOwner ? totalSeatSpendCents : null,
      filters: {
        campaignId: filterCampaignId,
        userId: filterUserId,
      },
    })
  } catch (error: any) {
    console.error('Team analytics error:', error)
    return apiError(error, { route: 'teams/[id]/analytics' })
  }
}