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
    const { accessId, memberId, campaignId, teamId, confirm } = body

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm revocation' },
        { status: 400 }
      )
    }

    // ── NAME THE ROW, OR DESCRIBE IT ──────────────────────────────────────
    // This took an accessId and nothing else. All three callers sent
    // something else — the campaign roster sent { memberId, campaignId }, the
    // team manager sent { teamId, memberId, campaignId }, and Settings sent
    // { teamId, campaignId } — so every Remove button in the product returned
    // 400 "accessId required" and appeared to do nothing.
    //
    // Fixing the three call sites would leave the same trap set for the
    // fourth. The row is identifiable from what those callers already know:
    // a person and a campaign is exactly one access row. So the endpoint
    // accepts either, and nobody has to know its primary key to use it.
    let query = supabaseAdmin
      .from('team_campaign_access')
      .select('id, team_id, campaign_id, team_member_id, is_active, payer, teams!inner(owner_id)')

    if (accessId) {
      query = query.eq('id', accessId)
    } else if (campaignId && (memberId || teamId)) {
      query = query.eq('campaign_id', campaignId).eq('is_active', true)
      if (memberId) query = query.eq('team_member_id', memberId)
      if (teamId) query = query.eq('team_id', teamId)
    } else {
      return NextResponse.json(
        { success: false, error: 'Pass accessId, or campaignId with memberId or teamId' },
        { status: 400 }
      )
    }

    const { data: matches } = await query.limit(2)
    let access: any = (matches || [])[0] || null

    // Settings sends a campaign and a team but no member, because the person
    // cancelling is themselves. Narrow it to their own membership rather than
    // revoking whichever row came back first.
    if (!memberId && !accessId && (matches || []).length > 1) {
      const { data: mine } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .maybeSingle()
      access = (matches || []).find((m: any) => m.team_member_id === mine?.id) || null
    }

    if (!access) {
      return NextResponse.json({ success: false, error: 'Access row not found' }, { status: 404 })
    }

    // ── THE OWNER, OR THE PERSON GIVING UP THEIR OWN SEAT ─────────────────
    // Owner-only refused the one caller that is not an owner: Settings, where
    // an agent cancels their own campaign seat. That screen exists, has a
    // typed confirmation, and could never have worked.
    //
    // Somebody dropping their own access is not a permission to guard — it
    // costs the owner nothing and takes nothing from anybody else.
    const isOwner = (access as any).teams.owner_id === userId
    let isSelf = false
    if (!isOwner) {
      const { data: theirMembership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('id', access.team_member_id)
        .eq('user_id', userId)
        .maybeSingle()
      isSelf = !!theirMembership
    }

    if (!isOwner && !isSelf) {
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
      .eq('id', access.id)

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
          .select('id, stripe_subscription_item_id')
          .eq('team_member_id', access.team_member_id)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (charge) {
          try {
            const result = await cancelSeatSubscription(charge.stripe_subscription_item_id)
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