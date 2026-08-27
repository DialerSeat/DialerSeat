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
//
// NO ROW CAP. This used to pull up to 100,000 raw rows and reduce them here,
// which is a promise to be wrong later: the cap holds until the site succeeds,
// and then reports a busy month as a quiet one behind a note nobody reads.
// Every figure below is grouped in Postgres, so the answer is the same shape
// whether the site did a thousand views or ten million — and the response size
// stops moving with traffic.
// ─────────────────────────────────────────────────────────────────────────

const TOP_N = 25

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const range = req.nextUrl.searchParams.get('range') || '30d'

    // ── WHICH AUDIENCE ────────────────────────────────────────────────────
    // Mixed together the two hide each other. Signed-in traffic is dominated by
    // the dialer — one agent reloading a queue all day buries every marketing
    // page under thousands of views — so "which pages do visitors read" was
    // unanswerable from the combined number, which is the question the site
    // actually needs answered.
    const audienceParam = req.nextUrl.searchParams.get('audience') || 'all'
    const audience: boolean | null =
      audienceParam === 'anon' ? false : audienceParam === 'authed' ? true : null
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const sinceIso = since.toISOString()

    // Hourly across a single day, daily beyond it. A 24-hour view bucketed by
    // day is one bar, and a 90-day view bucketed by hour is 2,160 points of
    // noise — neither answers the question the range was chosen to ask.
    const byHour = days <= 1

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    // Previous period, for the comparison. A count rather than a second pull.
    const prevStart = new Date(since.getTime() - days * 24 * 60 * 60 * 1000)

    const [
      totalsRes, seriesRes, pathsRes, entryRes, breakdownRes, histRes, todayRes, prevRes,
    ] = await Promise.all([
      supabase.rpc('pv_totals', { p_since: sinceIso, p_until: null, p_authed: audience }),
      supabase.rpc('pv_series', { p_since: sinceIso, p_until: null, p_by_hour: byHour, p_authed: audience }),
      supabase.rpc('pv_paths', { p_since: sinceIso, p_until: null, p_limit: TOP_N, p_authed: audience }),
      supabase.rpc('pv_entry_pages', { p_since: sinceIso, p_until: null, p_limit: 15, p_authed: audience }),
      supabase.rpc('pv_breakdowns', { p_since: sinceIso, p_until: null, p_limit: 15, p_authed: audience }),
      supabase.rpc('pv_histograms', { p_since: sinceIso, p_until: null, p_authed: audience }),
      supabase.rpc('pv_totals', { p_since: todayStart.toISOString(), p_until: null, p_authed: audience }),
      // Same audience as everything else — comparing anonymous traffic against
      // everybody's would be a percentage between two different populations.
      // is_admin false on both branches: the owner is on this site constantly
      // and those visits are not traffic. The RPCs above filter it too — see
      // the visibility_excludes_admin_views migration.
      (audience === null
        ? supabase
            .from('page_views')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', prevStart.toISOString())
            .lt('created_at', sinceIso)
            .eq('is_admin', false)
        : supabase
            .from('page_views')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', prevStart.toISOString())
            .lt('created_at', sinceIso)
            .eq('is_authed', audience)
            .eq('is_admin', false)),
    ])

    if (totalsRes.error) throw totalsRes.error

    const t = (totalsRes.data || [])[0] || {}
    const today = (todayRes.data || [])[0] || {}

    const views = Number(t.views) || 0
    const visitorDays = Number(t.visitor_days) || 0
    const singlePageDays = Number(t.single_page_days) || 0
    const dwellTotal = Number(t.dwell_total) || 0
    const dwellCount = Number(t.dwell_count) || 0
    const authedViews = Number(t.authed_views) || 0
    const prevViews = prevRes.count ?? 0

    // Fill empty buckets so a quiet day reads as a quiet day rather than
    // vanishing from the line and making the graph look busier than it was.
    const seriesMap = new Map<string, { views: number; visitors: number }>()
    for (const r of seriesRes.data || []) {
      seriesMap.set(r.bucket, { views: Number(r.views) || 0, visitors: Number(r.visitors) || 0 })
    }

    const series: Array<{ label: string; views: number; visitors: number }> = []
    if (byHour) {
      for (let h = 0; h < 24; h++) {
        const k = `${String(h).padStart(2, '0')}:00`
        const v = seriesMap.get(k)
        series.push({ label: k, views: v?.views ?? 0, visitors: v?.visitors ?? 0 })
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const k = d.toISOString().slice(0, 10)
        const v = seriesMap.get(k)
        series.push({ label: k, views: v?.views ?? 0, visitors: v?.visitors ?? 0 })
      }
    }

    const pick = (kind: string) =>
      (breakdownRes.data || [])
        .filter((r: any) => r.kind === kind)
        .map((r: any) => ({ label: r.label, views: Number(r.views) || 0 }))

    const hist = (kind: string, size: number) => {
      const arr = new Array(size).fill(0)
      for (const r of histRes.data || []) {
        if (r.kind === kind) arr[r.idx] = Number(r.views) || 0
      }
      return arr
    }

    const dwellPages = (pathsRes.data || [])
      // A dwell average over one view is an anecdote. Three is still thin but
      // it is where a number stops being a single person's afternoon.
      .filter((r: any) => Number(r.dwell_samples) >= 3)
      .map((r: any) => ({
        path: r.path,
        avgMs: Number(r.dwell_avg_ms) || 0,
        samples: Number(r.dwell_samples) || 0,
      }))
      .sort((a: any, b: any) => b.avgMs - a.avgMs)
      .slice(0, 15)

    return NextResponse.json({
      success: true,
      range,
      days,
      audience: audienceParam,
      // Kept so the page keeps its shape, and permanently false: there is no
      // cap left to hit.
      truncated: false,
      totals: {
        views,
        visitors: Number(t.visitors) || 0,
        authedViews,
        anonViews: views - authedViews,
        viewsToday: Number(today.views) || 0,
        visitorsToday: Number(today.visitors) || 0,
        pagesPerVisit: visitorDays > 0
          ? Math.round((views / visitorDays) * 10) / 10
          : null,
        singlePageRate: visitorDays > 0
          ? Math.round((singlePageDays / visitorDays) * 1000) / 10
          : null,
        avgDwellMs: dwellCount > 0 ? Math.round(dwellTotal / dwellCount) : null,
        // How much of the dwell picture we actually have. An average built on
        // 8% of views is a different claim from one built on 90%.
        dwellCoverage: views > 0 ? Math.round((dwellCount / views) * 1000) / 10 : null,
        previousViews: prevViews,
        changePct: prevViews > 0
          ? Math.round(((views - prevViews) / prevViews) * 1000) / 10
          : null,
      },
      series,
      topPages: (pathsRes.data || []).map((r: any) => ({
        path: r.path,
        views: Number(r.views) || 0,
        visitors: Number(r.visitors) || 0,
      })),
      entryPages: (entryRes.data || []).map((r: any) => ({
        path: r.path,
        visits: Number(r.visits) || 0,
      })),
      dwellPages,
      referrers: pick('referrer').map((r: any) => ({ host: r.label, views: r.views })),
      devices: pick('device').map((r: any) => ({ device: r.label, views: r.views })),
      countries: pick('country').map((r: any) => ({ country: r.label, views: r.views })),
      utmSources: pick('utm_source'),
      utmCampaigns: pick('utm_campaign'),
      byHour: hist('hour', 24).map((views, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`, views,
      })),
      byWeekday: hist('weekday', 7).map((views, i) => ({
        label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i], views,
      })),
    })
  } catch (error: any) {
    console.error('Visibility error:', error)
    return apiError(error, { route: 'admin/visibility' })
  }
}
