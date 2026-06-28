import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
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
      return NextResponse.json({ success: false, error: 'Missing campaign id' }, { status: 400 })
    }

    // Ownership check: confirm the campaign belongs to the caller before deleting.
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // The DB does the cascade work now:
    //   leads.campaign_id has ON DELETE CASCADE -> child leads vanish
    //   calls.campaign_id has ON DELETE SET NULL -> call rows survive for analytics
    //   calls.lead_id has ON DELETE SET NULL -> survives lead deletion too
    // SignalWire recording audio files stay until the 30-day cron catches them.
    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId) // belt-and-suspenders ownership check

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/delete' })
  }
}