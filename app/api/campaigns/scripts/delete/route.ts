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

    // ── KEEP campaigns.script IN SYNC, OR DELETED SCRIPTS COME BACK ─────────
    // campaigns.script holds a copy of the default script's body, and
    // /api/campaigns/scripts/list treats it as a seed: when a campaign has
    // ZERO script rows but a non-empty campaigns.script, it recreates a
    // "Main Script" row from it. That's a one-time migration aid for
    // campaigns predating the campaign_scripts table — but it cannot tell
    // "never migrated" apart from "the user deleted everything", so any
    // stale copy left in campaigns.script resurrects a deleted script the
    // next time the dialer loads.
    //
    // The previous version only cleared it inside `if (script.is_default)`,
    // so deleting the last remaining NON-default script (or any script on a
    // campaign whose rows had no is_default flag set) left the copy behind
    // and the script reappeared.
    //
    // Now keyed on what actually matters: are there any scripts left at all.
    const { count: remaining } = await supabaseAdmin
      .from('campaign_scripts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', script.campaign_id)

    if (!remaining || remaining === 0) {
      // Nothing left — clear the seed so list() cannot regenerate one.
      await supabaseAdmin
        .from('campaigns')
        .update({ script: null })
        .eq('id', script.campaign_id)
    } else if (script.is_default) {
      // Promote the next script and point campaigns.script at ITS body, so
      // the copy always reflects a script that genuinely still exists.
      const { data: next } = await supabaseAdmin
        .from('campaign_scripts')
        .select('id, body')
        .eq('campaign_id', script.campaign_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (next) {
        await supabaseAdmin
          .from('campaign_scripts')
          .update({ is_default: true })
          .eq('id', next.id)

        await supabaseAdmin
          .from('campaigns')
          .update({ script: next.body })
          .eq('id', script.campaign_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Script delete error:', error)
    return apiError(error, { route: 'campaigns/scripts/delete' })
  }
}