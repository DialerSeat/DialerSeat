import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { computeAbandonRate30d } from '@/lib/dialerPacing'
import { PREDICTIVE_DEGRADE_PCT, PREDICTIVE_TARGET_ABANDON_PCT } from '@/lib/predictive/pacing'
import { apiError } from '@/lib/apiError'

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

    // ── THE TWO NUMBERS, AS THE ENGINE ACTUALLY USES THEM ────────────────
    // This screen described a recovery band that does not exist. It said
    // multi-line stayed off "until rate drops below 2.0%", and reported
    // autoRecoverAt as 2.0%, while the predictive engine has only ever had one
    // threshold: at or above PREDICTIVE_DEGRADE_PCT (2.5%) it forces one line,
    // and below it the line count is free again. There is no hysteresis, so a
    // campaign sitting at 2.2% was being told it was still throttled when it
    // was not.
    //
    // 2.0% is real, but it is a different number: PREDICTIVE_TARGET_ABANDON_PCT,
    // the level the PROJECTION is held under when choosing lines. That is why a
    // campaign between 2.0% and 2.5% is worth flagging — it is over the level
    // the dialer aims to keep the projection beneath — but it is not throttled
    // and it is not what recovery waits for. See lib/predictive/pacing.ts.
    const DEGRADE_AT = PREDICTIVE_DEGRADE_PCT / 100   // 2.5%, forces one line
    const TARGET_AT = PREDICTIVE_TARGET_ABANDON_PCT / 100 // 2.0%, the projection target

    let status: 'safe' | 'caution' | 'degraded'
    let statusMessage: string
    if (stats.rate >= DEGRADE_AT) {
      status = 'degraded'
      statusMessage =
        'Pacing auto-throttled to one line. Multi-line dialing resumes once the 30-day rate is back under 2.5%.'
    } else if (stats.rate >= TARGET_AT) {
      status = 'caution'
      statusMessage =
        'Above the 2% the dialer aims to keep its projection under, and below the 2.5% that forces one line. Still multi-line, with less room than usual.'
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
        autoThrottleAt: DEGRADE_AT,
        // The same threshold, not a lower one: there is no recovery band.
        autoRecoverAt: DEGRADE_AT,
        projectionTarget: TARGET_AT,
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