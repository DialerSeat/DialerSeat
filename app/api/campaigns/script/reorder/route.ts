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
    const { campaign_id, order } = body  // order: string[] of script IDs in new order

    if (!campaign_id || !Array.isArray(order)) {
      return NextResponse.json({ success: false, error: 'campaign_id and order array required' }, { status: 400 })
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .eq('id', campaign_id)
      .maybeSingle()

    if (!campaign || campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 })
    }

    await Promise.all(
      order.map((scriptId: string, idx: number) =>
        supabaseAdmin
          .from('campaign_scripts')
          .update({ sort_order: idx })
          .eq('id', scriptId)
          .eq('campaign_id', campaign_id)
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Script reorder error:', error)
    return apiError(error, { route: 'campaigns/script/reorder' })
  }
}