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

    const body = await req.json()
    const { id, name, body: scriptBody, is_default } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    // Lookup script + verify ownership through campaign
    const { data: script } = await supabaseAdmin
      .from('campaign_scripts')
      .select('id, campaign_id, campaigns!inner(user_id)')
      .eq('id', id)
      .maybeSingle()

    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }

    // @ts-ignore — supabase join shape
    const ownerId = script.campaigns?.user_id
    if (ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    // If promoting to default, demote others first
    if (is_default === true) {
      await supabaseAdmin
        .from('campaign_scripts')
        .update({ is_default: false })
        .eq('campaign_id', script.campaign_id)
        .neq('id', id)
    }

    const patch: any = {}
    if (typeof name === 'string') patch.name = name.slice(0, 80)
    if (typeof scriptBody === 'string') patch.body = scriptBody
    if (typeof is_default === 'boolean') patch.is_default = is_default

    const { data: updated, error } = await supabaseAdmin
      .from('campaign_scripts')
      .update(patch)
      .eq('id', id)
      .select('id, name, body, is_default, sort_order, created_at, updated_at')
      .single()

    if (error) throw error

    // Mirror the default script body back to campaigns.script for legacy callers
    if (updated.is_default) {
      await supabaseAdmin
        .from('campaigns')
        .update({ script: updated.body })
        .eq('id', script.campaign_id)
    }

    return NextResponse.json({ success: true, script: updated })
  } catch (error: any) {
    console.error('Script update error:', error)
    return apiError(error, { route: 'campaigns/scripts/update' })
  }
}