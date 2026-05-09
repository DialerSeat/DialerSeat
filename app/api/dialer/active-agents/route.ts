import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Returns count of agents actively dialing a campaign in the last 60 seconds.
 * Used by the predictive pacing algorithm to compute target lines.
 *
 * GET: ?campaignId=xxx
 * Returns: { activeAgents: number, sessionIds: string[] }
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

    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('dialer_sessions')
      .select('id, user_id')
      .eq('campaign_id', campaignId)
      .is('ended_at', null)
      .gte('last_heartbeat_at', sixtySecondsAgo)

    if (error) throw error

    // De-dupe by user_id (in case of orphan rows; one human = one agent slot)
    const uniqueUsers = new Set((data || []).map(s => s.user_id))

    return NextResponse.json({
      success: true,
      activeAgents: uniqueUsers.size,
      sessionIds: (data || []).map(s => s.id),
    })
  } catch (error: any) {
    console.error('Active agents error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}