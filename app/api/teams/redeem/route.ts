import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'
import { assignOwnerTenantIfWhitelabeled } from '@/lib/teamMembership'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'
import { syncIfTierChanged } from '@/lib/seatDiscount'

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
      .select('id, team_id, code_type, campaign_id, payer, is_active, max_uses, use_count, seat_price_override_cents, join_mode')
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

    // ── THE CODE DECIDES, NOT THE PAYER ──────────────────────────────────
    // This inferred admission from `payer` alone, so every owner-paid invite
    // behaved as "wait for approval" — an owner handing a link to someone they
    // had just hired had no way to say "let them straight in", and the joiner
    // sat waiting on a seat already agreed to.
    //
    // join_mode is now an explicit property of the code:
    //   instant  — admitted on redemption, and charged then
    //   approval — held pending, charged when the owner accepts in Requests
    //
    // Agent-pays is unaffected by join_mode and stays pending regardless: that
    // seat is not paid for until the agent's own checkout succeeds, and
    // admitting them first would be giving away a seat nobody has bought.
    // Straight in unless the owner asked otherwise. Approval is the
    // exception a cautious owner opts into, not the toll everybody pays:
    // most codes are handed to someone already hired, and making that
    // person wait on a click adds a delay with nothing behind it.
    const joinMode = codeRow.join_mode === 'approval' ? 'approval' : 'instant'

    // Set when an instant seat could not be billed, so the response says so
    // plainly instead of reporting a success the money did not back.
    let seatChargeFailedLocal: string | null = null

    const targetStatus =
      isSingleUsePartnerSeat ? 'active'
      : codeRow.payer === 'agent' ? 'pending'
      : codeRow.payer === 'owner' ? (joinMode === 'instant' ? 'active' : 'pending')
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

    // Nothing to bill for somebody who already pays for DialerSeat. Their
    // access does not depend on this seat, so neither should their join.
    const joinerPaysForThemselves = await agentPaysForThemselves(userId)

    if (codeRow.payer === 'owner' && joinerPaysForThemselves) {
      await supabaseAdmin
        .from('team_members')
        .update({ billing_override: 'free' })
        .eq('id', memberRow.id)
    } else if (codeRow.payer === 'owner') {
      const amount = resolveSeatCents({
        memberOverride: memberRow.seat_price_override_cents,
        codeOverride: codeRow.seat_price_override_cents,
      })

      // Admitted straight away — so bill straight away. This is the same path
      // the single-use partner seat already used: raise the charge, attempt it
      // against the owner's card, mark it paid or failed. Reused rather than
      // rewritten, because it is the only seat-billing code that has ever run.
      //
      // A declined card does NOT eject them. The charge lands 'failed', the
      // owner is told, and they keep working until the owner decides
      // otherwise — pausing the seat is the lever, and it cuts access at once.
      // Throwing a new hire out over a payment problem they cannot see or fix
      // is the wrong end to apply pressure to.
      const chargeNow = isSingleUsePartnerSeat || joinMode === 'instant'

      if (chargeNow && memberRow.status === 'active') {

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
              stripe_subscription_item_id: result.stripeSubscriptionId,
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

          // ── AN INSTANT SEAT IS STILL A PAID SEAT ────────────────────────
          // The member was set active a moment ago, before the card was tried,
          // because that is what "instant" means. The charge failing makes that
          // premature: they would be dialling on a seat nobody paid for.
          //
          // Demoted to pending rather than removed. The invite was legitimate
          // and nothing about it is lost — the owner fixes their card and
          // accepts from Requests, which is the same place a manual-approval
          // join would have landed anyway.
          await supabaseAdmin
            .from('team_members')
            .update({ status: 'pending', accepted_at: null })
            .eq('id', memberRow.id)

          memberRow = { ...memberRow, status: 'pending' } as typeof memberRow
          seatChargeFailedLocal = reason
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

    // ── A PARTNER'S CODE WAS USED ────────────────────────────────────────
    // Distinct from a signup notification on purpose. A self-serve signup says
    // marketing is working; this says a PARTNERSHIP is, which is the number
    // that decides whether to go and find more of them. It also tells an admin
    // a floor is arriving before the seats show up on a statement.
    //
    // Awaited rather than fired and forgotten: a promise left dangling when a
    // serverless response returns is simply discarded, and this one is the only
    // record that the code was used at all.
    try {
      const { data: joiner } = await supabaseAdmin
        .from('users')
        .select('email, first_name, last_name')
        .eq('clerk_id', userId)
        .maybeSingle()
      const who =
        [joiner?.first_name, joiner?.last_name].filter(Boolean).join(' ').trim() ||
        joiner?.email ||
        'Someone'
      const what = codeRow.code_type === 'seat' ? 'campaign code' : 'team code'
      const payerLabel = codeRow.payer === 'agent' ? 'they pay' : 'owner pays'
      await sendAdminPush(
        'team_join',
        `${who} joined ${team.name} with a ${what} (${code} · ${payerLabel}).`
      )
    } catch (e) {
      console.error('[redeem] join notification failed', e)
    }

    // ── DID THIS SEAT CROSS A TIER? ──────────────────────────────────────
    // Seat ten has to discount the nine already open, and it has to happen now
    // rather than on tomorrow's reconcile — somebody onboarding a floor in an
    // afternoon should see the right price the same afternoon. Only fires on an
    // actual boundary, so fifteen redemptions do not trigger fifteen syncs.
    if (memberRow.status === 'active') {
      await syncIfTierChanged(team.owner_id)
    }

    // Whitelabel branding should follow the agent the moment they're
    // actually active — not just on the slow, manually-approved path.
    let defaultedToTenantId: string | null = null
    let tenantSlug: string | null = null
    if (memberRow.status === 'active') {
      const assigned = await assignOwnerTenantIfWhitelabeled(userId, team.owner_id)
      defaultedToTenantId = assigned?.id ?? null
      tenantSlug = assigned?.slug ?? null
    }

    return NextResponse.json({
      success: true,
      team: { id: team.id, name: team.name },
      member: memberRow,
      code: { type: codeRow.code_type, payer: codeRow.payer },
      newAccessGrants: newAccessGrants.length,
      alreadyHeldAccess: alreadyHeld.length,
      defaultedToTenantId,
      // Non-null when an instant seat could not be charged. The member has been
      // put back to pending, so nextStep already reads awaiting_owner_approval;
      // this is what lets the screen explain WHY rather than implying the owner
      // simply has not got to it yet.
      seatChargeFailed: seatChargeFailedLocal,
      // The brand's host. An agent who joins a whitelabel team belongs on that
      // team's subdomain, not on the apex they happened to sign up through —
      // otherwise they land in a DialerSeat-branded product having been sold
      // somebody else's.
      tenantSlug,
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