import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// "HAS ANYTHING CHANGED?" — THE CHEAP HALF OF THE POLL
//
// The Teams page syncs every five seconds so requests and decisions appear
// without a refresh. Pointing that at /api/teams/list meant re-fetching every
// member of every team, every access row and every code, twelve times a minute,
// per open tab. Fine at four people; at a floor of ten thousand it is megabytes
// of JSON and six database queries every five seconds for an owner who is
// staring at an unchanged screen.
//
// So the tick asks this instead. Counts only — no rows, no names, no joins —
// and the page pulls the full tree only when one of these numbers moves. The
// same trick lead drip uses with last_lead_added_at, for the same reason:
// noticing a change is enormously cheaper than re-reading everything in case
// one happened.
// ─────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: ownedTeams } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('owner_id', userId)

    const teamIds = (ownedTeams || []).map((t: any) => t.id)

    // head:true means the rows never leave the database — only the count does.
    const [pendingRes, decisionRes, memberRes] = await Promise.all([
      teamIds.length > 0
        ? supabaseAdmin
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .in('team_id', teamIds)
            .eq('status', 'pending')
        : Promise.resolve({ count: 0 } as any),
      supabaseAdmin
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['active', 'removed'])
        .is('decision_seen_at', null),
      teamIds.length > 0
        ? supabaseAdmin
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .in('team_id', teamIds)
            .eq('status', 'active')
        : Promise.resolve({ count: 0 } as any),
    ])

    const pendingRequests = pendingRes.count ?? 0
    const unseenDecisions = decisionRes.count ?? 0
    const activeMembers = memberRes.count ?? 0

    return NextResponse.json({
      success: true,
      pendingRequests,
      unseenDecisions,
      activeMembers,
      teamCount: teamIds.length,
      // One value the client can compare. Any change to any of these is a
      // reason to re-read the tree; nothing else is.
      stamp: `${teamIds.length}:${activeMembers}:${pendingRequests}:${unseenDecisions}`,
    })
  } catch (error: any) {
    console.error('Teams pulse error:', error)
    return apiError(error, { route: 'teams/pulse' })
  }
}
