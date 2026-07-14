import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'
import { assignOwnerTenantIfWhitelabeled } from '@/lib/teamMembership'
import { apiError } from '@/lib/apiError'

const DEFAULT_SEAT_CENTS = 3500

function resolveSeatCents(opts: {
  memberOverride: number | null | undefined
  codeOverride: number | null | undefined
}): number {
  if (typeof opts.memberOverride === 'number') return opts.memberOverride
  if (typeof opts.codeOverride === 'number') return opts.codeOverride
  return DEFAULT_SEAT_CENTS
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { code: rawCode } = body

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return NextResponse.json({ success: false, error: 'Code required' }, { status: 400 })
    }

    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '')

    const { data: codeRow } = await supabaseAdmin
      .from('team_codes')
      .select('id, team_id, code_type, campaign_id, payer, is_active, max_uses, use_count, seat_price_override_cents')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (!codeRow) {
      return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 404 })
    }

    if (codeRow.max_uses !== null && codeRow.use_count >= codeRow.max_uses) {
      return NextResponse.json(
        { success: false, error: 'This code has already been used' },
        { status: 410 }
      )
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id, name')
      .eq('id', codeRow.team_id)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (team.owner_id === userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot redeem a code for your own team' },
        { status: 400 }
      )
    }

    const isSingleUsePartnerSeat =
      codeRow.max_uses === 1 &&
      codeRow.code_type === 'seat' &&
      codeRow.payer === 'owner'

    // Free/public-access codes turn on immediately — nobody's paying, so
    // there's nothing to wait for. Owner-pays codes need the owner's
    // approval (or are instant for the single-use partner-seat case,
    // handled below). Agent-pays codes used to also go straight to
    // 'active' here with zero payment ever collected or enforced — this
    // is the fix: they now stay pending until the agent's own checkout
    // actually succeeds (see /api/stripe/create-subscription and the
    // webhook's pending_team_member_id handling).
    const targetStatus =
      isSingleUsePartnerSeat ? 'active'
      : codeRow.payer === 'owner' ? 'pending'
      : codeRow.payer === 'agent' ? 'pending'
      : 'active'

    const { data: existingActive } = await supabaseAdmin
      .from('team_members')
      .select('id, status, joined_via_code, seat_price_override_cents')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    const { data: existingPending } = await supabaseAdmin
      .from('team_members')
      .select('id, status, joined_via_code, seat_price_override_cents')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    let memberRow: any
    let memberWasCreated = false
    if (existingActive) {
      memberRow = existingActive
    } else if (existingPending) {
      memberRow = existingPending
    } else {
      const { data: newMember, error: memErr } = await supabaseAdmin
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          status: targetStatus,
          joined_via_code: code,
          accepted_at: targetStatus === 'active' ? new Date().toISOString() : null,
        })
        .select('id, status, joined_via_code, seat_price_override_cents')
        .single()

      if (memErr) throw memErr
      memberRow = newMember
      memberWasCreated = true
    }

    let campaignsToGrant: string[] = []
    if (codeRow.code_type === 'seat') {
      if (codeRow.campaign_id) {
        campaignsToGrant = [codeRow.campaign_id]
      } else {
        const { data: tcs } = await supabaseAdmin
          .from('team_campaigns')
          .select('campaign_id')
          .eq('team_id', team.id)
        campaignsToGrant = (tcs || []).map((r: any) => r.campaign_id)
      }
    }

    const accessIsActive = memberRow.status === 'active'
    const newAccessGrants: any[] = []
    const alreadyHeld: any[] = []

    for (const campaignId of campaignsToGrant) {
      const { data: existingAccess } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id, is_active')
        .eq('team_member_id', memberRow.id)
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .maybeSingle()

      if (existingAccess) {
        alreadyHeld.push(campaignId)
        continue
      }

      const { data: granted, error: grantErr } = await supabaseAdmin
        .from('team_campaign_access')
        .insert({
          team_id: team.id,
          team_member_id: memberRow.id,
          campaign_id: campaignId,
          access_source: 'code',
          granted_via_code_id: codeRow.id,
          payer: codeRow.payer,
          is_active: accessIsActive,
        })
        .select()
        .single()

      if (grantErr) {
        if (grantErr.code === '23505') {
          alreadyHeld.push(campaignId)
          continue
        }
        throw grantErr
      }
      newAccessGrants.push(granted)
    }

    const didSomethingNew = memberWasCreated || newAccessGrants.length > 0
    if (codeRow.max_uses !== null && didSomethingNew) {
      const { data: claim } = await supabaseAdmin.rpc('claim_team_code_use', {
        p_code_id: codeRow.id,
      })
      const claimed = Array.isArray(claim) ? claim.length > 0 : !!claim
      if (!claimed) {

        for (const g of newAccessGrants) {
          await supabaseAdmin.from('team_campaign_access').delete().eq('id', g.id)
        }
        if (memberWasCreated) {
          await supabaseAdmin.from('team_members').delete().eq('id', memberRow.id)
        }
        return NextResponse.json(
          { success: false, error: 'This code has already been used' },
          { status: 410 }
        )
      }
    }

    if (codeRow.payer === 'owner') {
      const amount = resolveSeatCents({
        memberOverride: memberRow.seat_price_override_cents,
        codeOverride: codeRow.seat_price_override_cents,
      })

      if (isSingleUsePartnerSeat && memberRow.status === 'active') {

        const { data: chargeRow, error: chargeErr } = await supabaseAdmin
          .from('team_seat_charges')
          .insert({
            team_id: team.id,
            owner_id: team.owner_id,
            agent_id: userId,
            team_member_id: memberRow.id,
            amount_cents: amount,
            status: 'pending',
            period_start: new Date().toISOString(),
            period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single()

        if (chargeErr) throw chargeErr

        const { data: agentUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('clerk_id', userId)
          .maybeSingle()
        const agentEmail = agentUser?.email || userId

        try {
          const result = await createSeatSubscription({
            ownerId: team.owner_id,
            agentId: userId,
            agentEmail,
            teamId: team.id,
            teamName: team.name,
            seatChargeId: chargeRow.id,
            teamMemberId: memberRow.id,
          })

          await supabaseAdmin
            .from('team_seat_charges')
            .update({
              stripe_subscription_id: result.stripeSubscriptionId,
              status: 'paid',
              period_start: result.currentPeriodStart,
              period_end: result.currentPeriodEnd,
            })
            .eq('id', chargeRow.id)
        } catch (err: any) {

          const reason = isSeatBillingError(err) ? `${err.code}: ${err.message}` : (err?.message || 'unknown')
          console.error(`[redeem] single-use seat charge failed for member ${memberRow.id}: ${reason}`)
          await supabaseAdmin
            .from('team_seat_charges')
            .update({ status: 'failed' })
            .eq('id', chargeRow.id)
        }
      } else if (memberRow.status === 'pending') {

        await supabaseAdmin.from('team_seat_charges').insert({
          team_id: team.id,
          owner_id: team.owner_id,
          agent_id: userId,
          team_member_id: memberRow.id,
          amount_cents: amount,
          status: 'pending',
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
    } else if (codeRow.payer === 'agent' && memberRow.status === 'pending') {
      // Agent pays for their own seat. Access stays off (team_campaign_access
      // rows were already created with is_active: false above) until the
      // agent's own checkout actually succeeds — the webhook flips these to
      // 'active' via pending_team_member_id metadata on the subscription it
      // creates. One row per campaign granted, all sharing whichever
      // subscription eventually gets created.
      const campaignsForPayment = campaignsToGrant.filter(
        cid => !alreadyHeld.includes(cid)
      )
      if (campaignsForPayment.length > 0) {
        await supabaseAdmin.from('team_agent_payments').insert(
          campaignsForPayment.map(campaignId => ({
            team_id: team.id,
            campaign_id: campaignId,
            agent_id: userId,
            status: 'pending',
          }))
        )
      }
    }

    // Whitelabel branding should follow the agent the moment they're
    // actually active — not just on the slow, manually-approved path.
    let defaultedToTenantId: string | null = null
    if (memberRow.status === 'active') {
      defaultedToTenantId = await assignOwnerTenantIfWhitelabeled(userId, team.owner_id)
    }

    return NextResponse.json({
      success: true,
      team: { id: team.id, name: team.name },
      member: memberRow,
      code: { type: codeRow.code_type, payer: codeRow.payer },
      newAccessGrants: newAccessGrants.length,
      alreadyHeldAccess: alreadyHeld.length,
      defaultedToTenantId,
      // A freshly-active agent has something to dial right now — send them
      // straight to it, with the campaign pre-selected when there's exactly
      // one, instead of dropping them on a team analytics page they may not
      // even have full visibility into.
      firstCampaignId: campaignsToGrant.length === 1 ? campaignsToGrant[0] : null,
      nextStep:
        codeRow.payer === 'agent'
          ? 'redirect_to_billing'      // pending — agent must complete their own checkout first
          : memberRow.status === 'active'
          ? 'redirect_to_dialer'       // instant — partner seat or free/public access
          : 'awaiting_owner_approval', // multi-use owner-pays, manual verify
    })
  } catch (error: any) {
    console.error('Redeem error:', error)
    return apiError(error, { route: 'teams/redeem' })
  }
}