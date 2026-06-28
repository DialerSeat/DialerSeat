import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

// =============================================================================
// /api/teams/redeem  — agent submits a code to redeem  (v2: single-use links)
// =============================================================================
// v2 ADDS the partner join-link flow on top of the existing (code_type × payer)
// matrix — without changing any existing behavior:
//
//   NEW: single-use seat+owner codes auto-redeem with NO owner approval.
//   A code with max_uses=1, code_type='seat', payer='owner' is a PARTNER's
//   per-seat link: the partner already sold the seat downstream, so redeeming
//   it provisions the agent INSTANTLY (member active, access active, seat
//   charge fired) instead of going to 'pending → awaiting_owner_approval'.
//
//   Everything else is byte-for-byte the prior behavior:
//     recruit+owner → pending roster
//     recruit+agent → active roster, no access
//     seat+owner  (multi/unlimited use) → pending, access staged inactive,
//                  owner must Accept (manual-verify path — unchanged)
//     seat+agent  → active, access active immediately (gated by their own sub)
//
//   USE LIMITS: codes can now carry max_uses (NULL = unlimited). Redemption
//   atomically claims a use via claim_team_code_use(); an exhausted code is
//   rejected. This makes a single-use link un-forwardable — it works once,
//   for whoever the partner sent it to.
//
//   PRICE: the seat charge amount resolves by precedence —
//     member.seat_price_override_cents → code.seat_price_override_cents → 3500.
//   (No volume tiers yet, per product decision; this is the manual-override
//   lever for negotiated/whale deals.)
// =============================================================================

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

    // Look up the code (now also reads max_uses, use_count, price override)
    const { data: codeRow } = await supabaseAdmin
      .from('team_codes')
      .select('id, team_id, code_type, campaign_id, payer, is_active, max_uses, use_count, seat_price_override_cents')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (!codeRow) {
      return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 404 })
    }

    // Early exhaustion check (fast fail before any work). The authoritative,
    // race-safe consumption happens via claim_team_code_use() below, but only
    // AFTER we know we're actually going to grant something new.
    if (codeRow.max_uses !== null && codeRow.use_count >= codeRow.max_uses) {
      return NextResponse.json(
        { success: false, error: 'This code has already been used' },
        { status: 410 }
      )
    }

    // Block: owners can't redeem codes for their own team
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

    // ── SINGLE-USE PARTNER LINK DETECTION ────────────────────────────────────
    // A single-use seat+owner code is a partner's per-seat link: auto-provision,
    // no owner approval. Any other shape keeps the original status logic.
    const isSingleUsePartnerSeat =
      codeRow.max_uses === 1 &&
      codeRow.code_type === 'seat' &&
      codeRow.payer === 'owner'

    // Determine target member status.
    //   - single-use partner seat → active (instant, no approval gate)
    //   - owner-pays (multi-use)  → pending (owner Accept fires Stripe) [unchanged]
    //   - agent-pays              → active [unchanged]
    const targetStatus =
      isSingleUsePartnerSeat ? 'active'
      : codeRow.payer === 'owner' ? 'pending'
      : 'active'

    // Existing membership rows
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

    // Determine which campaigns this code unlocks
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

    // For single-use partner seats AND agent-pays, access goes active now.
    // For multi-use owner-pays (pending), access is staged inactive until Accept.
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

    // ── CONSUME A USE (race-safe) ────────────────────────────────────────────
    // Only consume if this redemption actually did something new (created the
    // member or granted new access). An idempotent re-hit of an already-redeemed
    // code shouldn't burn a use. For limited codes, claim atomically; if the
    // claim fails (someone else took the last use in a race), roll back the
    // access we just granted and reject.
    const didSomethingNew = memberWasCreated || newAccessGrants.length > 0
    if (codeRow.max_uses !== null && didSomethingNew) {
      const { data: claim } = await supabaseAdmin.rpc('claim_team_code_use', {
        p_code_id: codeRow.id,
      })
      const claimed = Array.isArray(claim) ? claim.length > 0 : !!claim
      if (!claimed) {
        // Lost the race — undo the access rows we just created (best effort)
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

    // ── SEAT CHARGE ──────────────────────────────────────────────────────────
    // Fire a seat charge when the owner is paying AND access is live now:
    //   - single-use partner seat → charge the owner's card IMMEDIATELY via the
    //     same createSeatSubscription() the Accept route uses (no Accept gate;
    //     the partner already committed by minting the link). The link could
    //     only be created if the owner had a card on file (mint-time gate in
    //     /api/teams/codes/create), so this should not hit no_card.
    //   - multi-use owner-pays → stage pending; the Accept route fires it
    //     (UNCHANGED original behavior)
    if (codeRow.payer === 'owner') {
      const amount = resolveSeatCents({
        memberOverride: memberRow.seat_price_override_cents,
        codeOverride: codeRow.seat_price_override_cents,
      })

      if (isSingleUsePartnerSeat && memberRow.status === 'active') {
        // 1) Insert the charge row (pending), so we have a seat_charge_id to
        //    tag the Stripe sub with — same shape the Accept route expects.
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

        // 2) Resolve the agent's email for the Stripe description/metadata.
        const { data: agentUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('clerk_id', userId)
          .maybeSingle()
        const agentEmail = agentUser?.email || userId

        // 3) Create the real Stripe seat subscription on the OWNER's card —
        //    identical call to the Accept route. On success, mark the charge
        //    paid with the real sub id + period.
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
          // The agent is already joined and dialing — we do NOT un-join them
          // for an owner-side billing failure at this point. Mark the charge
          // failed so the owner can resolve it (add/fix card → re-charge job
          // or manual accept). Log loudly for ops visibility.
          const reason = isSeatBillingError(err) ? `${err.code}: ${err.message}` : (err?.message || 'unknown')
          console.error(`[redeem] single-use seat charge failed for member ${memberRow.id}: ${reason}`)
          await supabaseAdmin
            .from('team_seat_charges')
            .update({ status: 'failed' })
            .eq('id', chargeRow.id)
        }
      } else if (memberRow.status === 'pending') {
        // Original multi-use owner-pays path — staged, awaits Accept.
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
    }

    return NextResponse.json({
      success: true,
      team: { id: team.id, name: team.name },
      member: memberRow,
      code: { type: codeRow.code_type, payer: codeRow.payer },
      newAccessGrants: newAccessGrants.length,
      alreadyHeldAccess: alreadyHeld.length,
      nextStep:
        codeRow.payer === 'agent'
          ? 'redirect_to_billing'
          : isSingleUsePartnerSeat
          ? 'redirect_to_team'        // instant — partner seat, no approval
          : memberRow.status === 'pending'
          ? 'awaiting_owner_approval' // multi-use owner-pays, manual verify
          : 'redirect_to_team',
    })
  } catch (error: any) {
    console.error('Redeem error:', error)
    return apiError(error, { route: 'teams/redeem' })
  }
}