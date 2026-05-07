import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelSeatSubscription } from '@/lib/teamBilling'

/**
 * Owner revokes a specific agent's access to a specific campaign.
 * Soft-delete: sets is_active=false, revoked_at timestamp.
 *
 * Now Stripe-wired:
 *   - If revoked access was 'owner' payer AND this was the LAST owner-paid
 *     access for this member on this team → cancel the seat sub.
 *   - If member still has other owner-paid access on the team → leave sub alone
 *     (one sub covers all the member's owner-paid access on a team).
 *   - If revoked access was 'agent' payer → no Stripe action; agent's own sub
 *     is independent.
 *
 * Body:
 *   accessId: uuid (required)
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

    // Revoke the access row
    const { error: revErr } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .eq('id', accessId)

    if (revErr) throw revErr

    // Stripe handling: only act if this was an owner-paid access
    let stripeCanceled = false
    let stripeReason: string | undefined

    if (access.payer === 'owner') {
      // Check if member has any other ACTIVE owner-paid access on this team
      const { data: remainingOwnerPaid } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id')
        .eq('team_member_id', access.team_member_id)
        .eq('team_id', access.team_id)
        .eq('payer', 'owner')
        .eq('is_active', true)
        .limit(1)

      if (!remainingOwnerPaid || remainingOwnerPaid.length === 0) {
        // Last owner-paid access — cancel the seat sub
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}