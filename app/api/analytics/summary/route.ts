import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('analytics/summary')

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']
const CONTACT_DISPS = ['CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL']

export async function GET(req: NextRequest) {
  // Auth — scope to authenticated user
  const { userId: authUserId } = await auth()
  if (!authUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  // We accept user_id in query for backwards compat, but always enforce auth match
  const requestedUserId = searchParams.get('user_id')
  const userId = (requestedUserId && requestedUserId === authUserId) ? authUserId : authUserId

  const start = searchParams.get('start')
  const end = searchParams.get('end')

  // -------- CALLS-BASED METRICS --------
  // Total dial activity (every call attempt, including no-answers and skips)
  let callsQuery = supabase.from('calls').select('*').eq('user_id', userId)
  if (start) callsQuery = callsQuery.gte('created_at', start)
  if (end) callsQuery = callsQuery.lte('created_at', end)
  const { data: callsData, error: callsErr } = await callsQuery
  if (callsErr) {
    return apiError(callsErr, { route: 'analytics/summary' })
  }
  const calls = callsData || []

  const totalCalls = calls.length
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)

  // -------- LEADS-BASED METRICS (the bug fix) --------
  // Contacts reached + conversions count UNIQUE LEADS dispositioned in range,
  // not call rows. This way:
  //   - Lead called 3x then CLOSED → counts as 1 contact, 1 conversion
  //   - Lead called 1x as NO_ANSWER → counts as 0 contacts
  //   - Lead dispositioned via leads-tab edit (no call row) → still counts
  //
  // We use last_called_at as the "when this disposition was set" proxy.
  let leadsQuery = supabase
    .from('leads')
    .select('disposition, last_called_at')
    .eq('user_id', userId)
    .not('disposition', 'is', null)
  if (start) leadsQuery = leadsQuery.gte('last_called_at', start)
  if (end) leadsQuery = leadsQuery.lte('last_called_at', end)
  const { data: leadsData } = await leadsQuery
  const leads = leadsData || []

  const contactsReached = leads.filter(l => CONTACT_DISPS.includes(l.disposition)).length
  const conversions = leads.filter(l => CONVERSION_DISPS.includes(l.disposition)).length
  const closed = leads.filter(l => l.disposition === 'CLOSED').length
  const appointments = leads.filter(l => l.disposition === 'APPOINTMENT').length
  const dnc = leads.filter(l => l.disposition === 'DO NOT CALL').length
  const notInterested = leads.filter(l => l.disposition === 'NOT INTERESTED').length

  // Best campaign by conversion rate (still calls-based since we want
  // to know which campaign's calls converted best)
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

  // Average call length: avg duration of CONNECTED calls (those that hit a contact disposition)
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
  })
}