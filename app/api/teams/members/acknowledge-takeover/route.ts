import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// "GOT IT" ON AN AUTOMATIC SEAT PICKUP
//
// The banner exists because money started moving without the owner clicking
// anything. Once they have seen it, it has done its job — but it must not
// vanish on a timer or on a page load, because then it would be possible to
// miss entirely, which defeats the point of showing it at all. It goes away
// when they say it can.
//
// Deliberately does NOT change billing. Acknowledging is "I know I am paying
// for this", not "stop paying" — stopping is pausing or removing the member,
// which is a different button with a different consequence, and conflating the
// two would let a dismissal quietly cut somebody off mid-shift.
//
// billing_takeover_at is left intact so Teams can keep showing which seats were
// picked up automatically; only the reason is marked, and only the reason is
// what the banner filters on.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const memberId: string | undefined = body?.memberId

    const { data: myTeams } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('owner_id', userId)

    const teamIds = (myTeams || []).map((t: any) => t.id)
    if (teamIds.length === 0) {
      return NextResponse.json({ success: true, acknowledged: 0 })
    }

    // Scoped to teams this person owns either way — a memberId from the request
    // is not proof of anything on its own.
    let q = supabaseAdmin
      .from('team_members')
      .update({ billing_takeover_reason: 'acknowledged' })
      .in('team_id', teamIds)
      .not('billing_takeover_at', 'is', null)
      .neq('billing_takeover_reason', 'acknowledged')

    if (memberId) q = q.eq('id', memberId)

    const { data, error } = await q.select('id')
    if (error) throw error

    return NextResponse.json({ success: true, acknowledged: (data || []).length })
  } catch (error: any) {
    console.error('acknowledge-takeover error:', error)
    return apiError(error, { route: 'teams/members/acknowledge-takeover' })
  }
}
