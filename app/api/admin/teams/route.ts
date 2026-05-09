import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Admin-only: aggregated overview of every team on DialerSeat.
 * Returns one row per team with owner, member count, active seats, MRR, churn.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // requireAdmin guard
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!u?.is_admin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Pull everything in parallel
    const [
      { data: teams },
      { data: allMembers },
      { data: allSeatCharges },
      { data: allCampaigns },
    ] = await Promise.all([
      supabaseAdmin.from('teams').select('id, name, description, owner_id, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('team_members').select('id, team_id, user_id, status, accepted_at, removed_at').in('status', ['active', 'pending', 'removed']),
      supabaseAdmin.from('team_seat_charges').select('id, team_id, owner_id, agent_id, amount_cents, status, period_start, period_end, stripe_subscription_id'),
      supabaseAdmin.from('team_campaigns').select('team_id, campaign_id, access_mode'),
    ])

    // Resolve owner identities
    const ownerIds = Array.from(new Set((teams || []).map((t: any) => t.owner_id)))
    const memberClerkIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)))
    const allClerkIds = Array.from(new Set([...ownerIds, ...memberClerkIds]))

    const userById: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
    if (allClerkIds.length > 0) {
      const { data: userRows } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', allClerkIds)
      for (const u of userRows || []) {
        userById[u.clerk_id] = {
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
        }
      }
    }

    // Group by team
    const teamMap: Record<string, any[]> = {}
    for (const m of allMembers || []) {
      if (!teamMap[m.team_id]) teamMap[m.team_id] = []
      teamMap[m.team_id].push(m)
    }

    const seatMap: Record<string, any[]> = {}
    for (const s of allSeatCharges || []) {
      if (!seatMap[s.team_id]) seatMap[s.team_id] = []
      seatMap[s.team_id].push(s)
    }

    const campMap: Record<string, any[]> = {}
    for (const tc of allCampaigns || []) {
      if (!campMap[tc.team_id]) campMap[tc.team_id] = []
      campMap[tc.team_id].push(tc)
    }

    const platformTotals = {
      teams: teams?.length || 0,
      activeSeats: 0,
      pendingSeats: 0,
      mrr_cents: 0, // weekly × 4.33
      wrr_cents: 0,
    }

    const enriched = (teams || []).map((t: any) => {
      const members = teamMap[t.id] || []
      const seats = seatMap[t.id] || []
      const campaigns = campMap[t.id] || []

      const activeMemberCount = members.filter((m: any) => m.status === 'active').length
      const pendingMemberCount = members.filter((m: any) => m.status === 'pending').length

      const activeSeats = seats.filter((s: any) => s.status === 'paid').length
      const pendingSeatsCount = seats.filter((s: any) => s.status === 'pending').length
      const failedSeats = seats.filter((s: any) => s.status === 'failed').length
      const voidedSeats = seats.filter((s: any) => s.status === 'voided').length

      const wrr_cents = activeSeats * 3500
      const mrr_cents = Math.round(wrr_cents * 4.33)

      platformTotals.activeSeats += activeSeats
      platformTotals.pendingSeats += pendingSeatsCount
      platformTotals.wrr_cents += wrr_cents
      platformTotals.mrr_cents += mrr_cents

      const ownerInfo = userById[t.owner_id]
      const ownerName = ownerInfo
        ? [ownerInfo.first_name, ownerInfo.last_name].filter(Boolean).join(' ').trim() || ownerInfo.email
        : t.owner_id.slice(0, 12)

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.created_at,
        owner: {
          id: t.owner_id,
          name: ownerName,
          email: ownerInfo?.email || null,
        },
        memberCount: activeMemberCount,
        pendingMemberCount,
        activeSeats,
        pendingSeats: pendingSeatsCount,
        failedSeats,
        voidedSeats,
        campaignCount: campaigns.length,
        wrr_cents,
        mrr_cents,
        members: members.map((m: any) => {
          const u = userById[m.user_id]
          const name = u
            ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email
            : m.user_id.slice(0, 12)
          return {
            id: m.id,
            userId: m.user_id,
            name,
            email: u?.email || null,
            status: m.status,
            acceptedAt: m.accepted_at,
            removedAt: m.removed_at,
          }
        }),
        seats: seats.map((s: any) => {
          const u = userById[s.agent_id]
          const agentName = u
            ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email
            : s.agent_id.slice(0, 12)
          return {
            id: s.id,
            agentId: s.agent_id,
            agentName,
            agentEmail: u?.email || null,
            amountCents: s.amount_cents,
            status: s.status,
            periodStart: s.period_start,
            periodEnd: s.period_end,
            stripeSubscriptionId: s.stripe_subscription_id,
          }
        }),
      }
    })

    // Default sort: by WRR descending, then by member count descending
    enriched.sort((a, b) => b.wrr_cents - a.wrr_cents || b.memberCount - a.memberCount)

    return NextResponse.json({
      success: true,
      teams: enriched,
      platformTotals,
    })
  } catch (error: any) {
    console.error('Admin teams error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}