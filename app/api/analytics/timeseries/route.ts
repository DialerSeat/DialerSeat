import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'
import { fetchAllRows } from '@/lib/fetchAllRows'

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Own data by default; an admin may request another user's by id.
  const scoped = await resolveAnalyticsScope(searchParams.get('user_id'))
  if (!scoped.ok) {
    return NextResponse.json({ success: false, error: scoped.error }, { status: scoped.status })
  }
  const userId = scoped.scope.userId
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  const bucket = searchParams.get('bucket') || 'day'

  // Paged. A bare select is capped at 1000 rows by Supabase and returns 200 OK
  // with no indication, which on a time series is especially misleading: the
  // rows come back ordered by created_at, so the cap silently lopped off the
  // most recent end of every chart once a user passed 1000 calls in range. The
  // graph did not look broken — it looked like the user stopped dialing.
  const { rows: calls, error, truncated } = await fetchAllRows<{
    created_at: string
    disposition: string
    duration: number
  }>((from, to) => {
    let q = supabaseAdmin
      .from('calls')
      .select('created_at, disposition, duration')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, to)
    if (start) q = q.gte('created_at', start)
    if (end) q = q.lte('created_at', end)
    return q
  })
  if (error) {
    return apiError(error, { route: 'analytics/timeseries' })
  }
  const buckets: Record<string, { total: number; converted: number; talkTime: number }> = {}

  for (const c of calls) {
    const d = new Date(c.created_at)
    let key: string
    if (bucket === 'hour') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    if (!buckets[key]) buckets[key] = { total: 0, converted: 0, talkTime: 0 }
    buckets[key].total++
    if (CONVERSION_DISPS.includes(c.disposition)) buckets[key].converted++
    buckets[key].talkTime += (c.duration || 0)
  }

  const series = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, t]) => ({
      label,
      calls: t.total,
      conversions: t.converted,
      conversionRate: t.total > 0 ? Number(((t.converted / t.total) * 100).toFixed(1)) : 0,
      talkTime: t.talkTime,
    }))

  return NextResponse.json({ success: true, series, partial: truncated })
}