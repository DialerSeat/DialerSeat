import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// Turn lead drip on or off for a campaign, and rotate its URL.
//
// The token is generated here and never chosen by the caller: a secret somebody
// picks is a secret somebody picks badly, and this one is the only thing
// standing between an open URL and somebody else's lead list.
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { campaignId, action } = body as { campaignId?: string; action?: string }

    if (!campaignId || !action) {
      return NextResponse.json(
        { success: false, error: 'campaignId and action required' },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, ingest_token')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
    }

    if (action === 'disable') {
      await supabaseAdmin
        .from('campaigns')
        .update({ ingest_enabled: false })
        .eq('id', campaignId)
      return NextResponse.json({ success: true, enabled: false })
    }

    if (action === 'enable' || action === 'rotate') {
      // Enabling a campaign that already has a token keeps it — turning drip
      // back on should not silently break every integration pointed at it.
      // Rotating is the deliberate way to invalidate one.
      const token =
        action === 'rotate' || !campaign.ingest_token
          ? randomBytes(24).toString('base64url')
          : campaign.ingest_token

      const { error } = await supabaseAdmin
        .from('campaigns')
        .update({ ingest_token: token, ingest_enabled: true })
        .eq('id', campaignId)

      if (error) throw error
      return NextResponse.json({ success: true, enabled: true, token })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Campaign ingest error:', error)
    return apiError(error, { route: 'teams/campaigns/ingest' })
  }
}
