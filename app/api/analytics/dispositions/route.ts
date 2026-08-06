import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'

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

  let query = supabaseAdmin.from('calls').select('disposition').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  if (error) {
    return apiError(error, { route: 'analytics/dispositions' })
  }

  const ALLOWED = new Set([
    'CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL', 'SKIPPED', 'NO ANSWER',
  ])

  const counts: Record<string, number> = {}
  for (const c of data || []) {
    let d = c.disposition || 'NO ANSWER'

    if (d === 'NO_ANSWER' || d === 'NO_ANSWER_AMD') d = 'NO ANSWER'
    if (!ALLOWED.has(d)) continue
    counts[d] = (counts[d] || 0) + 1
  }

  const breakdown = Object.entries(counts)
    .map(([disposition, count]) => ({ disposition, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ success: true, breakdown })
}