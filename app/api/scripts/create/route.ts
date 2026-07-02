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

    const { name, body, team_id } = await req.json()

    if (team_id) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id, owner_id')
        .eq('id', team_id)
        .maybeSingle()
      if (!team || team.owner_id !== userId) {
        return NextResponse.json({ success: false, error: 'Not team owner' }, { status: 403 })
      }
    }

    const { data: existing } = await supabaseAdmin
      .from('scripts')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0

    const { data: created, error } = await supabaseAdmin
      .from('scripts')
      .insert({
        user_id: userId,
        team_id: team_id || null,
        name: (typeof name === 'string' && name.trim() ? name.trim() : 'Untitled Script').slice(0, 80),
        body: typeof body === 'string' ? body : '',
        sort_order: nextOrder,
      })
      .select('id, user_id, team_id, name, body, sort_order, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, script: { ...created, is_team: !!created.team_id } })
  } catch (error: any) {
    console.error('scripts/create error:', error)
    return apiError(error, { route: 'scripts/create' })
  }
}
