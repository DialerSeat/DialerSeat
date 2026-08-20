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
      .select('path, referrer_host, is_authed, visitor_hash, device, country, region, utm_source, utm_medium, utm_campaign, dwell_ms, created_at')
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

    // ── PER-VISITOR SHAPE ─────────────────────────────────────────────────
    // The rows are already ordered oldest-first, so the first row a visitor
    // produced on a given day IS their entry page. That is a different and more
    // useful question than "most viewed": the busiest page is often one people
    // reach after arriving somewhere else entirely.
    //
    // Keyed by visitor AND day, because the hash rotates at midnight — treating
    // it as a stable identity would silently merge two different people who
    // happened to share a hash on different days.
    const firstOfDay = new Map<string, string>()
    const viewsPerVisitorDay = new Map<string, number>()
    for (const r of rows) {
      if (!r.visitor_hash) continue
      const key = `${r.visitor_hash}|${r.created_at.slice(0, 10)}`
      if (!firstOfDay.has(key)) firstOfDay.set(key, r.path)
      viewsPerVisitorDay.set(key, (viewsPerVisitorDay.get(key) || 0) + 1)
    }

    const entryPages = new Map<string, number>()
    for (const path of firstOfDay.values()) {
      entryPages.set(path, (entryPages.get(path) || 0) + 1)
    }

    // One page and gone. Not a bounce rate in the strict sense — we do not know
    // whether they read it and left satisfied — so it is labelled for what it
    // literally counts rather than dressed up as engagement.
    let singlePageVisits = 0
    let totalVisitorDays = 0
    let viewsSum = 0
    for (const v of viewsPerVisitorDay.values()) {
      totalVisitorDays++
      viewsSum += v
      if (v === 1) singlePageVisits++
    }

    // ── WHEN DOES TRAFFIC ARRIVE ──────────────────────────────────────────
    // Named apart from `byHour` above, which is a boolean deciding the bucket
    // size. Two very different things wanting the same obvious name.
    const hourHistogram: number[] = new Array(24).fill(0)
    const weekdayHistogram: number[] = new Array(7).fill(0)
    for (const r of rows) {
      const d = new Date(r.created_at)
      hourHistogram[d.getHours()]++
      weekdayHistogram[d.getDay()]++
    }

    // ── HOW LONG THEY STAYED ──────────────────────────────────────────────
    // Averaged only over views that reported a figure. A view whose exit beacon
    // never arrived is unknown, not zero, and folding those in as zeros would
    // drag every average toward nothing.
    const dwellByPath = new Map<string, { total: number; n: number }>()
    let dwellTotal = 0
    let dwellCount = 0
    for (const r of rows) {
      if (typeof r.dwell_ms !== 'number' || r.dwell_ms <= 0) continue
      dwellTotal += r.dwell_ms
      dwellCount++
      const cur = dwellByPath.get(r.path) || { total: 0, n: 0 }
      cur.total += r.dwell_ms
      cur.n++
      dwellByPath.set(r.path, cur)
    }

    const countries = new Map<string, number>()
    const utmSources = new Map<string, number>()
    const utmCampaigns = new Map<string, number>()
    for (const r of rows) {
      if (r.country) countries.set(r.country, (countries.get(r.country) || 0) + 1)
      if (r.utm_source) {
        const label = r.utm_medium ? `${r.utm_source} / ${r.utm_medium}` : r.utm_source
        utmSources.set(label, (utmSources.get(label) || 0) + 1)
      }
      if (r.utm_campaign) {
        utmCampaigns.set(r.utm_campaign, (utmCampaigns.get(r.utm_campaign) || 0) + 1)
      }
    }

    // ── AGAINST THE PERIOD BEFORE ─────────────────────────────────────────
    // Counted, not fetched: a second full pull just to compare would double the
    // cost of every load. head:true leaves the rows in the database.
    const prevStart = new Date(since.getTime() - days * 24 * 60 * 60 * 1000)
    const { count: prevViews } = await supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', since.toISOString())

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
        pagesPerVisit: totalVisitorDays > 0
          ? Math.round((viewsSum / totalVisitorDays) * 10) / 10
          : null,
        singlePageRate: totalVisitorDays > 0
          ? Math.round((singlePageVisits / totalVisitorDays) * 1000) / 10
          : null,
        avgDwellMs: dwellCount > 0 ? Math.round(dwellTotal / dwellCount) : null,
        // How much of the dwell picture we actually have. An average built on
        // 8% of views is a different claim from one built on 90%, and a reader
        // deciding whether to act on it needs to know which.
        dwellCoverage: rows.length > 0
          ? Math.round((dwellCount / rows.length) * 1000) / 10
          : null,
        previousViews: prevViews ?? 0,
        changePct: (prevViews ?? 0) > 0
          ? Math.round(((rows.length - (prevViews ?? 0)) / (prevViews ?? 1)) * 1000) / 10
          : null,
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
      entryPages: Array.from(entryPages.entries())
        .map(([path, visits]) => ({ path, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 15),
      dwellPages: Array.from(dwellByPath.entries())
        // A dwell average over one view is an anecdote. Three is still thin but
        // it is the point at which a number stops being a single person's
        // afternoon.
        .filter(([, v]) => v.n >= 3)
        .map(([path, v]) => ({ path, avgMs: Math.round(v.total / v.n), samples: v.n }))
        .sort((a, b) => b.avgMs - a.avgMs)
        .slice(0, 15),
      countries: Array.from(countries.entries())
        .map(([country, views]) => ({ country, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 15),
      utmSources: Array.from(utmSources.entries())
        .map(([label, views]) => ({ label, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 12),
      utmCampaigns: Array.from(utmCampaigns.entries())
        .map(([label, views]) => ({ label, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 12),
      byHour: hourHistogram.map((views, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`, views,
      })),
      byWeekday: weekdayHistogram.map((views, i) => ({
        label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i], views,
      })),
    })
  } catch (error: any) {
    console.error('Visibility error:', error)
    return apiError(error, { route: 'admin/visibility' })
  }
}
