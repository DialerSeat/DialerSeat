import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CONVERSION_DISPS = ['CLOSED', 'APPOINTMENT']
const CONTACT_DISPS = ['CLOSED', 'APPOINTMENT', 'NOT INTERESTED', 'DO NOT CALL']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!userId) {
    return NextResponse.json({ success: false, error: 'user_id required' }, { status: 400 })
  }

  let query = supabase.from('calls').select('*').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const calls = data || []
  const totalCalls = calls.length
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)
  const conversions = calls.filter(c => CONVERSION_DISPS.includes(c.disposition)).length
  const contactsReached = calls.filter(c => CONTACT_DISPS.includes(c.disposition)).length
  const closed = calls.filter(c => c.disposition === 'CLOSED').length
  const appointments = calls.filter(c => c.disposition === 'APPOINTMENT').length
  const dnc = calls.filter(c => c.disposition === 'DO NOT CALL').length
  const notInterested = calls.filter(c => c.disposition === 'NOT INTERESTED').length

  // Best campaign by conversion rate
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
  if (bestCampaignId) {
    const { data: cdata } = await supabase
      .from('campaigns').select('name').eq('id', bestCampaignId).single()
    bestCampaignName = cdata?.name || null
  }

  const conversionRate = totalCalls > 0 ? (conversions / totalCalls) * 100 : 0
  const contactRate = totalCalls > 0 ? (contactsReached / totalCalls) * 100 : 0
  const avgCallLength = contactsReached > 0
    ? Math.round(calls.filter(c => CONTACT_DISPS.includes(c.disposition))
        .reduce((s, c) => s + (c.duration || 0), 0) / contactsReached)
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