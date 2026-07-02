import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const LOOKBACK_MINUTES = 10

async function hangupSid(sid: string): Promise<boolean> {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  if (!spaceUrl || !projectId || !apiToken || !sid) return false
  try {
    const res = await fetch(
      `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${sid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }).toString(),
      }
    )

    return res.ok || res.status === 404
  } catch (e) {
    console.error('[abort] hangup failed for sid', sid, e)
    return false
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let hungUp = 0
    let claimsReleased = 0

    const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()
    const { data: rooms, error: roomErr } = await supabase
      .from('call_rooms')
      .select('lead_call_sid, agent_call_sid')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
    if (roomErr) {
      console.error('[abort] call_rooms lookup failed:', roomErr)
    }

    const sids = new Set<string>()
    for (const r of rooms || []) {
      if (r.lead_call_sid) sids.add(r.lead_call_sid)
      if (r.agent_call_sid) sids.add(r.agent_call_sid)
    }

    const results = await Promise.all([...sids].map(hangupSid))
    hungUp = results.filter(Boolean).length

    const { data: sessions } = await supabase
      .from('agent_sessions')
      .select('id')
      .eq('user_id', userId)
    const sessionIds = (sessions || []).map(s => s.id).filter(Boolean)
    if (sessionIds.length > 0) {
      const { data: released, error: relErr } = await supabase
        .from('leads')
        .update({ claimed_at: null, claimed_by_session_id: null })
        .in('claimed_by_session_id', sessionIds)
        .select('id')
      if (relErr) {
        console.error('[abort] lead claim release failed:', relErr)
      } else {
        claimsReleased = released?.length || 0
      }
    }

    const { error: pauseErr } = await supabase
      .from('agent_sessions')
      .update({ state: 'paused', current_call_id: null })
      .eq('user_id', userId)
    if (pauseErr) {
      console.error('[abort] session pause failed:', pauseErr)
    }

    return NextResponse.json({ success: true, hungUp, claimsReleased })
  } catch (error: any) {
    return apiError(error, { route: 'dialer/abort' })
  }
}
