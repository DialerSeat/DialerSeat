import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { canonical } from '@/lib/dispositions'

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']
const CONTACT_DISPS = ['CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL']

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

  // Paged: a bare select stops at 1000 rows with a 200, which cut this table
  // to an arbitrary thousand calls for anybody busier than that.
  const { rows: calls, error: callsErr, truncated } = await fetchAllRows<{
    campaign_id: string | null
    disposition: string | null
  }>((from, to) => {
    let q = supabaseAdmin
      .from('calls')
      .select('campaign_id, disposition')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
    if (start) q = q.gte('created_at', start)
    if (end) q = q.lte('created_at', end)
    return q
  })
  if (callsErr) {
    return apiError(callsErr, { route: 'analytics/campaigns' })
  }

  const grouped: Record<string, { total: number; converted: number; contacted: number }> = {}
  for (const c of calls) {
    const cid = c.campaign_id || 'unknown'
    if (!grouped[cid]) grouped[cid] = { total: 0, converted: 0, contacted: 0 }
    grouped[cid].total++
    // canonical() so an older spelling (APPOINTMENT_SET, NOT_INTERESTED)
    // counts the same as the summary beside it counts it.
    const d = canonical(c.disposition)
    if (d !== null && CONVERSION_DISPS.includes(d)) grouped[cid].converted++
    if (d !== null && CONTACT_DISPS.includes(d)) grouped[cid].contacted++
  }

  const ids = Object.keys(grouped).filter(id => id !== 'unknown')
  const { data: cdata } = await supabaseAdmin
    .from('campaigns')
    .select('id, name')
    .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
  const nameMap: Record<string, string> = {}
  for (const c of cdata || []) nameMap[c.id] = c.name

  const breakdown = Object.entries(grouped)
    .map(([id, t]) => ({
      campaign_id: id,
      name: nameMap[id] || (id === 'unknown' ? 'Unknown' : id.slice(0, 8)),
      total: t.total,
      contacted: t.contacted,
      converted: t.converted,
      conversionRate: t.total > 0 ? Number(((t.converted / t.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ success: true, breakdown, partial: truncated })
}