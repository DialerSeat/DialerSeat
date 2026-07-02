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

    const { id, name, body } = await req.json()
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const { data: script } = await supabaseAdmin
      .from('scripts')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }
    if (script.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    const patch: any = { updated_at: new Date().toISOString() }
    if (typeof name === 'string') patch.name = name.trim().slice(0, 80) || 'Untitled Script'
    if (typeof body === 'string') patch.body = body

    const { data: updated, error } = await supabaseAdmin
      .from('scripts')
      .update(patch)
      .eq('id', id)
      .select('id, user_id, team_id, name, body, sort_order, created_at, updated_at')
      .single()

    if (error) throw error

    const { data: links } = await supabaseAdmin
      .from('campaign_script_links')
      .select('campaign_id, sort_order')
      .eq('script_id', id)
    for (const link of links || []) {
      const { data: top } = await supabaseAdmin
        .from('campaign_script_links')
        .select('script_id')
        .eq('campaign_id', link.campaign_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (top?.script_id === id) {
        await supabaseAdmin.from('campaigns').update({ script: updated.body }).eq('id', link.campaign_id)
      }
    }

    return NextResponse.json({ success: true, script: { ...updated, is_team: !!updated.team_id } })
  } catch (error: any) {
    console.error('scripts/update error:', error)
    return apiError(error, { route: 'scripts/update' })
  }
}
