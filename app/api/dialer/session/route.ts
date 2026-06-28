import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

/**
 * Tracks active dialer sessions for predictive pacing math.
 *
 * POST: start or heartbeat a session
 *   body: { campaignId, teamId? }
 *   - If user has an open session for this campaign: bump last_heartbeat_at
 *   - Else: insert a new session row
 *   Returns: { sessionId }
 *
 * DELETE: end the current session
 *   body: { sessionId }
 *   - Sets ended_at = now()
 *
 * Sessions older than 60s without heartbeat are considered inactive
 * and are filtered out by the active-agents endpoint.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaignId, teamId } = body

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'campaignId required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Find an open session for this user+campaign (within last 5 min to avoid stale)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existing } = await supabaseAdmin
      .from('dialer_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .is('ended_at', null)
      .gte('last_heartbeat_at', fiveMinAgo)
      .order('last_heartbeat_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Heartbeat existing session
      await supabaseAdmin
        .from('dialer_sessions')
        .update({ last_heartbeat_at: now })
        .eq('id', existing.id)
      return NextResponse.json({ success: true, sessionId: existing.id, action: 'heartbeat' })
    }

    // Close any other stale open sessions for this user (defensive cleanup)
    await supabaseAdmin
      .from('dialer_sessions')
      .update({ ended_at: now })
      .eq('user_id', userId)
      .is('ended_at', null)
      .lt('last_heartbeat_at', fiveMinAgo)

    // Insert new session
    const { data: created, error } = await supabaseAdmin
      .from('dialer_sessions')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        team_id: teamId || null,
        started_at: now,
        last_heartbeat_at: now,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, sessionId: created.id, action: 'started' })
  } catch (error: any) {
    console.error('Dialer session POST error:', error)
    return apiError(error, { route: 'dialer/session' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 })
    }

    // Only let the owner end their own session
    await supabaseAdmin
      .from('dialer_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('ended_at', null)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Dialer session DELETE error:', error)
    return apiError(error, { route: 'dialer/session' })
  }
}