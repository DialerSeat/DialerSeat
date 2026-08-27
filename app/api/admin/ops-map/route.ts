import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'
import { locate } from '@/lib/worldMap'

export const dynamic = 'force-dynamic'

const supabase = getServiceClient('admin/ops-map')

// ─────────────────────────────────────────────────────────────────────────
// WHERE EVERYBODY IS
//
// Aggregation happens in Postgres (ops_map); this route's only real job is
// turning a country/region pair into a point on the map, which is a question
// about geography rather than about data and belongs in lib/worldMap.ts next
// to the coastlines it has to agree with.
//
// UNPLACED IS REPORTED, NOT DROPPED. Location comes from a heartbeat or a
// page view, so a user who has done neither since those columns existed has no
// location at all — and most existing users are in exactly that position. A
// map that quietly showed three pings and said nothing about the twenty users
// it could not place would be worse than useless: it would look complete.
// ─────────────────────────────────────────────────────────────────────────

const MODES = ['all', 'subscribed', 'trialing', 'online', 'visitors'] as const
type Mode = (typeof MODES)[number]

/** Matches the dialer's own staleness idea: a beat is ~5s, so 90s is gone. */
const ONLINE_SECONDS = 90

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const raw = req.nextUrl.searchParams.get('mode') || 'all'
    const mode: Mode = (MODES as readonly string[]).includes(raw) ? (raw as Mode) : 'all'

    // ── VISITORS ARE A DIFFERENT POPULATION, NOT A DIFFERENT FILTER ──────
    // Every other mode counts USERS — people with accounts, each a row we can
    // name. This one counts strangers, where the only thing known is the
    // header on a page view. Sharing the shape below is fine; sharing the
    // query would have meant pretending an anonymous reader is a user with a
    // missing name.
    const rangeParam = req.nextUrl.searchParams.get('range') || '30d'
    const days = rangeParam === '24h' ? 1 : rangeParam === '7d' ? 7 : rangeParam === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = mode === 'visitors'
      ? await supabase.rpc('ops_map_visitors', { p_since: since })
      : await supabase.rpc('ops_map', { p_mode: mode, p_online_seconds: ONLINE_SECONDS })
    if (error) throw error

    const points: Array<{
      key: string; label: string; scope: 'state' | 'country'
      lat: number; lon: number; users: number; online: number; views: number
      names: string[]
    }> = []

    let unplaced = 0
    const unplacedNames: string[] = []
    let total = 0
    let onlineTotal = 0

    for (const row of (data || []) as any[]) {
      // In visitors mode the count IS the unique-visitor count and there is
      // nobody to name; `views` rides along so the panel can show both.
      const users = mode === 'visitors'
        ? Number(row.visitors) || 0
        : Number(row.user_count) || 0
      const online = mode === 'visitors' ? 0 : Number(row.online_count) || 0
      const views = mode === 'visitors' ? Number(row.views) || 0 : 0
      total += users
      onlineTotal += online

      const where = locate(row.country ?? null, row.region ?? null)
      if (!where) {
        unplaced += users
        unplacedNames.push(...((row.names as string[]) || []))
        continue
      }

      // A country row and a state row can both exist for the same country —
      // "US / null" and "US / NC" are different rows out of Postgres. Merge on
      // the resolved key so the map never draws two pings for one place.
      const existing = points.find(p => p.key === where.key)
      if (existing) {
        existing.users += users
        existing.online += online
        existing.views += views
        existing.names.push(...((row.names as string[]) || []))
      } else {
        points.push({
          key: where.key,
          label: where.label,
          scope: where.scope,
          lat: where.at[0],
          lon: where.at[1],
          users,
          online,
          views,
          names: ((row.names as string[]) || []).slice(),
        })
      }
    }

    points.sort((a, b) => b.users - a.users || a.label.localeCompare(b.label))
    for (const p of points) p.names.sort((a, b) => a.localeCompare(b))

    return NextResponse.json({
      success: true,
      mode,
      range: rangeParam,
      onlineSeconds: ONLINE_SECONDS,
      points,
      totals: {
        total,
        placed: total - unplaced,
        unplaced,
        online: onlineTotal,
        locations: points.length,
      },
      // Named, because "20 unplaced" invites the question and the answer is
      // cheap. These are almost always accounts that predate the columns.
      unplacedNames: unplacedNames.sort((a, b) => a.localeCompare(b)),
    })
  } catch (err: any) {
    return apiError(err, { route: 'admin/ops-map' })
  }
}
