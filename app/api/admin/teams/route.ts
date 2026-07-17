import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })

    const [
      { data: teams },
      { data: allMembers },
      { data: allSeatCharges },
      { data: allCampaigns },
      { data: allCodes },
      { data: allSubs },
    ] = await Promise.all([
      supabaseAdmin.from('teams').select('id, name, description, owner_id, tenant_id, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('team_members').select('id, team_id, user_id, status, accepted_at, removed_at').in('status', ['active', 'pending', 'removed']),
      supabaseAdmin.from('team_seat_charges').select('id, team_id, owner_id, agent_id, amount_cents, status, period_start, period_end, stripe_subscription_id'),
      supabaseAdmin.from('team_campaigns').select('team_id, campaign_id, access_mode'),
      supabaseAdmin.from('team_codes').select('team_id, code'),
      supabaseAdmin.from('subscriptions').select('user_id, discount_coupon'),
    ])

    const couponedUsers = new Set<string>(
      (allSubs || [])
        .filter((s: any) => s.discount_coupon)
        .map((s: any) => s.user_id)
    )

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

    const tenantIds = Array.from(new Set((teams || []).map((t: any) => t.tenant_id).filter(Boolean)))
    const tenantById: Record<string, { slug: string }> = {}
    if (tenantIds.length > 0) {
      const { data: tenantRows } = await supabaseAdmin
        .from('white_label_tenants')
        .select('id, slug')
        .in('id', tenantIds)
      for (const tn of tenantRows || []) {
        tenantById[tn.id] = { slug: tn.slug }
      }
    }

    const CALLS_WINDOW_DAYS = 30
    const callsSince = new Date(Date.now() - CALLS_WINDOW_DAYS * 86400000).toISOString()
    const callCountByUser: Record<string, number> = {}
    if (allClerkIds.length > 0) {
      const { data: recentCalls } = await supabaseAdmin
        .from('calls')
        .select('user_id')
        .in('user_id', allClerkIds)
        .gte('created_at', callsSince)
        .limit(50000)
      for (const c of recentCalls || []) {
        callCountByUser[c.user_id] = (callCountByUser[c.user_id] || 0) + 1
      }
    }

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

    const codeMap: Record<string, string> = {}
    for (const c of allCodes || []) {
      if (!codeMap[c.team_id]) codeMap[c.team_id] = c.code
    }

    const platformTotals = {
      teams: teams?.length || 0,
      activeSeats: 0,
      pendingSeats: 0,
      mrr_cents: 0,
      wrr_cents: 0,
    }

    const enriched = (teams || []).map((t: any) => {
      const members = teamMap[t.id] || []
      const seats = seatMap[t.id] || []
      const campaigns = campMap[t.id] || []
      const code = codeMap[t.id] || null

      const activeMemberCount = members.filter((m: any) => m.status === 'active').length
      const pendingMemberCount = members.filter((m: any) => m.status === 'pending').length

      const activeSeats = seats.filter((s: any) => s.status === 'paid').length
      const pendingSeatsCount = seats.filter((s: any) => s.status === 'pending').length
      const failedSeats = seats.filter((s: any) => s.status === 'failed').length
      const voidedSeats = seats.filter((s: any) => s.status === 'voided').length

      const wrr_cents = activeSeats * 3500
      const mrr_cents = Math.round(wrr_cents * 4.33)

      const ownerHasCoupon = couponedUsers.has(t.owner_id)

      const teamUserIds = Array.from(new Set([t.owner_id, ...members.filter((m: any) => m.status === 'active').map((m: any) => m.user_id)]))
      const calls30d = teamUserIds.reduce((sum, uid) => sum + (callCountByUser[uid] || 0), 0)

      const tenantSlug = t.tenant_id ? (tenantById[t.tenant_id]?.slug ?? null) : null
      const status: 'active' | 'inactive' = (calls30d > 0 || activeSeats > 0) ? 'active' : 'inactive'

      platformTotals.activeSeats += activeSeats
      platformTotals.pendingSeats += pendingSeatsCount
      if (!ownerHasCoupon) {
        platformTotals.wrr_cents += wrr_cents
        platformTotals.mrr_cents += mrr_cents
      }

      const ownerInfo = userById[t.owner_id]
      const ownerName = ownerInfo
        ? [ownerInfo.first_name, ownerInfo.last_name].filter(Boolean).join(' ').trim() || ownerInfo.email
        : t.owner_id.slice(0, 12)

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.created_at,
        joinCode: code,
        ownerHasCoupon,
        tenantSlug,
        calls30d,
        status,
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

    enriched.sort((a, b) => b.wrr_cents - a.wrr_cents || b.memberCount - a.memberCount)

    return NextResponse.json({
      success: true,
      teams: enriched,
      platformTotals,
    })
  } catch (error: any) {
    console.error('Admin teams error:', error)
    return apiError(error, { route: 'admin/teams' })
  }
}