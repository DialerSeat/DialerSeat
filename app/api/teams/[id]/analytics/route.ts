import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { computeDialingTime } from '@/lib/dialingTime'
import { neverRang } from '@/lib/dialOutcome'

/** See the note where this is used: the horizon of everything on this page. */
const CALLS_CAP = 20000

// How many recorded calls the feed carries.
//
// Bounded because every row can open an <audio> element, and with recording now
// on for every campaign a busy team produces these by the thousand. Three
// hundred is several days of a floor's recorded calls, which is the range over
// which "scroll the feed" is still how anybody would look for one. Past that
// the filters above it are the tool, and the page says when it is truncated
// rather than quietly ending.
const RECORDINGS_CAP = 300

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
        .select('id, user_id, campaign_id, lead_id, disposition, duration, talk_seconds, answered_at, recording_id, recording_url, recording_status, recording_duration, created_at, leads(first_name, last_name, phone)')
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

      // Raised from 2,000 with the default range now being all time. Stats and
      // the recordings feed are both built from this one array, so the cap is
      // the real horizon of this page: past it, an owner's oldest calls simply
      // stop existing here. 9,004 calls exist platform-wide today, so no team
      // is close, and the page says so when a team does reach it.
      callsQuery = callsQuery.order('created_at', { ascending: false }).limit(CALLS_CAP)

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
      /** Dials that actually rang. The denominator for a connect rate. */
      reachedCalls: number
      talkSeconds: number
      /** How long the dial sequence ran. Always >= talkSeconds. */
      dialedSeconds: number
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
        reachedCalls: 0,
        talkSeconds: 0,
        dialedSeconds: 0,
      }
    }

    const seedSet = filterUserId ? [filterUserId] : memberClerkIds
    for (const uid of seedSet) statsByUser[uid] = seedFor(uid)

    const teamTotals = {
      calls: 0, connected: 0, conversions: 0, reachedCalls: 0, talkSeconds: 0, dialedSeconds: 0,
    }

    for (const c of calls) {
      const uid = c.user_id
      if (!statsByUser[uid]) statsByUser[uid] = seedFor(uid)
      const s = statsByUser[uid]
      s.calls++; teamTotals.calls++
      // ── THE DENOMINATOR OF A CONNECT RATE ────────────────────────────
      // Dials that never rang are counted above, because they were really
      // attempted and really billed, and excluded here, because nobody
      // declined to answer them. Platform-wide they are 79% of the table and
      // they drag answer rate from a real 41.7% down to a reported 8.8%.
      // See lib/dialOutcome.ts.
      if (!neverRang(c)) { s.reachedCalls++; teamTotals.reachedCalls++ }
      // ── CONNECTED MEANS SOMEBODY ANSWERED ────────────────────────────
      // This counted any call with a duration above zero, which is every call
      // that reached the carrier at all — a phone ringing out for 25 seconds
      // has a duration. answered_at is the only field that means answered.
      if (c.answered_at) {
        s.connected++
        teamTotals.connected++
      }
      // ── TALK TIME IS NOT WALL CLOCK ──────────────────────────────────
      // And this added `duration`, which runs from the dial and includes all
      // of the ringing. Same bug as the one fixed in unit economics, where it
      // overstated the figure by 93%. talk_seconds is the answered span.
      const talk = typeof c.talk_seconds === 'number' ? Math.max(0, c.talk_seconds) : 0
      s.talkSeconds += talk
      teamTotals.talkSeconds += talk
      if (c.disposition && CONVERSION_DISPOS.has(c.disposition)) {
        s.conversions++
        teamTotals.conversions++
      }
    }

    // ── HOURS DIALED, WHICH IS NOT TALK TIME ──────────────────────────────
    // An owner asking "how hard is this agent working" is not asking for talk
    // time. On a 20% connect rate a full day of dialing is about an hour of
    // talking, and an agent who dialed all day reads as barely present. Hours
    // dialed is how long the dial sequence was actually running: the calls
    // themselves plus the bounded wrap-up between them.
    //
    // Reconstructed from call timestamps rather than read from a session
    // table, because agent_sessions is upserted per user and keeps no history.
    // See lib/dialingTime.ts for why the gaps are measured end to start.
    const callsForTime: Record<string, Array<{ created_at: string; duration: number | null; talk_seconds: number | null }>> = {}
    for (const c of calls) {
      if (!c.user_id) continue
      ;(callsForTime[c.user_id] ||= []).push({
        created_at: c.created_at, duration: c.duration, talk_seconds: c.talk_seconds,
      })
    }
    for (const uid of Object.keys(statsByUser)) {
      statsByUser[uid].dialedSeconds = computeDialingTime(callsForTime[uid] || []).dialedSeconds
    }
    // The team's own figure is the SUM of each agent's, not the merge of all
    // their calls. Two agents dialing at once are two people working, and a
    // merged interval would count that hour once.
    const teamDialedSeconds = Object.values(statsByUser)
      .reduce((sum, m) => sum + (m.dialedSeconds || 0), 0)

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
    // ── THE RECORDINGS FEED ───────────────────────────────────────────────
    // Every recorded call in scope, newest first, as they came in. Built from
    // the same `calls` array as the stats above, so what the feed shows and
    // what the numbers say can never disagree, and the campaign, agent and
    // timeframe filters apply to both without being implemented twice.
    //
    // A row appears when the call HAS audio (recording_id or recording_url),
    // not when recording was merely requested. A call still being recorded, or
    // one where AMD decided against it, has nothing to play.
    //
    // No URL is sent. calls.recording_url is a presigned S3 link that Telnyx
    // expires ten minutes after the call, so shipping it would give a feed of
    // links that are dead by the time anyone clicks them. Playback goes
    // through /api/recordings/play, which resolves a fresh one per request.
    // No extra gating here: the query above already restricted `calls` to the
    // caller's own rows when they are not the owner, so the feed inherits it.
    const recordedCalls = calls.filter(c => c.recording_id || c.recording_url)
    const recordings = recordedCalls
      .slice(0, RECORDINGS_CAP)
      // c is implicitly any because `calls` is; annotating it explicitly is
      // what the lint rule objects to, and inference gives the same thing.
      .map(c => {
        const lead = c.leads || {}
        const u = userById[c.user_id]
        const agentName = u
          ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || c.user_id.slice(0, 12)
          : c.user_id.slice(0, 12)
        const tc = teamCampaigns.find(t => t.campaignId === c.campaign_id)
        return {
          id: c.id,
          at: c.created_at,
          agentId: c.user_id,
          agentName,
          leadName: [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || null,
          phone: lead.phone || null,
          campaignId: c.campaign_id,
          campaignName: tc?.name || null,
          disposition: c.disposition || null,
          // Both, because they answer different questions: how long the line
          // was open, and how long anybody was actually talking.
          durationSeconds: typeof c.duration === 'number' ? c.duration : 0,
          talkSeconds: typeof c.talk_seconds === 'number' ? c.talk_seconds : 0,
          recordingSeconds: typeof c.recording_duration === 'number' ? c.recording_duration : null,
          answered: !!c.answered_at,
        }
      })

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
        const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || lead.phone || '-'
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
      totals: { ...teamTotals, dialedSeconds: teamDialedSeconds },
      /** True when the window hit CALLS_CAP, so the page can say it is partial. */
      truncated: calls.length >= CALLS_CAP,
      leaderboard: isOwner ? leaderboard : [],
      viewerStats,
      recentCalls,
      recordings,
      /** How many recorded calls matched, before RECORDINGS_CAP trimmed them. */
      recordingsTotal: recordedCalls.length,
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