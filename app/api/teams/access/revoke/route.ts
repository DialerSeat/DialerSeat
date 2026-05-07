import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner revokes a specific agent's access to a specific campaign.
 * Soft-delete: sets is_active=false, sets revoked_at timestamp.
 *
 * Stripe seat-sub cancellation (if payer was 'owner') happens in Batch 4.
 * Per Q2=B: owner pays for the rest of the current period, no refund.
 *
 * Body:
 *   accessId: uuid (required) — the team_campaign_access row id
 *   confirm:  'remove' (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { accessId, confirm } = body

    if (!accessId) {
      return NextResponse.json({ success: false, error: 'accessId required' }, { status: 400 })
    }

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm revocation' },
        { status: 400 }
      )
    }

    // Verify ownership through the team
    const { data: access } = await supabaseAdmin
      .from('team_campaign_access')
      .select('id, team_id, is_active, payer, teams!inner(owner_id)')
      .eq('id', accessId)
      .maybeSingle()

    if (!access) {
      return NextResponse.json({ success: false, error: 'Access row not found' }, { status: 404 })
    }

    if ((access as any).teams.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can revoke access' },
        { status: 403 }
      )
    }

    if (!access.is_active) {
      return NextResponse.json(
        { success: false, error: 'Access is already revoked' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', accessId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Revoke access error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}