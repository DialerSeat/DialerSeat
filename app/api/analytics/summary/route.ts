import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'
import { fetchAllRows } from '@/lib/fetchAllRows'

const supabase = getServiceClient('analytics/summary')

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']
const CONTACT_DISPS = ['CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL']

export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url)

  // Own data by default; an admin may request another user's by id. See
  // lib/analyticsScope.ts — the previous expression here always resolved back
  // to the caller, so ?user_id looked supported and silently wasn't.
  const scoped = await resolveAnalyticsScope(searchParams.get('user_id'))
  if (!scoped.ok) {
    return NextResponse.json({ success: false, error: scoped.error }, { status: scoped.status })
  }
  const userId = scoped.scope.userId

  const start = searchParams.get('start')
  const end = searchParams.get('end')

  // Paged, not a bare select. Supabase caps an unbounded select at 1000 rows
  // and returns 200 OK, so this used to compute every headline number on this
  // page — total calls, talk time, conversion rate — from an arbitrary
  // thousand-row slice of the user's history, with nothing indicating it. The
  // "all time" range was the worst case: the more history a user had, the more
  // wrong the totals became.
  const { rows: calls, error: callsErr, truncated: callsTruncated } =
    await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .range(from, to)
      if (start) q = q.gte('created_at', start)
      if (end) q = q.lte('created_at', end)
      return q
    })
  if (callsErr) {
    return apiError(callsErr, { route: 'analytics/summary' })
  }

  const totalCalls = calls.length
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)

  // Same cap, same consequence: every disposition count below (contacts,
  // conversions, closed, appointments, DNC) is derived from this set, so a
  // truncated read understates all of them at once.
  const { rows: leads, truncated: leadsTruncated } =
    await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('leads')
        .select('disposition, last_called_at')
        .eq('user_id', userId)
        .not('disposition', 'is', null)
        .order('last_called_at', { ascending: true })
        .range(from, to)
      if (start) q = q.gte('last_called_at', start)
      if (end) q = q.lte('last_called_at', end)
      return q
    })

  const contactsReached = leads.filter(l => CONTACT_DISPS.includes(l.disposition)).length
  const conversions = leads.filter(l => CONVERSION_DISPS.includes(l.disposition)).length
  const closed = leads.filter(l => l.disposition === 'CLOSED').length
  const appointments = leads.filter(l => l.disposition === 'APPOINTMENT').length
  const dnc = leads.filter(l => l.disposition === 'DO NOT CALL').length
  const notInterested = leads.filter(l => l.disposition === 'NOT INTERESTED').length

  const campaignTotals: Record<string, { total: number; converted: number }> = {}
  for (const c of calls) {
    const cid = c.campaign_id || 'unknown'
    if (!campaignTotals[cid]) campaignTotals[cid] = { total: 0, converted: 0 }
    campaignTotals[cid].total++
    if (CONVERSION_DISPS.includes(c.disposition)) campaignTotals[cid].converted++
  }
  let bestCampaignId: string | null = null
  let bestRate = 0
  for (const [cid, t] of Object.entries(campaignTotals)) {
    if (t.total >= 5) {
      const rate = t.converted / t.total
      if (rate > bestRate) {
        bestRate = rate
        bestCampaignId = cid
      }
    }
  }

  let bestCampaignName: string | null = null
  if (bestCampaignId && bestCampaignId !== 'unknown') {
    const { data: cdata } = await supabase
      .from('campaigns').select('name').eq('id', bestCampaignId).single()
    bestCampaignName = cdata?.name || null
  }

  const conversionRate = totalCalls > 0 ? (conversions / totalCalls) * 100 : 0
  const contactRate = totalCalls > 0 ? (contactsReached / totalCalls) * 100 : 0

  const connectedCalls = calls.filter(c => CONTACT_DISPS.includes(c.disposition))
  const avgCallLength = connectedCalls.length > 0
    ? Math.round(connectedCalls.reduce((s, c) => s + (c.duration || 0), 0) / connectedCalls.length)
    : 0

  return NextResponse.json({
    success: true,
    summary: {
      totalCalls,
      contactsReached,
      conversions,
      closed,
      appointments,
      dnc,
      notInterested,
      totalDuration,
      avgCallLength,
      conversionRate: Number(conversionRate.toFixed(1)),
      contactRate: Number(contactRate.toFixed(1)),
      bestCampaign: bestCampaignName,
      bestCampaignRate: Number((bestRate * 100).toFixed(1)),
    },
    // Only ever true if a user exceeds the runaway ceiling in lib/fetchAllRows.
    // Surfaced rather than swallowed: the entire point of this change is that
    // partial totals must never again be presented as complete ones.
    partial: callsTruncated || leadsTruncated,
  })
}