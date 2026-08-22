import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// ─────────────────────────────────────────────────────────────────────────
// COLLAPSING THE SEATS THAT WERE BILLED TWICE
//
// Until now a seat was billed per membership, so an owner with the same agent
// on three of their teams held three subscriptions for one person. The rule is
// now one seat per person per owner, but that only governs seats opened from
// here on — the ones already running keep running, and keep charging.
//
// This is the one-shot that brings them into line: for each owner-and-agent
// pair with more than one live seat, the OLDEST is kept and the rest are
// cancelled in Stripe and marked as covered by it.
//
// OLDEST, not newest. It is the one whose billing period is furthest along, so
// keeping it wastes the least of what has already been paid for, and its
// renewal date is the one the owner is used to seeing.
//
// DRY RUN UNLESS ASKED. Cancelling a live subscription is not something to
// discover you have done. Without ?apply=1 this reports exactly what it would
// cancel and changes nothing.
//
// Different owners are never collapsed together. Two owners each paying for
// the same agent is the intended arrangement — they are buying access to their
// own campaigns.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const apply = req.nextUrl.searchParams.get('apply') === '1'
    const onlyOwner = req.nextUrl.searchParams.get('owner') || null

    let q = supabaseAdmin
      .from('team_seat_charges')
      .select('id, owner_id, agent_id, team_id, team_member_id, stripe_subscription_item_id, created_at')
      .eq('status', 'paid')
      .not('team_member_id', 'is', null)
      .order('created_at', { ascending: true })
    if (onlyOwner) q = q.eq('owner_id', onlyOwner)

    const { data: charges, error } = await q
    if (error) throw error

    // Only seats behind a live membership count. A paid charge against a
    // membership that has ended is a separate problem and not this one's to
    // fix — collapsing onto it would keep the wrong seat.
    const memberIds = Array.from(new Set((charges || []).map(c => c.team_member_id)))
    const liveMembers = new Map<string, { teamId: string }>()
    if (memberIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('team_members')
        .select('id, team_id, status, seat_suspended_at')
        .in('id', memberIds)
      for (const m of members || []) {
        if (m.status === 'active' && !m.seat_suspended_at) {
          liveMembers.set(m.id, { teamId: m.team_id })
        }
      }
    }

    const byPair = new Map<string, typeof charges>()
    for (const c of charges || []) {
      if (!liveMembers.has(c.team_member_id)) continue
      const key = `${c.owner_id}:${c.agent_id}`
      const list = byPair.get(key) || []
      list.push(c)
      byPair.set(key, list as any)
    }

    const teamNames = new Map<string, string>()
    {
      const { data: teams } = await supabaseAdmin.from('teams').select('id, name')
      for (const t of teams || []) teamNames.set(t.id, t.name)
    }
    const emails = new Map<string, string>()
    {
      const agentIds = Array.from(new Set((charges || []).map(c => c.agent_id)))
      if (agentIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email')
          .in('clerk_id', agentIds)
        for (const u of users || []) emails.set(u.clerk_id, u.email)
      }
    }

    const plan: Array<{
      ownerId: string
      agent: string
      keepTeam: string
      keepChargeId: string
      keepMemberId: string
      collapse: Array<{ team: string; chargeId: string; subscription: string | null }>
    }> = []

    for (const [key, list] of byPair) {
      if (!list || list.length < 2) continue
      const [keep, ...rest] = list
      plan.push({
        ownerId: keep.owner_id,
        agent: emails.get(keep.agent_id) || keep.agent_id,
        keepTeam: teamNames.get(keep.team_id) || keep.team_id,
        keepChargeId: keep.id,
        keepMemberId: keep.team_member_id,
        collapse: rest.map(c => ({
          team: teamNames.get(c.team_id) || c.team_id,
          chargeId: c.id,
          subscription: c.stripe_subscription_item_id,
        })),
      })
    }

    const duplicateSeats = plan.reduce((n, p) => n + p.collapse.length, 0)

    if (!apply) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        pairs: plan.length,
        duplicateSeats,
        weeklySavingUsd: duplicateSeats * 35,
        plan,
        note: 'Nothing was changed. Re-run with ?apply=1 to cancel these and mark them covered.',
      })
    }

    const cancelled: string[] = []
    const failures: Array<{ chargeId: string; reason: string }> = []

    for (const p of plan) {
      for (const dup of p.collapse) {
        try {
          if (dup.subscription) await cancelSeatSubscription(dup.subscription)

          await supabaseAdmin
            .from('team_seat_charges')
            .update({
              status: 'voided',
              void_reason: 'Collapsed — one seat per person per owner',
            })
            .eq('id', dup.chargeId)

          const { data: charge } = await supabaseAdmin
            .from('team_seat_charges')
            .select('team_member_id')
            .eq('id', dup.chargeId)
            .maybeSingle()

          if (charge?.team_member_id) {
            await supabaseAdmin
              .from('team_members')
              .update({ billing_override: 'free', seat_covered_by: p.keepMemberId })
              .eq('id', charge.team_member_id)
          }

          cancelled.push(dup.chargeId)
        } catch (err: any) {
          failures.push({ chargeId: dup.chargeId, reason: err?.message || String(err) })
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      pairs: plan.length,
      cancelled: cancelled.length,
      failures,
      weeklySavingUsd: cancelled.length * 35,
    })
  } catch (error: any) {
    console.error('Consolidate seats error:', error)
    return apiError(error, { route: 'admin/consolidate-seats' })
  }
}
