import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const supabase = getServiceClient('admin/visibility')

// ─────────────────────────────────────────────────────────────────────────
// SITE TRAFFIC
//
// Counted from page_views, which stores no IP, no user agent and no user id.
// Uniques come from a daily-rotating hash, so "visitors" means distinct people
// per day and cannot be stitched into a trail across days — a traffic graph
// does not need to follow anybody around to be useful.
// ─────────────────────────────────────────────────────────────────────────

const ROW_CAP = 100000

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const range = req.nextUrl.searchParams.get('range') || '30d'
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('page_views')
      .select('path, referrer_host, is_authed, visitor_hash, device, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(ROW_CAP)

    if (error) throw error
    const rows = data || []

    // Hourly across a single day, daily beyond it. A 24-hour view bucketed by
    // day is one bar, and a 90-day view bucketed by hour is 2,160 points of
    // noise — neither answers the question the range was chosen to ask.
    const byHour = days <= 1
    const bucketOf = (iso: string) => {
      const d = new Date(iso)
      return byHour
        ? `${String(d.getHours()).padStart(2, '0')}:00`
        : d.toISOString().slice(0, 10)
    }

    const buckets = new Map<string, { views: number; visitors: Set<string> }>()
    const paths = new Map<string, { views: number; visitors: Set<string> }>()
    const referrers = new Map<string, number>()
    const devices = new Map<string, number>()
    const allVisitors = new Set<string>()
    let authed = 0

    for (const r of rows) {
      const b = bucketOf(r.created_at)
      const bk = buckets.get(b) || { views: 0, visitors: new Set<string>() }
      bk.views++
      if (r.visitor_hash) bk.visitors.add(r.visitor_hash)
      buckets.set(b, bk)

      const pk = paths.get(r.path) || { views: 0, visitors: new Set<string>() }
      pk.views++
      if (r.visitor_hash) pk.visitors.add(r.visitor_hash)
      paths.set(r.path, pk)

      if (r.referrer_host) {
        referrers.set(r.referrer_host, (referrers.get(r.referrer_host) || 0) + 1)
      }
      if (r.device) devices.set(r.device, (devices.get(r.device) || 0) + 1)
      if (r.visitor_hash) allVisitors.add(r.visitor_hash)
      if (r.is_authed) authed++
    }

    // Fill empty buckets so a quiet day reads as a quiet day rather than
    // vanishing from the line and making the graph look busier than it was.
    const ordered: Array<{ label: string; views: number; visitors: number }> = []
    if (byHour) {
      for (let h = 0; h < 24; h++) {
        const k = `${String(h).padStart(2, '0')}:00`
        const v = buckets.get(k)
        ordered.push({ label: k, views: v?.views ?? 0, visitors: v?.visitors.size ?? 0 })
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const k = d.toISOString().slice(0, 10)
        const v = buckets.get(k)
        ordered.push({ label: k, views: v?.views ?? 0, visitors: v?.visitors.size ?? 0 })
      }
    }

    const todayKey = new Date().toISOString().slice(0, 10)
    const todayRows = rows.filter(r => r.created_at.slice(0, 10) === todayKey)

    return NextResponse.json({
      success: true,
      range,
      days,
      // True when the row cap was hit, so the page can say the figures are a
      // floor rather than presenting a truncated count as complete.
      truncated: rows.length >= ROW_CAP,
      totals: {
        views: rows.length,
        visitors: allVisitors.size,
        authedViews: authed,
        anonViews: rows.length - authed,
        viewsToday: todayRows.length,
        visitorsToday: new Set(todayRows.map(r => r.visitor_hash).filter(Boolean)).size,
      },
      series: ordered,
      topPages: Array.from(paths.entries())
        .map(([path, v]) => ({ path, views: v.views, visitors: v.visitors.size }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 25),
      referrers: Array.from(referrers.entries())
        .map(([host, views]) => ({ host, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 12),
      devices: Array.from(devices.entries())
        .map(([device, views]) => ({ device, views }))
        .sort((a, b) => b.views - a.views),
    })
  } catch (error: any) {
    console.error('Visibility error:', error)
    return apiError(error, { route: 'admin/visibility' })
  }
}
