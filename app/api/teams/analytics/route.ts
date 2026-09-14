import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// TEAMS ANALYTICS — ONE ENDPOINT, THREE INDEPENDENT QUESTIONS
//
// Scope answers WHO, range answers WHEN. Both arrive as parameters rather than
// as separate endpoints, because every combination is a legitimate thing to
// ask and building a route per combination is how a dashboard ends up with six
// nearly-identical handlers that drift apart.
//
// EVERY NUMBER HERE IS COUNTED FROM REAL CALL ROWS. Nothing is estimated,
// nothing is seeded, and a metric with no data returns null so the page can
// show a dash. A plausible-looking invented number is worse than an obvious
// gap: the gap gets fixed, the invention gets trusted.
//
// WHAT COUNTS AS A CONVERSION is a per-campaign decision — a vendor selling
// final expense counts a CLOSED, an agency booking demos counts an APPOINTMENT.
// The default covers both; conversion_dispositions on the campaign overrides it.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_CONVERSION_DISPOSITIONS = ['APPOINTMENT', 'CLOSED']

// Dispositions that mean a human was actually reached. Used for contact rate:
// a dialer that connects nobody is the single most important thing to see.
//
// 'completed' was in here and is not one. It is a carrier status that leaked
// into the disposition column: 35 calls carry it, all from one account between
// May and July, and every one has answered_at null and zero talk seconds.
// Nobody was reached on any of them.
//
// It was inflating contact rate on the team side only — the personal analytics
// routes never had it — which is exactly why an owner's view of an agent
// disagreed with what the agent saw on their own page.
const CONTACT_DISPOSITIONS = new Set([
  'APPOINTMENT', 'CLOSED', 'NOT INTERESTED', 'DO NOT CALL',
])

/** Only the columns the roster filter reads. */
type MemberRow = { user_id: string | null; status: string | null; removed_at: string | null }

type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom'

function rangeStart(range: RangeKey, from: string | null): Date | null {
  if (range === 'all') return null
  if (range === 'custom' && from) return new Date(from)
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const days = range === 'week' ? 7 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const range = (sp.get('range') || 'week') as RangeKey
    const from = sp.get('from')
    const to = sp.get('to')
    const scopeKind = sp.get('scope') || 'all'
    const scopeId = sp.get('scopeId')

    // ── WHOSE CALLS MAY THIS PERSON SEE ──────────────────────────────────
    // Their own, plus every team they own. Never a team they merely belong to:
    // an agent has no business reading the floor's numbers, and letting the
    // scope parameter decide that would make it an access-control hole rather
    // than a filter.
    const { data: ownedTeams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('owner_id', userId)

    const ownedTeamIds = (ownedTeams || []).map((t: any) => t.id)
    const teamNameById = new Map((ownedTeams || []).map((t: any) => [t.id, t.name]))

    // ── THE ROSTER, NOT THE CAMPAIGN LIST ────────────────────────────────
    // This scoped to campaigns attached to a team, and returned empty when
    // there were none. Members do not dial team campaigns — not one member
    // call on the platform is on one — so the page rendered a dash in every
    // tile and "No calls in this range" under every chart.
    //
    // It is the roster now, matching the per-team page. An agent on a seat
    // their owner pays for is that owner's agent on whatever list they are
    // working.
    //
    // THIS REVERSES A DELIBERATE EARLIER CHOICE and says so out loud. The old
    // note here explained that merging in the owner's personal campaigns let a
    // vendor's own book inflate their floor's figures. That reasoning still
    // holds, and the owner is on this roster, so their own dialing is counted
    // again. The alternative was a page that reports nothing at all, which is
    // what it did. Worth revisiting once real agents are dialing and the
    // owner's share stops being the whole number.
    let attachedCampaignIds: string[] = []
    let rosterIds: string[] = []
    if (ownedTeamIds.length > 0) {
      const [{ data: tc }, { data: tm }] = await Promise.all([
        supabaseAdmin
          .from('team_campaigns')
          .select('campaign_id')
          .in('team_id', ownedTeamIds)
          .limit(2000),
        supabaseAdmin
          .from('team_members')
          .select('user_id, status, removed_at')
          .in('team_id', ownedTeamIds)
          .limit(2000),
      ])
      attachedCampaignIds = (tc || []).map((r: any) => r.campaign_id).filter(Boolean)
      rosterIds = ((tm || []) as MemberRow[])
        // Removed on either column, for the same reason as everywhere else:
        // where the two disagree, fall to the side that grants less.
        .filter(m => !!m.user_id && !m.removed_at && m.status !== 'removed')
        .map(m => m.user_id as string)
    }

    const campaignIds = Array.from(new Set(attachedCampaignIds))
    // The owner is on their own roster. They dial too, and a floor report that
    // leaves out the person running it is describing a different floor.
    const agentIds = Array.from(new Set([userId, ...rosterIds]))

    // Names and conversion rules for every campaign we might report on.
    const { data: allCampaignRows } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, conversion_dispositions')
      .in('id', campaignIds)

    const campaignName = new Map<string, string>()
    const conversionsFor = new Map<string, Set<string>>()
    for (const c of allCampaignRows || []) {
      campaignName.set(c.id, c.name)
      const custom = Array.isArray(c.conversion_dispositions) && c.conversion_dispositions.length > 0
        ? c.conversion_dispositions
        : DEFAULT_CONVERSION_DISPOSITIONS
      conversionsFor.set(c.id, new Set(custom.map((d: string) => d.toUpperCase())))
    }

    // Narrow to the requested scope, inside what they are allowed to see.
    //
    // The campaign list is a FILTER now rather than the scope. Left null when
    // nobody asked for one, so the aggregate covers whatever the roster dialed
    // instead of only what happens to be attached to a team.
    let scopedCampaignIds: string[] | null = null
    let scopedAgents: string[] = agentIds

    if (scopeKind === 'team' && scopeId) {
      if (!ownedTeamIds.includes(scopeId)) {
        return NextResponse.json({ success: false, error: 'Not your team' }, { status: 403 })
      }
      // One team: that team's roster, not its campaigns.
      const { data: tm } = await supabaseAdmin
        .from('team_members')
        .select('user_id, status, removed_at')
        .eq('team_id', scopeId)
      scopedAgents = Array.from(new Set([
        userId,
        ...((tm || []) as MemberRow[])
          .filter(m => !!m.user_id && !m.removed_at && m.status !== 'removed')
          .map(m => m.user_id as string),
      ]))
    } else if (scopeKind === 'campaign' && scopeId) {
      if (!campaignIds.includes(scopeId)) {
        return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
      }
      scopedCampaignIds = [scopeId]
    } else if (scopeKind === 'agent' && scopeId) {
      if (!agentIds.includes(scopeId)) {
        return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 })
      }
      scopedAgents = [scopeId]
    }

    if (scopedAgents.length === 0) {
      return NextResponse.json({ success: true, empty: true, tiles: null, charts: null })
    }

    const start = rangeStart(range, from)

    // ── AGGREGATED IN POSTGRES, NOT HERE ──────────────────────────────────
    // This used to pull raw call rows and sum them in JavaScript under a 50,000
    // row cap. Fifty seats dialing a thousand leads a day is fifty thousand
    // calls in ONE day — so a week's view was reporting its first morning as
    // though it were the whole week, with nothing on screen saying so.
    //
    // Grouping in the database turns 350,000 rows into a few hundred. The
    // per-campaign conversion rule still runs here, but over the reduced set:
    // the database does the volume, the application does the part that needs to
    // know what each campaign counts as a sale.
    const { data: agg, error: callErr } = await supabaseAdmin.rpc(
      'call_agg_by_day_campaign',
      {
        p_campaign_ids: scopedCampaignIds,
        p_since: (start ?? new Date(0)).toISOString(),
        p_until: range === 'custom' && to ? new Date(to).toISOString() : null,
        p_agent: null,
        p_agents: scopedAgents,
      }
    )
    if (callErr) throw callErr

    // Shaped like the rows the code below already understood, so the counting
    // logic did not have to be rewritten alongside the query — one change at a
    // time is how this stays checkable.
    const rows: Array<{
      day: string; hour: number; campaign_id: string
      disposition: string; calls: number; talk: number
      /** Dials that actually rang. See lib/dialOutcome.ts. */
      reached: number
    }> = (agg || []).map((r: any) => ({
      day: r.day,
      hour: r.hour_of_day,
      campaign_id: r.campaign_id,
      disposition: r.disposition || '',
      calls: Number(r.calls) || 0,
      talk: Number(r.talk_seconds) || 0,
      reached: Number(r.reached) || 0,
    })).sort((a: any, b: any) => a.day.localeCompare(b.day))
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        empty: true,
        tiles: {
          totalCalls: 0,
          contactRate: null,
          conversions: 0,
          conversionRate: null,
          talkSecondsTotal: 0,
          avgTalkSeconds: null,
          bestCampaign: null,
        },
        charts: { volume: [], conversionRate: [], dispositions: [], byCampaign: [] },
      })
    }

    let totalCalls = 0
    /** Dials that actually rang. The denominator for the rates below. */
    let reachedCalls = 0
    let contacted = 0
    let conversions = 0
    let talkTotal = 0

    const dispositionCounts = new Map<string, number>()
    // `reached` on both: dials that actually rang, which is the denominator
    // every rate below uses. `calls` stays every dial. See lib/dialOutcome.ts.
    const perCampaign = new Map<string, { calls: number; conversions: number; talk: number; reached: number }>()
    const buckets = new Map<string, { calls: number; conversions: number; reached: number }>()

    for (const c of rows) {
      const disp = c.disposition.toUpperCase()
      const convSet = conversionsFor.get(c.campaign_id) ||
        new Set(DEFAULT_CONVERSION_DISPOSITIONS)

      const isConversion = !!disp && convSet.has(disp)

      totalCalls += c.calls
      // ── THE DENOMINATOR OF A RATE IS NOT THE DIAL COUNT ──────────────
      // Dials that never rang stay in totalCalls, because they were really
      // attempted and really billed, and stay out of reachedCalls, because
      // nobody declined to answer them. The rates below divide by reached.
      // They are 79% of the table platform-wide and they can never reach the
      // numerator, since their disposition is NO_ANSWER — so all they ever did
      // was make every agent look worse. See lib/dialOutcome.ts.
      reachedCalls += c.reached
      if (isConversion) conversions += c.calls
      if (c.disposition && CONTACT_DISPOSITIONS.has(c.disposition)) contacted += c.calls

      // talk_seconds is answered→hangup, which is what Telnyx bills and the
      // only honest measure of time on the phone. `duration` includes ring.
      talkTotal += c.talk

      const dKey = c.disposition || 'No disposition'
      dispositionCounts.set(dKey, (dispositionCounts.get(dKey) || 0) + c.calls)

      const pc = perCampaign.get(c.campaign_id) || { calls: 0, conversions: 0, talk: 0, reached: 0 }
      pc.calls += c.calls
      // Ranking campaigns by a rate whose denominator is dials rather than
      // dials that RANG ranks them by how much of their history predates the
      // dead-socket fix. See lib/dialOutcome.ts.
      pc.reached += c.reached
      if (isConversion) pc.conversions += c.calls
      pc.talk += c.talk
      perCampaign.set(c.campaign_id, pc)

      // Hours across one day, days beyond it — the grouping already carries
      // both, so the bucket is a choice rather than a second pass over dates.
      const bk = range === 'today'
        ? `${String(c.hour).padStart(2, '0')}:00`
        : c.day
      const b = buckets.get(bk) || { calls: 0, conversions: 0, reached: 0 }
      b.calls += c.calls
      b.reached += c.reached
      if (isConversion) b.conversions += c.calls
      buckets.set(bk, b)
    }

    // Averaged over calls that actually had talk time. Counting a no-answer as
    // zero seconds would drag the average toward nothing and make a floor that
    // holds real conversations look like it never speaks to anybody.
    const talkCalls = rows.reduce((n, r) => n + (r.talk > 0 ? r.calls : 0), 0)

    // Best campaign needs a floor. One call that happened to close is not a
    // 100% conversion rate, it is one call — ranking on it would put the
    // quietest list at the top of the board every time.
    const MIN_CALLS_TO_RANK = 5
    let bestCampaign: { id: string; name: string; rate: number; calls: number } | null = null
    for (const [cid, v] of perCampaign) {
      if (v.reached < MIN_CALLS_TO_RANK) continue
      const rate = v.conversions / v.reached
      if (!bestCampaign || rate > bestCampaign.rate) {
        bestCampaign = {
          id: cid,
          name: campaignName.get(cid) || 'Campaign',
          rate: Math.round(rate * 1000) / 10,
          calls: v.calls,
        }
      }
    }

    const orderedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    // ── EVERY RECORDING THE FLOOR HAS MADE ────────────────────────────────
    // Newest first, as they happened. Its own query rather than a by-product of
    // the aggregate above, because that groups by day and disposition and loses
    // the individual calls — and an individual call is the whole point of a
    // recording.
    //
    // Scoped to the same roster and the same window as everything else on the
    // page, so the filters at the top narrow this too.
    //
    // No URL is sent. calls.recording_url is a presigned S3 link Telnyx expires
    // ten minutes after the call, so shipping it would give a list of links
    // already dead. Playback goes through /api/recordings/play, which resolves
    // a fresh one per request and re-checks the viewer may have it.
    const RECORDINGS_CAP = 300
    let recQuery = supabaseAdmin
      .from('calls')
      .select('id, user_id, created_at, phone_number, talk_seconds, answered_at, disposition, campaign_id', { count: 'exact' })
      .in('user_id', scopedAgents)
      .or('recording_id.not.is.null,recording_url.not.is.null')
      .order('created_at', { ascending: false })
      .limit(RECORDINGS_CAP)
    // start is null for all time, which is the default. No lower bound then,
    // rather than a bound of "now".
    if (start) recQuery = recQuery.gte('created_at', start.toISOString())
    if (scopedCampaignIds && scopedCampaignIds.length > 0) {
      recQuery = recQuery.in('campaign_id', scopedCampaignIds)
    }
    const { data: recRows, count: recCount } = await recQuery

    // The whole roster, not only the agents who happen to have a recording:
    // this same map names the filter dropdown, and a filter missing the quiet
    // people is a filter that cannot answer "why has nobody heard from Dave".
    const recNameById = new Map<string, string>()
    if (agentIds.length > 0) {
      const { data: recUsers } = await supabaseAdmin
        .from('users')
        .select('clerk_id, first_name, last_name, email')
        .in('clerk_id', agentIds)
      for (const u of (recUsers || []) as Array<{
        clerk_id: string; first_name: string | null; last_name: string | null; email: string | null
      }>) {
        recNameById.set(
          u.clerk_id,
          [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
            || u.email || u.clerk_id.slice(0, 12)
        )
      }
    }

    const recordings = ((recRows || []) as Array<{
      id: string; user_id: string | null; created_at: string; phone_number: string | null
      talk_seconds: number | null; answered_at: string | null
      disposition: string | null; campaign_id: string | null
    }>).map(r => ({
      id: r.id,
      at: r.created_at,
      agentId: r.user_id,
      agentName: r.user_id ? (recNameById.get(r.user_id) ?? r.user_id.slice(0, 12)) : 'Unknown',
      phone: r.phone_number,
      talkSeconds: typeof r.talk_seconds === 'number' ? r.talk_seconds : 0,
      answered: !!r.answered_at,
      disposition: r.disposition,
      campaign: r.campaign_id ? (campaignName.get(r.campaign_id) ?? null) : null,
    }))

    return NextResponse.json({
      success: true,
      recordings,
      recordingsTotal: typeof recCount === 'number' ? recCount : recordings.length,
      // Who is on the roster, so the page can offer a filter without a second
      // request. Named from the same lookup the recordings use.
      agents: agentIds.map(id => ({ id, name: recNameById.get(id) ?? null })),
      empty: false,
      range,
      scope: { kind: scopeKind, id: scopeId },
      tiles: {
        totalCalls,
        contactRate: reachedCalls > 0 ? Math.round((contacted / reachedCalls) * 1000) / 10 : null,
        conversions,
        conversionRate: reachedCalls > 0 ? Math.round((conversions / reachedCalls) * 1000) / 10 : null,
        talkSecondsTotal: talkTotal,
        avgTalkSeconds: talkCalls > 0 ? Math.round(talkTotal / talkCalls) : null,
        bestCampaign,
        minCallsToRank: MIN_CALLS_TO_RANK,
      },
      charts: {
        volume: orderedBuckets.map(([k, v]) => ({ label: k, value: v.calls })),
        conversionRate: orderedBuckets.map(([k, v]) => ({
          label: k,
          value: v.reached > 0 ? Math.round((v.conversions / v.reached) * 1000) / 10 : 0,
        })),
        dispositions: Array.from(dispositionCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value })),
        byCampaign: Array.from(perCampaign.entries())
          .sort((a, b) => b[1].calls - a[1].calls)
          .slice(0, 8)
          .map(([cid, v]) => ({
            label: campaignName.get(cid) || 'Campaign',
            value: v.calls,
            conversions: v.conversions,
          })),
      },
    })
  } catch (error: any) {
    console.error('Teams analytics error:', error)
    return apiError(error, { route: 'teams/analytics' })
  }
}
