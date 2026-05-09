import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * sendBeacon-compatible (POST) endpoint for ending a dialer session
 * when the browser tab closes. Auth is best-effort — the 5-min stale
 * cleanup in the main session route is the safety net.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ ok: true })

    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) return NextResponse.json({ ok: true })

    await supabaseAdmin
      .from('dialer_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('ended_at', null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}