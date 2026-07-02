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

    const { data: memberships } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    const teamIds = (memberships || []).map(m => m.team_id).filter(Boolean)

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
