import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'
import { syncOwnerSeatDiscounts } from '@/lib/seatDiscount'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel's documented default and Hobby maximum is 300s with fluid compute
// (Pro can go to 800s). An earlier revision of this file set 60 here on the
// mistaken belief that the default was ten seconds — that LOWERED the ceiling.
// 300 is the platform maximum on the current plan; do not reduce it without a
// reason, and raise it if the plan changes.
// The passes below budget against this number, not against a row count: a few
// hundred Stripe retries are bounded by time, never by how many rows were
// selected.
export const maxDuration = 300

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

// Rows per round trip. A page size, not a ceiling: every pass below keeps
// paging until its work is done or its time budget is spent, and reports
// whatever it could not reach.
const PAGE_SIZE = 500

// Stop STARTING new work here, leaving room to finish what is in flight and
// return a report. Being killed mid-pass is what loses the record of progress.
const TIME_BUDGET_MS = 240_000

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── STAGED BUDGETS, NOT ONE SHARED CLOCK ─────────────────────────────
    // One clock for all three passes would not actually protect anything: the
    // retry pass runs first and spends a Stripe round trip per row, so on a
    // large backlog it would consume the entire budget and the suspension pass
    // would get none — every run, forever.
    //
    // Each pass therefore gets a slice, and the one with consequences for a
    // person's access is the one guaranteed to run. Retry stops at half,
    // discounts at three-quarters, and the suspension pass — which is
    // database-only and fast — always has the remainder. A seat that should be
    // suspended is worse left open than a discount left un-reconciled for a
    // day, and both are recoverable next run.
    const startedAt = Date.now()
    const spentPast = (fraction: number) => () =>
      Date.now() - startedAt > TIME_BUDGET_MS * fraction

    const retryBudgetSpent = spentPast(0.5)
    const discountBudgetSpent = spentPast(0.75)
    const outOfTime = spentPast(1)

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
    const retried = await retryFailedSeatCharges(retryBudgetSpent)

    // ── DISCOUNTS FOLLOW THE SEAT COUNT ──────────────────────────────────
    // Crossing ten seats has to discount the nine already open, or the tier
    // silently means "every seat you buy AFTER the tenth" — which is not what
    // the page says and not what anybody would read it as. Removal matters
    // equally: an owner who drops back below a tier has stopped earning it, and
    // a coupon left attached is a billing system that has lost track of what it
    // charges.
    const discounts = await reconcileDiscounts(discountBudgetSpent)

    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // ── WHY THIS PAGES, AND WHY IT MARKS ─────────────────────────────────
    // This was a single LIMIT 500 with no ordering, over a filter that nothing
    // it did could change. The same rows came back every day and any charge
    // past the limit was never seen at all. Two fixes, both needed:
    //
    //   enforced_at makes the set DRAIN. A charge that has been through the
    //   decision is stamped whether or not it ended in a suspension, because
    //   "already settled" and "member already suspended" are decisions too and
    //   do not need making twice.
    //
    //   Ordering by period_end makes it FAIR. Oldest debt first, so a backlog
    //   too large for one run is worked in a defined order rather than
    //   whichever rows the planner happened to hand back.
    //
    // 'voided' is no longer selected. Voided means the charge was deliberately
    // closed — the member was removed or rejected, or the agent started paying
    // for DialerSeat themselves. Suspending somebody over a charge we chose not
    // to collect inverts what voiding it meant, and for a self-funded agent it
    // revoked campaign access for a seat explicitly marked as costing nobody
    // anything.
    let checked = 0
    let suspendedTotal = 0
    let exhausted = true

    for (;;) {
      if (outOfTime()) { exhausted = false; break }

      const { data: staleFailed, error: chargeErr } = await supabase
        .from('team_seat_charges')
        .select('id, team_member_id, team_id, agent_id, owner_id, status, period_end')
        .eq('status', 'failed')
        .is('enforced_at', null)
        .not('team_member_id', 'is', null)
        .lt('period_end', cutoff)
        .order('period_end', { ascending: true })
        .limit(PAGE_SIZE)

      if (chargeErr) throw chargeErr

      const candidates = staleFailed || []
      if (candidates.length === 0) break
      checked += candidates.length

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

        // billing_override 'free' is the flag saying this seat costs nobody
        // anything — an owner-pays code, or an agent funding their own
        // DialerSeat. It was being read from the database and then ignored.
        if (member.billing_override === 'free') continue

        const paidThrough = latestPaidEnd.get(c.team_member_id)
        if (paidThrough !== undefined && paidThrough >= new Date(c.period_end).getTime()) {
          // Settled later. Nothing owing.
          continue
        }
        if (!toSuspend.includes(c.team_member_id)) toSuspend.push(c.team_member_id)
      }

      const now = new Date().toISOString()

      if (toSuspend.length > 0) {
        const { error: suspendErr } = await supabase
          .from('team_members')
          .update({ seat_suspended_at: now, seat_suspend_reason: 'unpaid' })
          .in('id', toSuspend)

        if (suspendErr) throw suspendErr

        // Campaign access goes with the seat. The webhook already does this on
        // the failure itself; repeating it here covers the case where that
        // webhook was missed, since a suspended seat with live access rows
        // would be a seat that is not really suspended.
        const { error: accessErr } = await supabase
          .from('team_campaign_access')
          .update({ is_active: false, revoked_at: now })
          .in('team_member_id', toSuspend)
          .eq('is_active', true)

        if (accessErr) {
          console.error('[seat-enforcement] access revoke failed', accessErr)
        }

        suspendedTotal += toSuspend.length
      }

      // Stamped LAST, and for every candidate examined rather than only those
      // suspended. If this write fails the page is retried tomorrow, which is
      // the safe direction: deciding twice is a no-op, forgetting is not.
      const { error: markErr } = await supabase
        .from('team_seat_charges')
        .update({ enforced_at: now })
        .in('id', candidates.map((c: any) => c.id))

      if (markErr) throw markErr

      if (candidates.length < PAGE_SIZE) break
    }

    // What is still undecided. Reported rather than swallowed — a backlog that
    // outgrows what one run can drain is exactly the condition the old fixed
    // limit hid.
    const { count: pending } = await supabase
      .from('team_seat_charges')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .is('enforced_at', null)
      .lt('period_end', cutoff)

    if (suspendedTotal > 0) {
      console.log(
        `[seat-enforcement] suspended ${suspendedTotal} seat(s) unpaid for more than ${GRACE_DAYS} days`
      )
    }
    if (!exhausted) {
      console.warn(`[seat-enforcement] out of time with ${pending ?? 0} charge(s) still undecided`)
    }

    return NextResponse.json({
      success: true,
      checked,
      suspended: suspendedTotal,
      retried,
      discounts,
      graceDays: GRACE_DAYS,
      // false means the backlog outlasted one run; it resumes tomorrow, oldest
      // first, and pendingAfterRun says how much is waiting.
      completed: exhausted,
      pendingAfterRun: pending ?? 0,
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
  /** Charges selected but not reached before the time budget ran out. */
  notReached: number
}

/**
 * Re-attempt every seat charge that failed, once a day, until it sticks.
 *
 * Only charges still inside the grace window are retried — past that the seat
 * suspends and the charge is no longer something to chase. A charge whose agent
 * has since started paying for DialerSeat themselves is voided rather than
 * retried: there is no seat to buy for somebody who already has access.
 */
async function retryFailedSeatCharges(outOfTime: () => boolean): Promise<RetrySummary> {
  const summary: RetrySummary = {
    attempted: 0,
    recovered: 0,
    stillFailing: 0,
    voidedSelfFunded: 0,
    notReached: 0,
  }

  const windowStart = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── OLDEST DEBT FIRST ───────────────────────────────────────────────────
  // Every row here costs a Stripe round trip, so unlike the suspension pass
  // this one genuinely cannot drain in a single invocation once the backlog is
  // large. That makes ORDERING the thing that matters: unordered, a persistent
  // set of failures would occupy the batch forever and a charge behind them
  // would never be retried at all — and would then be suspended by the pass
  // below, cutting an agent off without their card ever having been tried.
  //
  // Oldest first means the queue advances. Anything not reached is counted and
  // reported rather than left to look like success.
  const { data: failed } = await supabase
    .from('team_seat_charges')
    .select('id, team_id, owner_id, agent_id, team_member_id, amount_cents, period_end')
    .eq('status', 'failed')
    .not('team_member_id', 'is', null)
    .gte('period_end', windowStart)
    .order('period_end', { ascending: true })
    .limit(PAGE_SIZE)

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
    if (outOfTime()) {
      summary.notReached = rows.length - (summary.attempted + summary.voidedSelfFunded)
      console.warn(
        `[seat-enforcement] retry budget spent; ${summary.notReached} charge(s) not reached this run`
      )
      break
    }
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


/**
 * Re-evaluate every owner who has live seat charges.
 *
 * Scoped to owners with real seat subscriptions rather than every account —
 * somebody who has never opened a seat has nothing to reconcile, and walking
 * the whole user table daily to discover that would be work with no possible
 * result.
 */
async function reconcileDiscounts(outOfTime: () => boolean): Promise<{
  owners: number; updated: number; failed: number; notReached: number
}> {
  const out = { owners: 0, updated: 0, failed: 0, notReached: 0 }

  // Pages rather than taking the first 500 charges: the goal is the DISTINCT
  // owners behind them, and a single large owner could otherwise fill the batch
  // with their own charges and hide every other owner from the reconcile.
  const ownerIds = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    if (outOfTime()) break
    const { data: rows, error } = await supabase
      .from('team_seat_charges')
      .select('owner_id')
      .eq('status', 'paid')
      .not('stripe_subscription_item_id', 'is', null)
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('[seat-enforcement] discount owner scan failed:', error.message)
      break
    }
    const page = rows || []
    for (const r of page) if (r.owner_id) ownerIds.add(r.owner_id)
    if (page.length < PAGE_SIZE) break
  }

  const owners = Array.from(ownerIds)
  for (const ownerId of owners) {
    if (outOfTime()) {
      out.notReached = owners.length - out.owners
      console.warn(`[seat-enforcement] discount budget spent; ${out.notReached} owner(s) not reached`)
      break
    }
    out.owners++
    try {
      const r = await syncOwnerSeatDiscounts(ownerId)
      out.updated += r.updated
      out.failed += r.failed
    } catch (err: any) {
      out.failed++
      console.error(`[seat-enforcement] discount sync failed for ${ownerId}: ${err?.message || err}`)
    }
  }
  return out
}
