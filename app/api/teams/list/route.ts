import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Lists teams visible to the authenticated user.
 * Returns teams where user is either:
 *   - The owner (full team object)
 *   - An active member (limited fields, omits owner-only data)
 *
 * Each team is tagged with `viewerRole: 'owner' | 'member'` so UI can branch.
 * No tier gate — lapsed users can still see their teams (read-only).
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Teams owned by this user
    const { data: ownedTeams, error: ownedErr } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (ownedErr) throw ownedErr

    // Teams where this user is an active member
    const { data: memberRows, error: memberErr } = await supabaseAdmin
      .from('team_members')
      .select('team_id, status, accepted_at, joined_via_code')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (memberErr) throw memberErr

    const memberTeamIds = (memberRows || []).map((m: any) => m.team_id)

    let memberTeams: any[] = []
    if (memberTeamIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('teams')
        .select('id, name, description, owner_id, created_at')
        .in('id', memberTeamIds)

      if (error) throw error
      memberTeams = data || []
    }

    const owned = (ownedTeams || []).map((t: any) => ({ ...t, viewerRole: 'owner' }))
    const member = memberTeams.map((t: any) => ({ ...t, viewerRole: 'member' }))

    return NextResponse.json({
      success: true,
      teams: { owned, member },
    })
  } catch (error: any) {
    console.error('Team list error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}