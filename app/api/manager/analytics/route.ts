import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireTenantOwner, getTenantUserIds, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = getServiceClient('manager/analytics')

// =============================================================================
// MANAGER ANALYTICS — /api/manager/analytics  (tenant-scoped, performance)
// =============================================================================
// REBUILT (this revision): no longer income/revenue. The manager Analytics is
// now CAMPAIGN PERFORMANCE + TEAMS + USERS + STATUS, scoped to the owner's
// tenant (owner + all active members of all teams linked to the tenant, via
// getTenantUserIds()).
//
// Returns four sections the app renders as tabs/blocks:
//   summary    — headline counts (campaigns, active campaigns, calls in range,
//                connect rate, team members, active members)
//   campaigns  — per-campaign: name, status, leads, called, calls-in-range,
//                connect rate, top dispositions
//   teams      — per-team: name, member counts, calls-in-range, seats
//   users      — per-user: name, role, calls-in-range, last activity, status
//   series     — calls per day/week bucket over the range
//
// SECURITY: requireTenantOwner() is the boundary; the route resolves the
// caller's own tenant and never takes a tenant id from the client.
//
// "Connect rate" = share of calls whose disposition indicates a live human
// connect (not voicemail / no-answer / busy / failed / abandoned). Disposition
// vocab varies, so we classify by a keyword test and treat anything not clearly
// a non-connect as a connect, which is the conventional sales-floor read.
// =============================================================================

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'

function rangeToBounds(range: Range, customStart: string | null, customEnd: string | null) {
  const now = Date.now()
  const day = 86400000
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() }
  }
  if (range === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: now }
  }
  if (range === '30d') {
    const d = new Date(now)
    const s = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    return { start: s.getTime(), end: now }
  }
  if (range === '90d') return { start: now - 90 * day, end: now }
  if (range === '1y')  return { start: now - 365 * day, end: now }
  if (range === 'all') return { start: 0, end: now }
  return { start: now - 30 * day, end: now }
}

function dayKey(ms: number) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// A disposition counts as a NON-connect if it clearly indicates the call never
// reached a live person. Everything else is treated as a connect.
const NON_CONNECT_RE = /(voicemail|vm|no.?answer|noanswer|busy|fail|abandon|disconnect|machine|unreachable|dead|drop)/i
function isConnect(disposition: string | null): boolean {
  if (!disposition) return false           // null disposition = not a clean connect
  if (NON_CONNECT_RE.test(disposition)) return false
  return true
}

export async function GET(req: NextRequest) {
  // ── GUARD ──────────────────────────────────────────────────────────────
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  const userIds = await getTenantUserIds(tenant.id, tenant.owner_clerk_id)

  const url = new URL(req.url)
  const range = (url.searchParams.get('range') || '30d') as Range
  const customStart = url.searchParams.get('start')
  const customEnd = url.searchParams.get('end')
  const { start, end } = rangeToBounds(range, customStart, customEnd)
  const startIso = new Date(start).toISOString()
  const endIso = new Date(end).toISOString()

  const now = Date.now()
  const day = 86400000

  // ── USERS in tenant ──────────────────────────────────────────────────────
  const { data: tenantUsers } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, last_seen_at, created_at')
    .in('clerk_id', userIds)
  const usersList = tenantUsers || []
  const nameFor = (clerkId: string) => {
    const u = usersList.find(x => x.clerk_id === clerkId)
    if (!u) return clerkId.slice(0, 12)
    return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || clerkId.slice(0, 12)
  }

  // ── TEAMS linked to this tenant ──────────────────────────────────────────
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, owner_id, created_at')
    .eq('tenant_id', tenant.id)
  const teamList = teams || []
  const teamIds = teamList.map(t => t.id)

  // Members of those teams
  const { data: membersRaw } = teamIds.length
    ? await supabase
        .from('team_members')
        .select('team_id, user_id, status')
        .in('team_id', teamIds)
    : { data: [] as any[] }
  const members = membersRaw || []

  // Active paid seats per team
  const { data: seatsRaw } = teamIds.length
    ? await supabase
        .from('team_seat_charges')
        .select('team_id, status')
        .in('team_id', teamIds)
    : { data: [] as any[] }
  const seats = seatsRaw || []

  // ── CAMPAIGNS owned by tenant users ──────────────────────────────────────
  const { data: campaignsRaw } = await supabase
    .from('campaigns')
    .select('id, user_id, name, status, total_leads, called_leads, dialer_mode, created_at')
    .in('user_id', userIds)
  const campaigns = campaignsRaw || []

  // ── CALLS in range for tenant users ──────────────────────────────────────
  const { data: callsRaw } = await supabase
    .from('calls')
    .select('user_id, campaign_id, team_id, disposition, created_at')
    .in('user_id', userIds)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .limit(100000)
  const calls = callsRaw || []

  // ── AGGREGATE: per-campaign ──────────────────────────────────────────────
  const callsByCampaign = new Map<string, { total: number; connects: number; disp: Map<string, number> }>()
  for (const c of calls) {
    if (!c.campaign_id) continue
    let agg = callsByCampaign.get(c.campaign_id)
    if (!agg) { agg = { total: 0, connects: 0, disp: new Map() }; callsByCampaign.set(c.campaign_id, agg) }
    agg.total++
    if (isConnect(c.disposition)) agg.connects++
    const key = (c.disposition || 'none').toLowerCase()
    agg.disp.set(key, (agg.disp.get(key) || 0) + 1)
  }

  const campaignRows = campaigns.map(cm => {
    const agg = callsByCampaign.get(cm.id)
    const callsInRange = agg?.total || 0
    const connects = agg?.connects || 0
    const connectRate = callsInRange > 0 ? Number(((connects / callsInRange) * 100).toFixed(1)) : 0
    const topDispositions = agg
      ? Array.from(agg.disp.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([disposition, count]) => ({ disposition, count }))
      : []
    return {
      id: cm.id,
      name: cm.name || '(untitled)',
      status: cm.status || 'unknown',
      ownerName: nameFor(cm.user_id),
      totalLeads: cm.total_leads || 0,
      calledLeads: cm.called_leads || 0,
      dialerMode: cm.dialer_mode || null,
      callsInRange,
      connects,
      connectRate,
      topDispositions,
    }
  }).sort((a, b) => b.callsInRange - a.callsInRange)

  // ── AGGREGATE: per-team ──────────────────────────────────────────────────
  const callsByTeam = new Map<string, number>()
  for (const c of calls) {
    if (!c.team_id) continue
    callsByTeam.set(c.team_id, (callsByTeam.get(c.team_id) || 0) + 1)
  }
  const teamRows = teamList.map(t => {
    const tMembers = members.filter(m => m.team_id === t.id)
    const activeMembers = tMembers.filter(m => m.status === 'active').length
    const tSeats = seats.filter(s => s.team_id === t.id)
    const activeSeats = tSeats.filter(s => s.status === 'paid').length
    return {
      id: t.id,
      name: t.name,
      ownerName: nameFor(t.owner_id),
      memberCount: tMembers.length,
      activeMembers,
      activeSeats,
      callsInRange: callsByTeam.get(t.id) || 0,
    }
  }).sort((a, b) => b.callsInRange - a.callsInRange)

  // ── AGGREGATE: per-user ──────────────────────────────────────────────────
  const callsByUser = new Map<string, number>()
  for (const c of calls) {
    callsByUser.set(c.user_id, (callsByUser.get(c.user_id) || 0) + 1)
  }
  const activeCutoff = now - 14 * day
  const userRows = usersList.map(u => {
    const lastSeen = u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0
    const isOwner = u.clerk_id === tenant.owner_clerk_id
    return {
      clerkId: u.clerk_id,
      name: nameFor(u.clerk_id),
      email: u.email || null,
      role: isOwner ? 'owner' : 'member',
      callsInRange: callsByUser.get(u.clerk_id) || 0,
      lastSeenAt: u.last_seen_at || null,
      status: lastSeen >= activeCutoff ? 'active' : 'idle',
    }
  }).sort((a, b) => b.callsInRange - a.callsInRange)

  // ── SERIES: calls per bucket ─────────────────────────────────────────────
  const totalDays = Math.max(1, Math.ceil((end - start) / day))
  const useWeekly = totalDays > 120
  const bucketSize = useWeekly ? 7 * day : day
  const buckets: { date: string; calls: number; connects: number }[] = []
  let cursor = start
  while (cursor <= end) {
    buckets.push({ date: dayKey(cursor), calls: 0, connects: 0 })
    cursor += bucketSize
  }
  for (const c of calls) {
    const t = new Date(c.created_at).getTime()
    const idx = Math.floor((t - start) / bucketSize)
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].calls++
      if (isConnect(c.disposition)) buckets[idx].connects++
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  const totalCalls = calls.length
  const totalConnects = calls.filter(c => isConnect(c.disposition)).length
  const overallConnectRate = totalCalls > 0 ? Number(((totalConnects / totalCalls) * 100).toFixed(1)) : 0
  const activeCampaigns = campaigns.filter(c => (c.status || '').toLowerCase() === 'active').length
  const activeMemberTotal = members.filter(m => m.status === 'active').length

  return NextResponse.json({
    success: true,
    range,
    bucketSize: useWeekly ? 'week' : 'day',
    tenant: { id: tenant.id, slug: tenant.slug, brand_name: tenant.brand_name },
    summary: {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      callsInRange: totalCalls,
      connectsInRange: totalConnects,
      connectRate: overallConnectRate,
      teamCount: teamList.length,
      memberCount: members.length,
      activeMembers: activeMemberTotal,
      userCount: usersList.length,
    },
    campaigns: campaignRows,
    teams: teamRows,
    users: userRows,
    series: buckets,
  })
}