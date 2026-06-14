import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireTenantOwner, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// MANAGER TEAMS — /api/manager/teams  (tenant-scoped)
// =============================================================================
// The Manager+ desktop Teams app calls this instead of /api/admin/teams. SAME
// response shape (success + teams[] + platformTotals) so the shared Teams
// component renders unchanged — but it returns ONLY the teams linked to the
// caller's tenant (teams.tenant_id = their tenant), with members + seat charges
// + join codes for each.
//
// SECURITY: requireTenantOwner() is the boundary. We only ever select teams
// WHERE tenant_id = the caller's own tenant, so a manager can never see another
// tenant's teams or platform-wide data. No tenant id is taken from the client.
//
// NOTE: "platformTotals" keeps its name for component compatibility but here it
// means "this tenant's totals". Delete is intentionally NOT exposed to managers
// in this route — the Teams app's delete button calls /api/admin/teams/delete,
// which is admin-only; on the manager desktop that button should be hidden
// (handled in the app via role).
// =============================================================================

export async function GET() {
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  // Teams linked to this tenant only.
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, description, owner_id, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const teamList = teams || []
  const teamIds = teamList.map(t => t.id)

  if (teamIds.length === 0) {
    return NextResponse.json({
      success: true,
      teams: [],
      platformTotals: { teams: 0, activeSeats: 0, pendingSeats: 0, mrr_cents: 0, wrr_cents: 0 },
    })
  }

  const [
    { data: allMembers },
    { data: allSeatCharges },
    { data: allCampaigns },
    { data: allCodes },
    { data: allSubs },
  ] = await Promise.all([
    supabase.from('team_members').select('id, team_id, user_id, status, accepted_at, removed_at').in('team_id', teamIds),
    supabase.from('team_seat_charges').select('id, team_id, owner_id, agent_id, amount_cents, status, period_start, period_end, stripe_subscription_id').in('team_id', teamIds),
    supabase.from('team_campaigns').select('team_id, campaign_id, access_mode').in('team_id', teamIds),
    supabase.from('team_codes').select('team_id, code').in('team_id', teamIds),
    supabase.from('subscriptions').select('user_id, discount_coupon'),
  ])

  const couponedUsers = new Set<string>(
    (allSubs || []).filter((s: any) => s.discount_coupon).map((s: any) => s.user_id)
  )

  const ownerIds = Array.from(new Set(teamList.map(t => t.owner_id)))
  const memberClerkIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)))
  const seatAgentIds = Array.from(new Set((allSeatCharges || []).map((s: any) => s.agent_id)))
  const allClerkIds = Array.from(new Set([...ownerIds, ...memberClerkIds, ...seatAgentIds]))

  const userById: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
  if (allClerkIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('clerk_id, email, first_name, last_name')
      .in('clerk_id', allClerkIds)
    for (const u of userRows || []) {
      userById[u.clerk_id] = { email: u.email, first_name: u.first_name, last_name: u.last_name }
    }
  }

  const teamMap: Record<string, any[]> = {}
  for (const m of allMembers || []) { (teamMap[m.team_id] ||= []).push(m) }
  const seatMap: Record<string, any[]> = {}
  for (const s of allSeatCharges || []) { (seatMap[s.team_id] ||= []).push(s) }
  const campMap: Record<string, any[]> = {}
  for (const tc of allCampaigns || []) { (campMap[tc.team_id] ||= []).push(tc) }
  const codeMap: Record<string, string> = {}
  for (const c of allCodes || []) { if (!codeMap[c.team_id]) codeMap[c.team_id] = c.code }

  const platformTotals = { teams: teamList.length, activeSeats: 0, pendingSeats: 0, mrr_cents: 0, wrr_cents: 0 }

  const enriched = teamList.map((t: any) => {
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

    platformTotals.activeSeats += activeSeats
    platformTotals.pendingSeats += pendingSeatsCount
    if (!ownerHasCoupon) { platformTotals.wrr_cents += wrr_cents; platformTotals.mrr_cents += mrr_cents }

    const ownerInfo = userById[t.owner_id]
    const ownerName = ownerInfo
      ? [ownerInfo.first_name, ownerInfo.last_name].filter(Boolean).join(' ').trim() || ownerInfo.email
      : t.owner_id.slice(0, 12)

    return {
      id: t.id, name: t.name, description: t.description, createdAt: t.created_at,
      joinCode: code, ownerHasCoupon,
      owner: { id: t.owner_id, name: ownerName, email: ownerInfo?.email || null },
      memberCount: activeMemberCount, pendingMemberCount,
      activeSeats, pendingSeats: pendingSeatsCount, failedSeats, voidedSeats,
      campaignCount: campaigns.length, wrr_cents, mrr_cents,
      members: members.map((m: any) => {
        const u = userById[m.user_id]
        const name = u ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email : m.user_id.slice(0, 12)
        return { id: m.id, userId: m.user_id, name, email: u?.email || null, status: m.status, acceptedAt: m.accepted_at, removedAt: m.removed_at }
      }),
      seats: seats.map((s: any) => {
        const u = userById[s.agent_id]
        const agentName = u ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email : s.agent_id.slice(0, 12)
        return { id: s.id, agentId: s.agent_id, agentName, agentEmail: u?.email || null, amountCents: s.amount_cents, status: s.status, periodStart: s.period_start, periodEnd: s.period_end, stripeSubscriptionId: s.stripe_subscription_id }
      }),
    }
  })

  enriched.sort((a, b) => b.wrr_cents - a.wrr_cents || b.memberCount - a.memberCount)

  return NextResponse.json({ success: true, teams: enriched, platformTotals })
}