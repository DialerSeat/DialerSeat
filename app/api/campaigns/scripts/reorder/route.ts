import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// POST /api/campaigns/scripts/reorder
// Body: { campaign_id: string, ordered_ids: string[] }
//
// Updates the sort_order column on each script based on its position in
// ordered_ids. First id gets sort_order=0, second gets 1, etc.
// Verifies campaign ownership before writing.
//
// Used by the campaigns settings modal when the user drags script tabs
// left or right to reorder them.
// =============================================================================

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaign_id, ordered_ids } = body

    if (!campaign_id || typeof campaign_id !== 'string') {
      return NextResponse.json({ success: false, error: 'campaign_id required' }, { status: 400 })
    }
    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ordered_ids array required' }, { status: 400 })
    }
    if (!ordered_ids.every(id => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json({ success: false, error: 'ordered_ids must contain valid script ids' }, { status: 400 })
    }

    // Verify the user owns the campaign these scripts belong to.
    const { data: campaign, error: fetchErr } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaign_id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    // Verify all the script ids belong to this campaign — prevents writing
    // sort_order on someone else's scripts via a forged ordered_ids array.
    const { data: existingScripts, error: scriptsErr } = await supabaseAdmin
      .from('campaign_scripts')
      .select('id, campaign_id')
      .in('id', ordered_ids)

    if (scriptsErr) throw scriptsErr
    if (!existingScripts || existingScripts.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching scripts found' }, { status: 404 })
    }
    if (existingScripts.some(s => s.campaign_id !== campaign_id)) {
      return NextResponse.json(
        { success: false, error: 'All scripts must belong to the same campaign' },
        { status: 400 }
      )
    }
    if (existingScripts.length !== ordered_ids.length) {
      return NextResponse.json(
        { success: false, error: 'Some script ids were not found' },
        { status: 404 }
      )
    }

    // Run all updates in parallel. Last-write-wins on collision but in practice
    // there's no collision because each id gets a distinct sort_order.
    const results = await Promise.all(
      ordered_ids.map((id, idx) =>
        supabaseAdmin
          .from('campaign_scripts')
          .update({ sort_order: idx })
          .eq('id', id)
      )
    )

    const failed = results.find(r => r.error)
    if (failed?.error) throw failed.error

    return NextResponse.json({ success: true, reordered: ordered_ids.length })
  } catch (error: any) {
    console.error('Scripts reorder error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}