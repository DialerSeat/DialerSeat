import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

// SECURITY (was IDOR): scoped only by client-supplied ?user_id with no auth.
// Identity now comes from the Clerk session.

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  // bucket: 'hour' | 'day'
  const bucket = searchParams.get('bucket') || 'day'

  let query = supabaseAdmin.from('calls').select('created_at, disposition, duration').eq('user_id', userId)
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