import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { computeAbandonRate30d } from '@/lib/dialerPacing'
import { apiError } from '@/lib/apiError'

/**
 * Returns compliance stats for a campaign — current abandon rate, totals,
 * and the relevant safe-harbor thresholds. Used by the campaign owner's
 * dashboard to monitor predictive-mode compliance.
 *
 * Restricted to campaign owner.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, name, dialer_mode')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const stats = await computeAbandonRate30d(campaignId)

    // Pull AMD breakdown over the same 30-day window for visibility
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: amdRows } = await supabaseAdmin
      .from('calls')
      .select('amd_result')
      .eq('campaign_id', campaignId)
      .gte('created_at', thirtyDaysAgo)
      .not('amd_result', 'is', null)

    const amdBreakdown: Record<string, number> = {}
    for (const row of amdRows || []) {
      const key = row.amd_result || 'unknown'
      amdBreakdown[key] = (amdBreakdown[key] || 0) + 1
    }

    // Status assessment
    let status: 'safe' | 'caution' | 'degraded'
    let statusMessage: string
    if (stats.rate >= 0.025) {
      status = 'degraded'
      statusMessage = 'Pacing auto-throttled. Multi-line dialing disabled until rate drops below 2.0%.'
    } else if (stats.rate >= 0.020) {
      status = 'caution'
      statusMessage = 'Approaching auto-throttle threshold. Pacing remains at configured rate but is one tick away from degrading.'
    } else {
      status = 'safe'
      statusMessage = 'Well under the 3% legal cap. Pacing is operating at configured multiplier.'
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        dialerMode: campaign.dialer_mode,
      },
      compliance: {
        abandonRate30d: stats.rate,
        abandonedCalls: stats.abandoned,
        answeredCalls: stats.answered,
        legalCap: 0.03,
        autoThrottleAt: 0.025,
        autoRecoverAt: 0.020,
        status,
        statusMessage,
      },
      amdBreakdown,
      windowDays: 30,
    })
  } catch (error: any) {
    console.error('[compliance-stats] error:', error)
    return apiError(error, { route: 'campaigns/compliance-stats' })
  }
}