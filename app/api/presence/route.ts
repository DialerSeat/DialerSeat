import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'

const supabase = getServiceClient('api/presence')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// POST /api/presence — "this person is signed in and looking at DialerSeat"
// =============================================================================
// The Map's online used to come only from the dialer heartbeat, which runs only
// for an active plan, so a person without one never showed online however long
// they were on the dashboard. Every signed-in page now pings this
// (components/PresenceBeacon), and the Map counts it as online
// (db/migrations/2026-10-11-presence-online.sql).
//
// Deliberately NOT the dialer heartbeat: that is also the predictive engine and
// the agent_sessions row the dialer's seat and watchdog logic reads. This
// touches two columns on users and nothing else.
//
// "Went online" is announced on arrival with the same rule as the heartbeat:
// never announced, or back after a 5 minute gap and not announced in the last
// 4 hours. The claim is one UPDATE, so two tabs cannot both announce.
// =============================================================================

const ONLINE_GAP_MS = 5 * 60 * 1000
const ONLINE_QUIET_MS = 4 * 60 * 60 * 1000

export async function POST() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    const now = new Date().toISOString()
    const gapCutoff = new Date(Date.now() - ONLINE_GAP_MS).toISOString()
    const quietCutoff = new Date(Date.now() - ONLINE_QUIET_MS).toISOString()

    // Before stamping last_active_at, which is what the gap is measured from.
    const { data: arrived } = await supabase
      .from('users')
      .update({ presence_notified_at: now })
      .eq('clerk_id', clerkId)
      .not('is_admin', 'is', true)
      .or(
        'presence_notified_at.is.null,' +
        `and(or(last_active_at.is.null,last_active_at.lt.${gapCutoff}),presence_notified_at.lt.${quietCutoff})`
      )
      .select('first_name, last_name, username, email')

    await supabase.from('users').update({ last_active_at: now }).eq('clerk_id', clerkId)

    const u = arrived?.[0]
    if (u) {
      const label =
        [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
        u.username || u.email || 'Someone'
      try {
        await sendAdminPush('agent_online', `${label} is online.`)
      } catch (e) {
        console.error('[presence] online notification failed', e)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[presence] failed', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
