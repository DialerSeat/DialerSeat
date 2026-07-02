import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

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

    const { data: access } = await supabaseAdmin
      .from('team_campaign_access')
      .select('id, team_id, team_member_id, is_active, payer, teams!inner(owner_id)')
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

    const now = new Date().toISOString()

    const { error: revErr } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .eq('id', accessId)

    if (revErr) throw revErr

    let stripeCanceled = false
    let stripeReason: string | undefined

    if (access.payer === 'owner') {

      const { data: remainingOwnerPaid } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id')
        .eq('team_member_id', access.team_member_id)
        .eq('team_id', access.team_id)
        .eq('payer', 'owner')
        .eq('is_active', true)
        .limit(1)

      if (!remainingOwnerPaid || remainingOwnerPaid.length === 0) {

        const { data: charge } = await supabaseAdmin
          .from('team_seat_charges')
          .select('id, stripe_subscription_id')
          .eq('team_member_id', access.team_member_id)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (charge) {
          try {
            const result = await cancelSeatSubscription(charge.stripe_subscription_id)
            stripeCanceled = result.canceled
            stripeReason = result.reason

            await supabaseAdmin
              .from('team_seat_charges')
              .update({ status: 'voided' })
              .eq('id', charge.id)
          } catch (err: any) {
            console.error('Stripe cancel failed:', err)
            stripeReason = err.message
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stripeCanceled,
      stripeReason,
    })
  } catch (error: any) {
    console.error('Revoke access error:', error)
    return apiError(error, { route: 'teams/access/revoke' })
  }
}