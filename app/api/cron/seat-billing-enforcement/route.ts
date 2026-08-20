import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('cron/seat-billing-enforcement')

// ─────────────────────────────────────────────────────────────────────────
// SEAT BILLING ENFORCEMENT — THE GRACE PERIOD, ENFORCED
//
// Two rules were both true and together left a hole:
//
//   1. A declined card must not eject an agent. They were hired, told the seat
//      was covered, and a payment problem they cannot see or fix is the wrong
//      thing to punish them for. The owner holds the lever.
//   2. Access is granted by MEMBERSHIP, not by a settled receipt — so a new
//      hire is not bounced to checkout for a seat somebody else agreed to pay.
//
// Nothing closed the loop. A failed charge deactivated that member's campaign
// access, but never touched their membership, so getActiveTeamSeats kept
// returning the team and the person kept full entry to DialerSeat. Two people
// could cross-invite each other on owner-pays codes, never attach a card, and
// both work indefinitely.
//
// The fix is a grace period rather than an immediate cut, which honours both
// rules: the agent keeps working through the week that was charged for, and if
// the seat is still unpaid a week after its period ended, it suspends. Rule 1
// is about not punishing people for a transient card problem; it was never
// meant to mean "never collect".
//
// Suspension is reversible and visible: seat_suspend_reason records why, the
// owner sees it in Manage Member, and resuming clears it. The agent gets the
// plain unsubscribed banner pointing at their own plan — they keep their
// account and every lead, call and disposition in it.
// ─────────────────────────────────────────────────────────────────────────

const GRACE_DAYS = 7
const BATCH_LIMIT = 500

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── RETRY BEFORE ENFORCING ───────────────────────────────────────────
    // A seat charge that failed because the owner had no card should keep
    // trying, every day, until they attach one. Nothing about that owner's
    // intention changed — they agreed to the seat; their billing was simply not
    // ready. Making them find and re-approve every affected member by hand
    // would be the product punishing them for its own timing.
    //
    // Runs before the suspension pass on purpose: a card added this morning
    // should rescue the seat today, not have it suspended an hour before the
    // retry that would have saved it.
    const retried = await retryFailedSeatCharges()

    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Charges that failed and whose period ended more than a week ago. Reading
    // period_end rather than created_at deliberately: the agent is entitled to
    // the week the charge was raised for, however late the attempt failed.
    const { data: staleFailed, error: chargeErr } = await supabase
      .from('team_seat_charges')
      .select('id, team_member_id, team_id, agent_id, owner_id, status, period_end')
      .in('status', ['failed', 'voided'])
      .not('team_member_id', 'is', null)
      .lt('period_end', cutoff)
      .limit(BATCH_LIMIT)

    if (chargeErr) throw chargeErr

    const candidates = staleFailed || []
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, checked: 0, suspended: 0, retried })
    }

    const memberIds = Array.from(
      new Set(candidates.map((c: any) => c.team_member_id).filter(Boolean))
    )

    // A later PAID charge clears the debt. Without this check, one historical
    // failure would suspend a member who has been paying happily ever since —
    // the single most damaging way this job could be wrong.
    const { data: paidRows } = await supabase
      .from('team_seat_charges')
      .select('team_member_id, period_end')
      .in('team_member_id', memberIds)
      .eq('status', 'paid')

    const latestPaidEnd = new Map<string, number>()
    for (const r of paidRows || []) {
      if (!r.team_member_id || !r.period_end) continue
      const t = new Date(r.period_end).getTime()
      const prev = latestPaidEnd.get(r.team_member_id)
      if (prev === undefined || t > prev) latestPaidEnd.set(r.team_member_id, t)
    }

    // Only members still active and not already suspended are worth touching.
    const { data: members } = await supabase
      .from('team_members')
      .select('id, status, seat_suspended_at, billing_override')
      .in('id', memberIds)
      .eq('status', 'active')
      .is('seat_suspended_at', null)

    const liveMembers = new Map<string, any>()
    for (const m of members || []) liveMembers.set(m.id, m)

    const toSuspend: string[] = []
    for (const c of candidates) {
      const member = liveMembers.get(c.team_member_id)
      if (!member) continue

      const paidThrough = latestPaidEnd.get(c.team_member_id)
      if (paidThrough !== undefined && paidThrough >= new Date(c.period_end).getTime()) {
        // Settled later. Nothing owing.
        continue
      }
      if (!toSuspend.includes(c.team_member_id)) toSuspend.push(c.team_member_id)
    }

    if (toSuspend.length === 0) {
      return NextResponse.json({ success: true, checked: candidates.length, suspended: 0, retried })
    }

    const now = new Date().toISOString()
    const { error: suspendErr } = await supabase
      .from('team_members')
      .update({ seat_suspended_at: now, seat_suspend_reason: 'unpaid' })
      .in('id', toSuspend)

    if (suspendErr) throw suspendErr

    // Campaign access goes with the seat. The webhook already does this on the
    // failure itself; repeating it here covers the case where that webhook was
    // missed, since a suspended seat with live access rows would be a seat that
    // is not really suspended.
    const { error: accessErr } = await supabase
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: now })
      .in('team_member_id', toSuspend)
      .eq('is_active', true)

    if (accessErr) {
      console.error('[seat-enforcement] access revoke failed', accessErr)
    }

    console.log(
      `[seat-enforcement] suspended ${toSuspend.length} seat(s) unpaid for more than ${GRACE_DAYS} days`
    )

    return NextResponse.json({
      success: true,
      checked: candidates.length,
      suspended: toSuspend.length,
      retried,
      graceDays: GRACE_DAYS,
    })
  } catch (error: any) {
    console.error('seat-billing-enforcement error:', error)
    return apiError(error, { route: 'cron/seat-billing-enforcement' })
  }
}


interface RetrySummary {
  attempted: number
  recovered: number
  stillFailing: number
  voidedSelfFunded: number
}

/**
 * Re-attempt every seat charge that failed, once a day, until it sticks.
 *
 * Only charges still inside the grace window are retried — past that the seat
 * suspends and the charge is no longer something to chase. A charge whose agent
 * has since started paying for DialerSeat themselves is voided rather than
 * retried: there is no seat to buy for somebody who already has access.
 */
async function retryFailedSeatCharges(): Promise<RetrySummary> {
  const summary: RetrySummary = {
    attempted: 0,
    recovered: 0,
    stillFailing: 0,
    voidedSelfFunded: 0,
  }

  const windowStart = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: failed } = await supabase
    .from('team_seat_charges')
    .select('id, team_id, owner_id, agent_id, team_member_id, amount_cents, period_end')
    .eq('status', 'failed')
    .not('team_member_id', 'is', null)
    .gte('period_end', windowStart)
    .limit(BATCH_LIMIT)

  const rows = failed || []
  if (rows.length === 0) return summary

  // Only chase seats that are still live. A member who has been removed or
  // suspended in the meantime is not owed another attempt on the owner's card.
  const { data: liveMembers } = await supabase
    .from('team_members')
    .select('id')
    .in('id', rows.map((r: any) => r.team_member_id))
    .eq('status', 'active')
    .is('seat_suspended_at', null)

  const live = new Set((liveMembers || []).map((m: any) => m.id))

  const teamIds = Array.from(new Set(rows.map((r: any) => r.team_id).filter(Boolean)))
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', teamIds)
  const teamName = new Map((teams || []).map((t: any) => [t.id, t.name]))

  const { data: agentRows } = await supabase
    .from('users')
    .select('clerk_id, email')
    .in('clerk_id', Array.from(new Set(rows.map((r: any) => r.agent_id))))
  const emailByAgent = new Map((agentRows || []).map((u: any) => [u.clerk_id, u.email]))

  for (const c of rows) {
    if (!live.has(c.team_member_id)) continue

    if (await agentPaysForThemselves(c.agent_id)) {
      await supabase.from('team_seat_charges').update({ status: 'voided' }).eq('id', c.id)
      await supabase
        .from('team_members')
        .update({ billing_override: 'free' })
        .eq('id', c.team_member_id)
      summary.voidedSelfFunded++
      continue
    }

    summary.attempted++
    try {
      const sub = await createSeatSubscription({
        ownerId: c.owner_id,
        agentId: c.agent_id,
        agentEmail: emailByAgent.get(c.agent_id) || c.agent_id,
        teamId: c.team_id,
        teamName: teamName.get(c.team_id) || 'Team',
        seatChargeId: c.id,
        teamMemberId: c.team_member_id,
      })

      await supabase
        .from('team_seat_charges')
        .update({
          stripe_subscription_item_id: sub.stripeSubscriptionId,
          status: 'paid',
          period_start: sub.currentPeriodStart,
          period_end: sub.currentPeriodEnd,
        })
        .eq('id', c.id)
      summary.recovered++
    } catch (err: any) {
      const reason = isSeatBillingError(err) ? err.code : (err?.message || 'unknown')
      console.log(`[seat-enforcement] retry still failing for charge ${c.id}: ${reason}`)
      summary.stillFailing++
    }
  }

  if (summary.recovered > 0) {
    console.log(`[seat-enforcement] recovered ${summary.recovered} seat charge(s) on retry`)
  }
  return summary
}
