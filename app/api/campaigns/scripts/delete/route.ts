import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id } = body
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const { data: script } = await supabaseAdmin
      .from('campaign_scripts')
      .select('id, campaign_id, is_default, campaigns!inner(user_id)')
      .eq('id', id)
      .maybeSingle()

    if (!script) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }

    // @ts-ignore
    const ownerId = script.campaigns?.user_id
    if (ownerId !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('campaign_scripts')
      .delete()
      .eq('id', id)

    if (error) throw error

    // If we deleted the default, promote the first remaining script
    if (script.is_default) {
      const { data: next } = await supabaseAdmin
        .from('campaign_scripts')
        .select('id, body')
        .eq('campaign_id', script.campaign_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (next) {
        await supabaseAdmin
          .from('campaign_scripts')
          .update({ is_default: true })
          .eq('id', next.id)
        // Mirror to campaigns.script
        await supabaseAdmin
          .from('campaigns')
          .update({ script: next.body })
          .eq('id', script.campaign_id)
      } else {
        // No scripts left — clear campaigns.script
        await supabaseAdmin
          .from('campaigns')
          .update({ script: null })
          .eq('id', script.campaign_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Script delete error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}