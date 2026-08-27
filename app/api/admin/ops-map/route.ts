import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'
import { locate, US_STATES } from '@/lib/worldMap'
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

const MODES = ['visitors', 'online', 'subscribed', 'all'] as const
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
      const d = rangeQ === '24h' ? 1 : rangeQ === '7d' ? 7 : rangeQ === '90d' ? 90 : 30
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
    const days = rangeParam === '24h' ? 1 : rangeParam === '7d' ? 7 : rangeParam === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Bucket count follows the range: a day reads well in hours, ninety days
    // does not. Decided here so both the query and the axis label agree.
    const buckets = rangeParam === '24h' ? 24 : rangeParam === '7d' ? 28 : rangeParam === '90d' ? 45 : 30

    const [originsRes, targetsRes, feedRes, breakdownRes, pulseRes, peopleRes] = await Promise.all([
      mode === 'visitors'
        ? supabase.rpc('ops_map_visitors', { p_since: since })
        : supabase.rpc('ops_map', { p_mode: mode, p_online_seconds: ONLINE_SECONDS }),
      supabase.rpc('ops_map_targets', { p_since: since }),
      supabase.rpc('ops_map_feed', { p_limit: FEED_LIMIT }),
      supabase.rpc('ops_map_breakdown', { p_since: since }),
      supabase.rpc('ops_map_pulse', { p_since: since, p_buckets: buckets }),
      // Not filtered by mode or range: this is the dock's PEOPLE view, and its
      // whole point is showing accounts the map cannot place. Narrowing it to
      // the current mode would hide exactly the ones worth looking at.
      supabase.rpc('ops_map_people', { p_online_seconds: ONLINE_SECONDS }),
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
        agentPlace: r.agent_region
          ? (US_STATES[r.agent_region]?.name || r.agent_region)
          : (r.agent_country || null),
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
      place: r.region ? (US_STATES[r.region]?.name || r.region) : (r.country || null),
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

    return NextResponse.json({
      success: true,
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
