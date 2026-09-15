import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'

// ─────────────────────────────────────────────────────────────────────────
// WHEN AN AGENT STOPS PAYING, THE OWNER CATCHES THE SEAT
//
// An agent on a self-funded seat cancels their own subscription. Without this,
// their seat evaporates: campaign access is cut, they stop dialing, and the
// first the owner hears about it is an empty chair mid-shift. On a floor of
// fifty that is a hole in the day nobody chose.
//
// So the owner picks the seat up automatically and the agent keeps working,
// until the owner decides otherwise by pausing the seat or removing them from
// the team. Continuity is the default; ending it is a deliberate act.
//
// THIS SPENDS SOMEBODY'S MONEY WITHOUT THEM CLICKING ANYTHING, which is the
// part that has to be handled carefully:
//
//   - It is recorded on the membership (billing_takeover_at) rather than
//     silently changing billing_override, so every surface can say "you picked
//     this up automatically" instead of showing a seat the owner does not
//     remember agreeing to.
//   - The owner is told, in-app, on every page, with a link to the lever.
//   - If their card fails, the charge lands 'failed' and the existing grace
//     period applies — the agent is not thrown out over it either.
//
// Owner-funded seats are skipped: nothing changes for a seat the owner was
// already paying for. Suspended seats are skipped too — the owner has already
// said no to that one, and quietly resuming it would overturn their decision.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_SEAT_CENTS = 3500

export interface TakeoverResult {
  membershipsChecked: number
  takenOver: Array<{ teamId: string; teamName: string; ownerId: string; memberId: string }>
  billingFailed: Array<{ memberId: string; reason: string }>
}

export async function takeOverAgentPaidSeats(agentClerkId: string): Promise<TakeoverResult> {
  const result: TakeoverResult = {
    membershipsChecked: 0,
    takenOver: [],
    billingFailed: [],
  }

  // ── THE OPERATOR CAN TURN THIS OFF ──────────────────────────────────────
  // This spends an owner's money without them clicking anything, which is
  // defensible as a default and indefensible as something with no switch.
  // platform_config.seat_takeover_enabled; off means the seat lapses and the
  // owner decides for themselves whether to re-open it.
  try {
    const { getPlatformConfig } = await import('@/lib/platformConfig')
    const cfg = await getPlatformConfig()
    if (cfg?.seat_takeover_enabled === false) {
      console.log('[seatTakeover] disabled in platform config, leaving seats to lapse')
      return result
    }
  } catch {
    // Unreadable config keeps the historical behaviour: take the seat over,
    // because an agent losing access mid-shift is the worse failure.
  }

  // One person can hold more than one subscription over time. If any is still
  // active they are not actually leaving, and picking up their seats would bill
  // owners for access the agent is still funding.
  if (await agentPaysForThemselves(agentClerkId)) return result

  const { data: memberships, error } = await supabaseAdmin
    .from('team_members')
    .select('id, team_id, user_id, status, billing_override, joined_via_code, seat_suspended_at, seat_price_override_cents, billing_takeover_at')
    .eq('user_id', agentClerkId)
    .eq('status', 'active')
    .is('seat_suspended_at', null)

  if (error) {
    console.error('[seatTakeover] membership lookup failed', error)
    return result
  }

  const rows = memberships || []
  result.membershipsChecked = rows.length
  if (rows.length === 0) return result

  // joined_via_code holds the code TEXT, not a foreign key, so who-pays has to
  // be looked up rather than embedded.
  const codes = Array.from(
    new Set(rows.map(r => r.joined_via_code).filter((c): c is string => !!c))
  )
  const codePayer = new Map<string, string>()
  if (codes.length > 0) {
    const { data: codeRows } = await supabaseAdmin
      .from('team_codes')
      .select('code, payer')
      .in('code', codes)
    for (const c of codeRows || []) codePayer.set(c.code, c.payer)
  }

  const agentFunded = rows.filter(r => {
    // Already taken over on a previous run — idempotent by design, since a
    // cancellation can produce more than one webhook.
    if (r.billing_takeover_at) return false
    if (r.billing_override === 'owner') return false
    if (r.billing_override === 'agent') return true
    return r.joined_via_code ? codePayer.get(r.joined_via_code) === 'agent' : false
  })

  if (agentFunded.length === 0) return result

  const teamIds = Array.from(new Set(agentFunded.map(r => r.team_id)))
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, owner_id')
    .in('id', teamIds)
  const teamById = new Map((teams || []).map((t: any) => [t.id, t]))

  const { data: agentUser } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('clerk_id', agentClerkId)
    .maybeSingle()
  const agentEmail = agentUser?.email || agentClerkId

  const now = new Date().toISOString()

  for (const m of agentFunded) {
    const team = teamById.get(m.team_id)
    if (!team) continue

    const amount =
      typeof m.seat_price_override_cents === 'number'
        ? m.seat_price_override_cents
        : DEFAULT_SEAT_CENTS

    // Mark the takeover BEFORE attempting the charge. If billing fails the seat
    // is still the owner's responsibility and the grace period governs what
    // happens next — leaving it unmarked would make the next webhook try again
    // and stack duplicate subscriptions on the owner's card.
    const { error: markErr } = await supabaseAdmin
      .from('team_members')
      .update({
        billing_override: 'owner',
        billing_takeover_at: now,
        billing_takeover_reason: 'agent_subscription_ended',
      })
      .eq('id', m.id)

    if (markErr) {
      console.error(`[seatTakeover] could not mark member ${m.id}`, markErr)
      continue
    }

    // ── ACCESS IS RESTORED AFTER THE MONEY MOVES, NOT BEFORE ───────────
    // This used to sit HERE, above the charge, with the comment "the whole
    // point of this is that they keep dialing". It meant a takeover whose
    // charge then failed had actively switched the agent's access back ON and
    // nothing switched it off again.
    //
    // 15 Sept: an agent cancelled their own plan, the owner's card was never
    // successfully charged, and she dialed 169 calls that day on the
    // platform's Telnyx balance with no subscription behind any of them. The
    // re-grant is now in the success branch below.

    const { data: chargeRow, error: chargeErr } = await supabaseAdmin
      .from('team_seat_charges')
      .insert({
        team_id: team.id,
        owner_id: team.owner_id,
        agent_id: agentClerkId,
        team_member_id: m.id,
        amount_cents: amount,
        status: 'pending',
        period_start: now,
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (chargeErr || !chargeRow) {
      console.error(`[seatTakeover] charge insert failed for member ${m.id}`, chargeErr)
      result.billingFailed.push({ memberId: m.id, reason: 'charge_insert_failed' })
      continue
    }

    try {
      const sub = await createSeatSubscription({
        ownerId: team.owner_id,
        agentId: agentClerkId,
        agentEmail,
        teamId: team.id,
        teamName: team.name,
        seatChargeId: chargeRow.id,
        teamMemberId: m.id,
      })

      await supabaseAdmin
        .from('team_seat_charges')
        .update({
          stripe_subscription_item_id: sub.stripeSubscriptionId,
          status: 'paid',
          period_start: sub.currentPeriodStart,
          period_end: sub.currentPeriodEnd,
          // The invoiced amount, not the list price.
          charged_cents: sub.chargedCents ?? null,
          discount_percent: sub.discountPercent ?? null,
        })
        .eq('id', chargeRow.id)

      // Now, and only now. The owner is paying, so the agent keeps dialing —
      // which is what the takeover is for. Their own cancellation may have
      // deactivated campaign access on the way through.
      await supabaseAdmin
        .from('team_campaign_access')
        .update({ is_active: true, revoked_at: null })
        .eq('team_member_id', m.id)
        .eq('is_active', false)

      result.takenOver.push({
        teamId: team.id,
        teamName: team.name,
        ownerId: team.owner_id,
        memberId: m.id,
      })
    } catch (err: any) {
      const reason = isSeatBillingError(err) ? `${err.code}: ${err.message}` : (err?.message || 'unknown')
      console.error(`[seatTakeover] seat charge failed for member ${m.id}: ${reason}`)

      // ── WRITE DOWN WHY ─────────────────────────────────────────
      // `reason` was computed, logged to the console, and then dropped — the
      // row kept failure_reason NULL. When this was investigated on 15 Sept
      // the only copy of why a charge failed was a Vercel log line from that
      // morning, and the question "was the card declined, or did our own code
      // throw?" could not be answered from the database at all.
      await supabaseAdmin
        .from('team_seat_charges')
        .update({
          status: 'failed',
          failure_reason: reason.slice(0, 1000),
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', chargeRow.id)

      // ── NOBODY IS PAYING, SO NOBODY IS DIALING ───────────────────────
      // The agent has just cancelled their own plan and the owner's card did
      // not take the seat. Waiting for cron/seat-billing-enforcement is not
      // good enough: that job runs daily, and until 15 Sept its filter could
      // not see this row for a week. Suspend here, at the moment the money
      // fails, and let the owner's payment un-suspend it.
      const failedAt = new Date().toISOString()
      await supabaseAdmin
        .from('team_members')
        .update({ seat_suspended_at: failedAt, seat_suspend_reason: 'unpaid' })
        .eq('id', m.id)
        .is('seat_suspended_at', null)

      await supabaseAdmin
        .from('team_campaign_access')
        .update({ is_active: false, revoked_at: failedAt })
        .eq('team_member_id', m.id)
        .eq('is_active', true)

      result.billingFailed.push({ memberId: m.id, reason })
    }
  }

  if (result.takenOver.length > 0) {
    console.log(
      `[seatTakeover] ${agentClerkId} cancelled their own plan, ` +
      `${result.takenOver.length} seat(s) picked up by owners`
    )
  }

  return result
}
