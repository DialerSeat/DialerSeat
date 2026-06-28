// app/api/scripts/delete/route.ts
// =============================================================================
// GLOBAL SCRIPTS LIBRARY — DELETE
// =============================================================================
// Owner deletes the script entirely (cascade removes its campaign links).
//
// A team member who sees a team-owned script in their library and wants it gone
// can "delete" it from their own view: that does NOT delete the owner's script;
// it only removes any links between that script and the member's OWN campaigns.
// (Per product decision: team scripts stay in a member's library unless they
// delete them.) We detect this case by ownership.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const { data: script } = await supabaseAdmin
      .from('scripts')
      .select('id, user_id, team_id')
      .eq('id', id)
      .maybeSingle()

    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }

    if (script.user_id === userId) {
      // Owner — hard delete (links cascade via FK).
      const { error } = await supabaseAdmin.from('scripts').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, removed: 'global' })
    }

    // Not the owner. Only allowed if it's a team script and the caller is on
    // that team. In that case, unlink it from the caller's own campaigns only.
    if (script.team_id) {
      const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', script.team_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (membership) {
        const { data: myCampaigns } = await supabaseAdmin
          .from('campaigns')
          .select('id')
          .eq('user_id', userId)
        const myIds = (myCampaigns || []).map(c => c.id)
        if (myIds.length > 0) {
          await supabaseAdmin
            .from('campaign_script_links')
            .delete()
            .eq('script_id', id)
            .in('campaign_id', myIds)
        }
        return NextResponse.json({ success: true, removed: 'from_own_campaigns' })
      }
    }

    return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
  } catch (error: any) {
    console.error('scripts/delete error:', error)
    return apiError(error, { route: 'scripts/delete' })
  }
}
