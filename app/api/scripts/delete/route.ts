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

      const { error } = await supabaseAdmin.from('scripts').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, removed: 'global' })
    }

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
