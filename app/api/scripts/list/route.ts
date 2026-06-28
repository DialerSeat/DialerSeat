// app/api/scripts/list/route.ts
// =============================================================================
// GLOBAL SCRIPTS LIBRARY — LIST
// =============================================================================
// Returns the caller's personal script library PLUS any scripts owned by teams
// they are an active member of (team scripts have team_id set). Team scripts
// appear in the member's library and stay there unless the member deletes them
// (a member-side delete only removes the link to their own campaigns — it does
// not delete the team owner's script; see the delete route).
//
// Each script row carries `is_team` so the UI can badge team-provided scripts.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Teams the user is an active member of — used to surface team-owned scripts.
    const { data: memberships } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    const teamIds = (memberships || []).map(m => m.team_id).filter(Boolean)

    // Personal scripts.
    const { data: own, error: ownErr } = await supabaseAdmin
      .from('scripts')
      .select('id, user_id, team_id, name, body, sort_order, created_at, updated_at')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (ownErr) throw ownErr

    let teamScripts: any[] = []
    if (teamIds.length > 0) {
      const { data: ts, error: tsErr } = await supabaseAdmin
        .from('scripts')
        .select('id, user_id, team_id, name, body, sort_order, created_at, updated_at')
        .in('team_id', teamIds)
        .neq('user_id', userId) // own team scripts already covered above
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (tsErr) throw tsErr
      teamScripts = ts || []
    }

    const scripts = [
      ...(own || []).map(s => ({ ...s, is_team: !!s.team_id })),
      ...teamScripts.map(s => ({ ...s, is_team: true })),
    ]

    return NextResponse.json({ success: true, scripts })
  } catch (error: any) {
    console.error('scripts/list error:', error)
    return apiError(error, { route: 'scripts/list' })
  }
}
