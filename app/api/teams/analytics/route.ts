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

/** Dispositions that mean a human was actually reached. Used for contact rate —
 *  a dialer that connects nobody is the single most important thing to see. */
const CONTACT_DISPOSITIONS = new Set([
  'APPOINTMENT', 'CLOSED', 'NOT INTERESTED', 'DO NOT CALL', 'completed',
])

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

/** Bucket size that keeps a chart readable at every range: hours across one
 *  day, days across a month. A 30-point line and a 720-point line are not the
 *  same chart. */
function bucketKey(iso: string, range: RangeKey): string {
  const d = new Date(iso)
  if (range === 'today') {
    return `${String(d.getHours()).padStart(2, '0')}:00`
  }
  return d.toISOString().slice(0, 10)
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

    // Campaigns in play: the owner's own, plus anything attached to their teams.
    const { data: ownCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, conversion_dispositions')
      .eq('user_id', userId)

    let attachedCampaignIds: string[] = []
    if (ownedTeamIds.length > 0) {
      const { data: tc } = await supabaseAdmin
        .from('team_campaigns')
        .select('campaign_id')
        .in('team_id', ownedTeamIds)
      attachedCampaignIds = (tc || []).map((r: any) => r.campaign_id)
    }

    const campaignIds = Array.from(
      new Set([...(ownCampaigns || []).map((c: any) => c.id), ...attachedCampaignIds])
    )

    if (campaignIds.length === 0) {
      return NextResponse.json({ success: true, empty: true, tiles: null, charts: null })
    }

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
    let scopedCampaignIds = campaignIds
    let scopedAgentId: string | null = null

    if (scopeKind === 'team' && scopeId) {
      if (!ownedTeamIds.includes(scopeId)) {
        return NextResponse.json({ success: false, error: 'Not your team' }, { status: 403 })
      }
      const { data: tc } = await supabaseAdmin
        .from('team_campaigns')
        .select('campaign_id')
        .eq('team_id', scopeId)
      scopedCampaignIds = (tc || []).map((r: any) => r.campaign_id)
    } else if (scopeKind === 'campaign' && scopeId) {
      if (!campaignIds.includes(scopeId)) {
        return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
      }
      scopedCampaignIds = [scopeId]
    } else if (scopeKind === 'agent' && scopeId) {
      scopedAgentId = scopeId
    }

    if (scopedCampaignIds.length === 0) {
      return NextResponse.json({ success: true, empty: true, tiles: null, charts: null })
    }

    const start = rangeStart(range, from)

    let q = supabaseAdmin
      .from('calls')
      .select('id, campaign_id, user_id, disposition, talk_seconds, duration, created_at, amd_result')
      .in('campaign_id', scopedCampaignIds)
      .order('created_at', { ascending: true })
      // PostgREST caps unbounded selects at 1000 rows, which would silently
      // report a fraction of a busy week as though it were the whole thing.
      .limit(50000)

    if (start) q = q.gte('created_at', start.toISOString())
    if (range === 'custom' && to) q = q.lte('created_at', new Date(to).toISOString())
    if (scopedAgentId) q = q.eq('user_id', scopedAgentId)

    const { data: calls, error: callErr } = await q
    if (callErr) throw callErr

    const rows = calls || []
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

    let contacted = 0
    let conversions = 0
    let talkTotal = 0
    let talkCalls = 0

    const dispositionCounts = new Map<string, number>()
    const perCampaign = new Map<string, { calls: number; conversions: number; talk: number }>()
    const buckets = new Map<string, { calls: number; conversions: number }>()

    for (const c of rows) {
      const disp = (c.disposition || '').toUpperCase()
      const convSet = conversionsFor.get(c.campaign_id) ||
        new Set(DEFAULT_CONVERSION_DISPOSITIONS)

      const isConversion = !!disp && convSet.has(disp)
      if (isConversion) conversions++
      if (disp && CONTACT_DISPOSITIONS.has(c.disposition as string)) contacted++

      // talk_seconds is answered→hangup, which is what Telnyx bills and the
      // only honest measure of time on the phone. `duration` includes ring.
      const talk = typeof c.talk_seconds === 'number' ? c.talk_seconds : 0
      if (talk > 0) {
        talkTotal += talk
        talkCalls++
      }

      const dKey = c.disposition || 'No disposition'
      dispositionCounts.set(dKey, (dispositionCounts.get(dKey) || 0) + 1)

      const pc = perCampaign.get(c.campaign_id) || { calls: 0, conversions: 0, talk: 0 }
      pc.calls++
      if (isConversion) pc.conversions++
      pc.talk += talk
      perCampaign.set(c.campaign_id, pc)

      const bk = bucketKey(c.created_at, range)
      const b = buckets.get(bk) || { calls: 0, conversions: 0 }
      b.calls++
      if (isConversion) b.conversions++
      buckets.set(bk, b)
    }

    // Best campaign needs a floor. One call that happened to close is not a
    // 100% conversion rate, it is one call — ranking on it would put the
    // quietest list at the top of the board every time.
    const MIN_CALLS_TO_RANK = 5
    let bestCampaign: { id: string; name: string; rate: number; calls: number } | null = null
    for (const [cid, v] of perCampaign) {
      if (v.calls < MIN_CALLS_TO_RANK) continue
      const rate = v.conversions / v.calls
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

    return NextResponse.json({
      success: true,
      empty: false,
      range,
      scope: { kind: scopeKind, id: scopeId },
      tiles: {
        totalCalls: rows.length,
        contactRate: rows.length > 0 ? Math.round((contacted / rows.length) * 1000) / 10 : null,
        conversions,
        conversionRate: rows.length > 0 ? Math.round((conversions / rows.length) * 1000) / 10 : null,
        talkSecondsTotal: talkTotal,
        avgTalkSeconds: talkCalls > 0 ? Math.round(talkTotal / talkCalls) : null,
        bestCampaign,
        minCallsToRank: MIN_CALLS_TO_RANK,
      },
      charts: {
        volume: orderedBuckets.map(([k, v]) => ({ label: k, value: v.calls })),
        conversionRate: orderedBuckets.map(([k, v]) => ({
          label: k,
          value: v.calls > 0 ? Math.round((v.conversions / v.calls) * 1000) / 10 : 0,
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
