import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'
import { locate, US_STATES, COUNTRIES } from '@/lib/worldMap'
import { stateForNumber, AREA_CODE_STATE } from '@/lib/areaCodes'

export const dynamic = 'force-dynamic'

const supabase = getServiceClient('admin/ops-map')

// ─────────────────────────────────────────────────────────────────────────
// WHERE EVERYBODY IS, AND WHERE THE CALLS WENT
//
// Aggregation happens in Postgres; this route turns country/region pairs and
// area codes into points, which is geography rather than data and belongs
// beside the coastlines it has to agree with.
//
// FOUR THINGS, ONE ROUND TRIP. The map needs origins, destinations, a feed and
// the ranked breakdowns, and fetching them separately would let the panels
// disagree with each other — a feed row describing a call that the counts
// beside it have not caught up to yet. One request, one instant.
//
// UNPLACED IS REPORTED, NOT DROPPED. Location comes from a heartbeat or an
// attributed page view, so anyone who has done neither since those columns
// existed has none — and most existing accounts are in exactly that position.
// A map that showed three pings and said nothing about the twenty people it
// could not place would look complete, which is worse than looking empty.
// ─────────────────────────────────────────────────────────────────────────

// 'trialing' is deliberately NOT a mode of its own. A trial IS an active
// subscription — it is the same person paying attention, and splitting them
// made two thin lists where one useful one belongs. ops_map's 'subscribed'
// already covers active and trialing together.
// ── WHAT THE RPCs ACTUALLY RETURN ────────────────────────────────────────
// Supabase types rpc() as `any`, so without these every field below is
// unchecked — a renamed column in a migration would compile perfectly and fail
// silently at runtime as a column of undefined. Written out once here so the
// mapping code beneath is type-checked against the shape it expects.
type OriginRow = {
  country: string | null; region: string | null
  user_count?: number | string; online_count?: number | string
  trial_count?: number | string
  visitors?: number | string; views?: number | string
  names?: string[] | null
}
type TargetRow = { npa: string | null; calls: number | string; answered: number | string; connected: number | string }
type FeedRowRaw = {
  call_id: string; at: string; agent: string | null
  agent_country: string | null; agent_region: string | null
  phone: string | null; duration: number | null; talk_seconds: number | null
  answered: boolean; disposition: string | null
  amd_result: string | null; amd_requested: boolean
  dial_source: string | null; campaign: string | null; recording_status: string | null
}
type BreakdownRow = { kind: string; label: string; n: number | string; detail: string | null }
type PulseRow = { bucket: string; calls: number | string; answered: number | string; connected: number | string }
type PersonRow = {
  clerk_id: string; label: string; username: string | null; email: string | null
  joined: string; country: string | null; region: string | null
  device: string | null; dialer_state: string | null; dialer_mode: string | null
  online: boolean; last_heartbeat: string | null
  status: string | null; plan: string | null; trial_end: string | null
  seat_payer: string | null; seat_team: string | null
  calls: number | string; answered: number | string; last_call: string | null
  campaigns: number | string; leads: number | string
}

/**
 * A human name for a country/region pair.
 *
 * Region codes are only US state letters in one country. Jamaica numbers its
 * parishes, so a real trialing user was displayed as being "in 12" — the
 * label fell through to the raw code because the lookup only knew US states.
 * Outside the US the country is the honest answer: the region code is a
 * subdivision this product has no table for and no use for.
 */
function placeLabel(country: string | null, region: string | null): string | null {
  if (country === 'US' && region && US_STATES[region]) return US_STATES[region].name
  if (country && COUNTRIES[country]) return COUNTRIES[country].name
  return country || null
}

const MODES = ['visitors', 'online', 'subscribed', 'all', 'everything'] as const
type Mode = (typeof MODES)[number]

/** Matches the dialer's own staleness idea: a beat is ~5s, so 90s is gone. */
const ONLINE_SECONDS = 90
const FEED_LIMIT = 80

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    // ── ONE PLACE, IN DEPTH ──────────────────────────────────────────────
    // Answered by its own query rather than folded into the payload below:
    // the detail is per-person and per-page, so shipping it for every point
    // would send the whole database to draw twelve dots. Asked for only when
    // somebody actually clicks one.
    const place = req.nextUrl.searchParams.get('place')
    if (place) {
      const rangeQ = req.nextUrl.searchParams.get('range') || '24h'
      const d = rangeQ === 'all' ? 3650
        : rangeQ === '12h' ? 0.5 : rangeQ === '24h' ? 1
        : rangeQ === '7d' ? 7 : rangeQ === '90d' ? 90 : 30
      const sinceQ = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString()
      // "US-NC" -> country US, region NC. "PH" -> country PH, region null.
      const [country, region] = place.includes('-')
        ? [place.slice(0, place.indexOf('-')), place.slice(place.indexOf('-') + 1)]
        : [place, null]
      const { data, error } = await supabase.rpc('ops_map_place', {
        p_country: country || null,
        p_region: region,
        p_since: sinceQ,
        p_online_seconds: ONLINE_SECONDS,
      })
      if (error) throw error
      return NextResponse.json({ success: true, place, detail: data })
    }

    const rawMode = req.nextUrl.searchParams.get('mode') || 'visitors'
    const mode: Mode = (MODES as readonly string[]).includes(rawMode) ? (rawMode as Mode) : 'visitors'

    const rangeParam = req.nextUrl.searchParams.get('range') || '24h'
    // 12h is half a day rather than a special case — the arithmetic below is
    // all in days, so a fraction costs nothing and keeps one code path.
    // 'all' reaches back past anything in the table. Not Infinity — that
    // stringifies to null in JSON and lands in Postgres as a null bound.
    const days = rangeParam === 'all' ? 3650
      : rangeParam === '12h' ? 0.5
      : rangeParam === '24h' ? 1
      : rangeParam === '7d' ? 7
      : rangeParam === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Bucket count follows the range: a day reads well in hours, ninety days
    // does not. Decided here so both the query and the axis label agree.
    const buckets = rangeParam === 'all' ? 40
      : rangeParam === '12h' ? 24
      : rangeParam === '24h' ? 24
      : rangeParam === '7d' ? 28
      : rangeParam === '90d' ? 45 : 30

    const [originsRes, extraVisitorsRes, targetsRes, feedRes, breakdownRes, pulseRes, peopleRes, notisRes, compRes, logsRes, visitorsRes, vPulseRes, incomeRes] = await Promise.all([
      mode === 'visitors'
        ? supabase.rpc('ops_map_visitors', { p_since: since })
        : supabase.rpc('ops_map', {
            // EVERYTHING draws accounts and strangers on one map, so the
            // account half is the widest one there is.
            p_mode: mode === 'everything' ? 'all' : mode,
            p_online_seconds: ONLINE_SECONDS,
          }),
      // Only fetched for EVERYTHING; every other mode already has its answer.
      mode === 'everything'
        ? supabase.rpc('ops_map_visitors', { p_since: since })
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('ops_map_targets', { p_since: since }),
      supabase.rpc('ops_map_feed', { p_limit: FEED_LIMIT }),
      supabase.rpc('ops_map_breakdown', { p_since: since }),
      supabase.rpc('ops_map_pulse', { p_since: since, p_buckets: buckets }),
      // Not filtered by mode or range: this is the dock's PEOPLE view, and its
      // whole point is showing accounts the map cannot place. Narrowing it to
      // the current mode would hide exactly the ones worth looking at.
      supabase.rpc('ops_map_people', { p_online_seconds: ONLINE_SECONDS }),
      // ── THE SAME NOTIFICATIONS THE BELL SHOWS ──────────────────────────
      // Read straight from admin_notifications rather than proxied through
      // /api/admin/notifications, so the map's copy cannot drift from the
      // one the notification centre shows — same table, same instant, and
      // it arrives on the map's own sync rather than a second timer.
      supabase
        .from('admin_notifications')
        .select('id, event_type, title, body, url, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      // Same numbers the Compliance app shows, aggregated in Postgres so a
      // corner box does not have to read a month of calls to draw four values.
      supabase.rpc('ops_map_compliance'),
      // Billing events — the LOGS half of the mini panel. Notifications are
      // what got pushed; logs are what happened. They overlap but are not the
      // same set, which is why the panel offers both and a merged view rather
      // than pretending one is the other.
      supabase
        .from('billing_events')
        .select('id, event_type, user_name, user_email, plan, amount_cents, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      // Individual visitors — the same stitched view Visibility shows, where a
      // browser's anonymous reading and the account it later became are one
      // person. Reused rather than re-derived so the two screens cannot
      // disagree about who visited.
      supabase.rpc('pv_individuals', { p_since: since, p_until: null, p_limit: 60 }),
      // New arrivals over time, bucketed to line up with the call pulse.
      supabase.rpc('ops_map_visitor_pulse', { p_since: since, p_buckets: buckets }),
      supabase.rpc('ops_map_income_pulse', { p_since: since, p_buckets: buckets }),
    ])
    if (originsRes.error) throw originsRes.error

    // ── ORIGINS ──────────────────────────────────────────────────────────
    type Pt = {
      key: string; label: string; scope: 'state' | 'country'
      lat: number; lon: number; users: number; online: number; views: number
      trialing: number; names: string[]
    }
    const points: Pt[] = []
    let unplaced = 0
    const unplacedNames: string[] = []
    let total = 0
    let onlineTotal = 0

    for (const row of (originsRes.data || []) as OriginRow[]) {
      const users = mode === 'visitors' ? Number(row.visitors) || 0 : Number(row.user_count) || 0
      const online = mode === 'visitors' ? 0 : Number(row.online_count) || 0
      const views = mode === 'visitors' ? Number(row.views) || 0 : 0
      // Surfaced rather than folded in: ACTIVE SUB counts trials as
      // subscribers, and it should still be possible to see how many of them
      // have not paid yet.
      const trialing = mode === 'visitors' ? 0 : Number(row.trial_count) || 0
      total += users
      onlineTotal += online

      const where = locate(row.country ?? null, row.region ?? null)
      if (!where) {
        unplaced += users
        unplacedNames.push(...((row.names as string[]) || []))
        continue
      }
      // "US / null" and "US / NC" arrive as different rows; merge on the
      // resolved key so one place never draws two pings.
      const hit = points.find(p => p.key === where.key)
      if (hit) {
        hit.users += users; hit.online += online; hit.views += views
        hit.trialing += trialing
        hit.names.push(...((row.names as string[]) || []))
      } else {
        points.push({
          key: where.key, label: where.label, scope: where.scope,
          lat: where.at[0], lon: where.at[1],
          users, online, views, trialing,
          names: ((row.names as string[]) || []).slice(),
        })
      }
    }
    // EVERYTHING folds the visitor counts into the same points, so a place
    // with two accounts and eleven strangers reads as one ping of thirteen
    // rather than two pings fighting for the same pixel.
    if (mode === 'everything') {
      for (const row of (extraVisitorsRes.data || []) as OriginRow[]) {
        const where = locate(row.country ?? null, row.region ?? null)
        const v = Number(row.visitors) || 0
        if (!where) { unplaced += v; total += v; continue }
        total += v
        const hit = points.find(p => p.key === where.key)
        if (hit) { hit.users += v; hit.views += Number(row.views) || 0 }
        else {
          points.push({
            key: where.key, label: where.label, scope: where.scope,
            lat: where.at[0], lon: where.at[1],
            users: v, online: 0, views: Number(row.views) || 0,
            trialing: 0, names: [],
          })
        }
      }
    }

    points.sort((a, b) => b.users - a.users || a.label.localeCompare(b.label))
    for (const p of points) p.names.sort((a, b) => a.localeCompare(b))

    // ── TARGETS ──────────────────────────────────────────────────────────
    // Area codes collapse to states here: several NPAs share one state and
    // must become one ping, not five stacked on the same centroid.
    const targetMap = new Map<string, {
      key: string; label: string; lat: number; lon: number
      calls: number; answered: number; connected: number; codes: string[]
    }>()
    let targetsUnmapped = 0

    for (const row of (targetsRes.data || []) as TargetRow[]) {
      const npa = String(row.npa || '')
      const st = AREA_CODE_STATE[npa]
      const calls = Number(row.calls) || 0
      if (!st || !US_STATES[st]) { targetsUnmapped += calls; continue }
      const meta = US_STATES[st]
      const hit = targetMap.get(st)
      if (hit) {
        hit.calls += calls
        hit.answered += Number(row.answered) || 0
        hit.connected += Number(row.connected) || 0
        hit.codes.push(npa)
      } else {
        targetMap.set(st, {
          key: `T-${st}`, label: meta.name, lat: meta.at[0], lon: meta.at[1],
          calls,
          answered: Number(row.answered) || 0,
          connected: Number(row.connected) || 0,
          codes: [npa],
        })
      }
    }
    const targets = [...targetMap.values()].sort((a, b) => b.calls - a.calls)
    for (const t of targets) t.codes.sort()

    // ── FEED ─────────────────────────────────────────────────────────────
    const feed = ((feedRes.data || []) as FeedRowRaw[]).map(r => {
      const targetState = stateForNumber(r.phone)
      return {
        id: r.call_id,
        at: r.at,
        agent: r.agent || 'unknown',
        agentPlace: placeLabel(r.agent_country, r.agent_region),
        agentRegion: r.agent_region || null,
        phone: r.phone || null,
        targetState,
        targetPlace: targetState ? US_STATES[targetState]?.name || targetState : null,
        duration: Number(r.duration) || 0,
        talkSeconds: r.talk_seconds == null ? null : Number(r.talk_seconds),
        answered: !!r.answered,
        disposition: r.disposition || null,
        amdResult: r.amd_result || null,
        amdRequested: !!r.amd_requested,
        source: r.dial_source || null,
        campaign: r.campaign || null,
        recording: r.recording_status || null,
      }
    })

    // ── BREAKDOWN ────────────────────────────────────────────────────────
    const breakdown: Record<string, { label: string; n: number; detail: string }[]> = {
      disposition: [], amd: [], source: [], agent: [],
    }
    for (const row of (breakdownRes.data || []) as BreakdownRow[]) {
      const kind = String(row.kind)
      if (!breakdown[kind]) breakdown[kind] = []
      breakdown[kind].push({
        label: String(row.label),
        n: Number(row.n) || 0,
        detail: String(row.detail ?? ''),
      })
    }
    for (const k of Object.keys(breakdown)) breakdown[k].sort((a, b) => b.n - a.n)

    // ── ARCS ─────────────────────────────────────────────────────────────
    // Origin -> destination for the most recent calls that have both ends.
    // Deduplicated, because a hundred dials down one list would otherwise draw
    // the same line a hundred times and read as one thick meaningless stroke.
    const arcSeen = new Set<string>()
    const arcs: { from: [number, number]; to: [number, number]; n: number; key: string }[] = []
    for (const f of feed) {
      if (!f.agentRegion || !f.targetState) continue
      if (f.agentRegion === f.targetState) continue // a line to itself is a dot
      const key = `${f.agentRegion}>${f.targetState}`
      const a = US_STATES[f.agentRegion], b = US_STATES[f.targetState]
      if (!a || !b) continue
      if (arcSeen.has(key)) {
        const found = arcs.find(x => x.key === key)
        if (found) found.n += 1
        continue
      }
      arcSeen.add(key)
      arcs.push({ key, from: [a.at[0], a.at[1]], to: [b.at[0], b.at[1]], n: 1 })
    }

    const pulse = ((pulseRes.data || []) as PulseRow[]).map(r => ({
      at: r.bucket,
      calls: Number(r.calls) || 0,
      answered: Number(r.answered) || 0,
      connected: Number(r.connected) || 0,
    }))

    const people = ((peopleRes.data || []) as PersonRow[]).map(r => ({
      id: r.clerk_id,
      label: r.label,
      // Kept separate from `label`, which falls back through name -> username
      // -> email and therefore hides the username whenever a real name exists.
      username: r.username || null,
      email: r.email,
      joined: r.joined,
      place: placeLabel(r.country, r.region),
      // Coordinates, not just a label. SHOW ON MAP used to hunt for a point
      // whose label matched this string, which fails whenever the current mode
      // has no ping there — a JM account is invisible in ONLINE, so the button
      // found nothing and silently did nothing. Carrying the position means it
      // can always fly somewhere, and select the ping only if one exists.
      ...(() => {
        const where = locate(r.country, r.region)
        return where
          ? { placeKey: where.key, lat: where.at[0], lon: where.at[1] }
          : { placeKey: null, lat: null, lon: null }
      })(),
      device: r.device || null,
      dialerState: r.dialer_state || null,
      dialerMode: r.dialer_mode || null,
      online: !!r.online,
      lastHeartbeat: r.last_heartbeat,
      status: r.status || null,
      plan: r.plan || null,
      trialEnd: r.trial_end,
      // Who is paying for this seat, when it is not them. An owner-funded
      // agent holds no subscription of their own, so `status` alone reports
      // them as having nothing — which reads as a freeloader rather than as a
      // paid seat somebody else is covering.
      seatPayer: r.seat_payer || null,
      seatTeam: r.seat_team || null,
      calls: Number(r.calls) || 0,
      answered: Number(r.answered) || 0,
      lastCall: r.last_call,
      campaigns: Number(r.campaigns) || 0,
      leads: Number(r.leads) || 0,
    }))

    const notis = ((notisRes.data || []) as Array<{
      id: string; event_type: string | null; title: string | null
      body: string | null; url: string | null
      read_at: string | null; created_at: string
    }>).map(n => ({
      id: n.id,
      kind: n.event_type || 'event',
      title: n.title || n.event_type || 'Notification',
      body: n.body || null,
      url: n.url || null,
      unread: !n.read_at,
      at: n.created_at,
    }))

    // Four windows, keyed so the box can switch between them without a
    // refetch — and so "today vs this month", the comparison the filter is
    // for, is one instant rather than two round trips apart.
    const compliance: Record<string, {
      placed: number; connected: number; measured: number; short: number
      shortPct: number | null; answerPct: number | null; avgBilled: number | null
    }> = {}
    for (const row of (compRes.data || []) as Array<Record<string, string | number | null>>) {
      compliance[String(row.period)] = {
        placed: Number(row.placed) || 0,
        connected: Number(row.connected) || 0,
        measured: Number(row.measured) || 0,
        short: Number(row.short) || 0,
        shortPct: row.short_pct == null ? null : Number(row.short_pct),
        answerPct: row.answer_pct == null ? null : Number(row.answer_pct),
        avgBilled: row.avg_billed == null ? null : Number(row.avg_billed),
      }
    }

    const visitorPulse = ((vPulseRes.data || []) as Array<Record<string, string | number>>).map(r => ({
      at: String(r.bucket),
      newVisitors: Number(r.new_visitors) || 0,
      returning: Number(r.returning_visitors) || 0,
      views: Number(r.views) || 0,
    }))

    const complianceMeta = {
      // The line Telnyx draw. Kept here so the box does not have to know it.
      threshold: 15,
      // Computed server-side, alongside the query that used
      // date_trunc('month', now()) to pick the window. Working it out in the
      // browser instead would use the viewer's clock and its timezone, and on
      // the last day of a month those disagree about which month it is.
      resetsInDays: (() => {
        const now = new Date()
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000))
      })(),
    }

    const logs = ((logsRes.data || []) as Array<{
      id: string; event_type: string | null
      user_name: string | null; user_email: string | null
      plan: string | null; amount_cents: number | null; created_at: string
    }>).map(l => ({
      id: `log-${l.id}`,
      kind: l.event_type || 'event',
      title: (l.event_type || 'event').replace(/_/g, ' '),
      body: [l.user_name || l.user_email, l.plan?.toUpperCase(),
             l.amount_cents ? `$${(l.amount_cents / 100).toFixed(2)}` : null]
        .filter(Boolean).join(' · ') || null,
      url: null as string | null,
      unread: false,
      at: l.created_at,
    }))

    const visitors = ((visitorsRes.data || []) as Array<{
      visitor_id: string; email: string | null; views: number | string
      active_days: number | string; first_seen: string; last_seen: string
      first_source: string | null; first_path: string | null; signed_up: boolean
    }>).map(v => ({
      id: v.visitor_id,
      // An account when we can name one, otherwise the browser's own id. Never
      // invented: an anonymous reader has no name and saying otherwise would
      // be the one dishonest thing this panel could do.
      label: v.email || `anon · ${String(v.visitor_id).slice(0, 8)}`,
      signedUp: !!v.signed_up,
      views: Number(v.views) || 0,
      days: Number(v.active_days) || 0,
      source: v.first_source || 'direct',
      landedOn: v.first_path || null,
      firstSeen: v.first_seen,
      lastSeen: v.last_seen,
    }))

    const incomePulse = ((incomeRes.data || []) as Array<Record<string, string | number>>).map(r => ({
      at: String(r.bucket),
      seatUsd: (Number(r.seat_cents) || 0) / 100,
      // List price, not invoiced — billing_events writes a flat 3500 on every
      // subscription event. Named separately so the panel can say so.
      subUsd: (Number(r.sub_cents) || 0) / 100,
      events: Number(r.events) || 0,
    }))

    return NextResponse.json({
      success: true,
      notis,
      incomePulse,
      logs,
      visitors,
      visitorPulse,
      complianceMeta,
      compliance,
      mode,
      range: rangeParam,
      pulse,
      people,
      onlineSeconds: ONLINE_SECONDS,
      points,
      targets,
      arcs,
      feed,
      breakdown,
      totals: {
        total,
        placed: total - unplaced,
        unplaced,
        online: onlineTotal,
        locations: points.length,
        trialing: points.reduce((n, p) => n + p.trialing, 0),
        targetLocations: targets.length,
        targetCalls: targets.reduce((s, t) => s + t.calls, 0),
        targetsUnmapped,
      },
      unplacedNames: unplacedNames.sort((a, b) => a.localeCompare(b)),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/ops-map' })
  }
}
