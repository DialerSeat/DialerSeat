import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']
const CONTACT_DISPS = ['CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL']

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = supabaseAdmin.from('calls').select('campaign_id, disposition').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data: calls, error: callsErr } = await query
  if (callsErr) {
    return apiError(callsErr, { route: 'analytics/campaigns' })
  }

  const grouped: Record<string, { total: number; converted: number; contacted: number }> = {}
  for (const c of calls || []) {
    const cid = c.campaign_id || 'unknown'
    if (!grouped[cid]) grouped[cid] = { total: 0, converted: 0, contacted: 0 }
    grouped[cid].total++
    if (CONVERSION_DISPS.includes(c.disposition)) grouped[cid].converted++
    if (CONTACT_DISPS.includes(c.disposition)) grouped[cid].contacted++
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

  return NextResponse.json({ success: true, breakdown })
}