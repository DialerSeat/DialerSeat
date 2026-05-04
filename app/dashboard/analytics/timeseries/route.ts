import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  // bucket: 'hour' | 'day'
  const bucket = searchParams.get('bucket') || 'day'

  if (!userId) {
    return NextResponse.json({ success: false, error: 'user_id required' }, { status: 400 })
  }

  let query = supabase.from('calls').select('created_at, disposition, duration').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)
  query = query.order('created_at', { ascending: true })

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const calls = data || []
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

  return NextResponse.json({ success: true, series })
}