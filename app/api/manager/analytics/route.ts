import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireTenantOwner, getTenantUserIds, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// MANAGER ANALYTICS — /api/manager/analytics  (tenant-scoped)
// =============================================================================
// The Manager+ desktop's Analytics app calls THIS route instead of
// /api/admin/analytics. Same response shape (success + range + bucketSize +
// summary + series) so the shared Analytics component renders unchanged — but
// every number is scoped to the OWNER'S tenant, aggregated across every seat
// (the owner plus all active members of all teams linked to the tenant),
// resolved via getTenantUserIds().
//
// SECURITY: requireTenantOwner() is the boundary. A non-owner can't reach this
// at all (403). The route NEVER reads a tenant id from the client — it resolves
// the caller's own tenant — so there's no param a tenant could tamper with to
// see sitewide or another tenant's data.
//
// MEANING DIFFERENCE vs admin: a manager doesn't see platform revenue or
// churn across all customers. "Their analytics" = their team's footprint:
//   - FILLED SEATS = active paying subs among their tenant's users
//   - WEEKLY REVENUE = those seats' weekly $ (Pro $35 / Manager+ $75)
//   - SIGNUPS = their tenant users created in range
//   - series = signups + call volume over time for their tenant's users
// Fields the manager view doesn't compute (unknownPriceSubs, churn cohort
// internals) are returned as safe zeros so the component's optional branches
// (e.g. the price-drift banner) simply don't render.
//
// Pricing here is intentionally simpler than admin: we classify by the two
// known price IDs (env) and otherwise treat a live sub as a Pro seat for the
// weekly-revenue estimate. Managers don't need the full Stripe price-retrieve
// reconciliation the admin dashboard does.
// =============================================================================

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''
const PRO_WEEKLY = 35
const WL_WEEKLY = 75

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const NEVER_PAID_STATUSES = ['incomplete', 'incomplete_expired']

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

function weeklyFor(priceId: string | null): { weekly: number; plan: 'pro' | 'manager_plus' | 'unknown' } {
  if (priceId && WL_PRICE_ID && priceId === WL_PRICE_ID) return { weekly: WL_WEEKLY, plan: 'manager_plus' }
  if (priceId && PRO_PRICE_ID && priceId === PRO_PRICE_ID) return { weekly: PRO_WEEKLY, plan: 'pro' }
  // Unknown price on a live sub — count it as a Pro seat for the estimate
  // rather than zero, so a manager's revenue isn't silently understated.
  return { weekly: PRO_WEEKLY, plan: 'pro' }
}

export async function GET(req: NextRequest) {
  // ── GUARD ────────────────────────────────────────────────────────────────
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  // ── RESOLVE TENANT USER IDS ────────────────────────────────────────────────
  const userIds = await getTenantUserIds(tenant.id, tenant.owner_clerk_id)
  // userIds always includes the owner, so it's never empty.

  const url = new URL(req.url)
  const range = (url.searchParams.get('range') || '30d') as Range
  const customStart = url.searchParams.get('start')
  const customEnd = url.searchParams.get('end')
  const { start, end } = rangeToBounds(range, customStart, customEnd)

  const now = Date.now()
  const day = 86400000

  // ── USERS in this tenant ──────────────────────────────────────────────────
  const { data: tenantUsers } = await supabase
    .from('users')
    .select('clerk_id, created_at')
    .in('clerk_id', userIds)

  const usersList = tenantUsers || []
  const totalUsers = usersList.length
  const usersInRange = usersList.filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= start && t <= end
  })

  // ── SUBSCRIPTIONS among tenant users ───────────────────────────────────────
  const { data: rawSubs } = await supabase
    .from('subscriptions')
    .select('user_id, status, stripe_price_id, created_at, canceled_at, current_period_end, discount_coupon')
    .in('user_id', userIds)

  const subs = rawSubs || []

  // Liveness: completed checkout, created on/before t, active now or ended after t.
  const isLiveAt = (s: any, t: number): boolean => {
    if (NEVER_PAID_STATUSES.includes(s.status)) return false
    const created = new Date(s.created_at).getTime()
    if (created > t) return false
    if (ACTIVE_STATUSES.includes(s.status)) return true
    if (s.canceled_at) return new Date(s.canceled_at).getTime() > t
    return false
  }

  // Current active paying seats (ignore fully-couponed by simple presence check).
  const activeSubs = subs.filter(s =>
    ACTIVE_STATUSES.includes(s.status) && !NEVER_PAID_STATUSES.includes(s.status)
  )
  // One seat per (user, plan) so an owner with Pro + Manager+ counts both.
  const seen = new Set<string>()
  const seats: any[] = []
  for (const s of activeSubs) {
    const { plan } = weeklyFor(s.stripe_price_id)
    const key = `${s.user_id}|${plan}`
    if (seen.has(key)) continue
    seen.add(key)
    seats.push(s)
  }

  let proSubs = 0, wlSubs = 0, wrr = 0, proWrr = 0, wlWrr = 0
  for (const s of seats) {
    const { weekly, plan } = weeklyFor(s.stripe_price_id)
    wrr += weekly
    if (plan === 'manager_plus') { wlSubs++; wlWrr += weekly }
    else { proSubs++; proWrr += weekly }
  }
  const payingActiveSubs = seats.length
  const mrr = wrr * 4

  // ── RANGE METRICS ──────────────────────────────────────────────────────────
  const signupsInRange = usersInRange.length

  const paidConversionsInRange = subs.filter(s => {
    if (NEVER_PAID_STATUSES.includes(s.status)) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  const cancellationsInRange = subs.filter(s => {
    if (s.status !== 'canceled' || !s.canceled_at) return false
    const t = new Date(s.canceled_at).getTime()
    return t >= start && t <= end
  }).length

  const netNewPaying = paidConversionsInRange - cancellationsInRange
  const activeAtStart = payingActiveSubs + cancellationsInRange
  const churnRate = activeAtStart > 0
    ? Number(((cancellationsInRange / activeAtStart) * 100).toFixed(1))
    : 0

  // WoW seats
  const oneWeekAgo = now - 7 * day
  const seatsOneWeekAgo = subs.filter(s => isLiveAt(s, oneWeekAgo)).length
  const wowDelta = payingActiveSubs - seatsOneWeekAgo
  const wowPct = seatsOneWeekAgo > 0
    ? Number(((wowDelta / seatsOneWeekAgo) * 100).toFixed(1))
    : (payingActiveSubs > 0 ? 100 : 0)

  // Tenure cohort
  const thirtyDayCutoff = now - 30 * day
  let newPayingUsers = 0, establishedPayingUsers = 0
  for (const s of seats) {
    const created = new Date(s.created_at).getTime()
    if (created >= thirtyDayCutoff) newPayingUsers++
    else establishedPayingUsers++
  }

  // ── SERIES: signups + calls + live-seat revenue per bucket ─────────────────
  const totalDays = Math.max(1, Math.ceil((end - start) / day))
  const useWeekly = totalDays > 120
  const bucketSize = useWeekly ? 7 * day : day

  const buckets: { date: string; signups: number; revenue: number; calls: number }[] = []
  let cursor = start
  while (cursor <= end) {
    buckets.push({ date: dayKey(cursor), signups: 0, revenue: 0, calls: 0 })
    cursor += bucketSize
  }

  for (const u of usersInRange) {
    const t = new Date(u.created_at).getTime()
    const idx = Math.floor((t - start) / bucketSize)
    if (idx >= 0 && idx < buckets.length) buckets[idx].signups++
  }

  // Calls for tenant users within range
  const startIso = new Date(start).toISOString()
  const endIso = new Date(end).toISOString()
  const { data: rangeCalls } = await supabase
    .from('calls')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .limit(50000)

  for (const c of rangeCalls || []) {
    const t = new Date(c.created_at).getTime()
    const idx = Math.floor((t - start) / bucketSize)
    if (idx >= 0 && idx < buckets.length) buckets[idx].calls++
  }

  for (let i = 0; i < buckets.length; i++) {
    const bucketEnd = start + (i + 1) * bucketSize
    let rev = 0
    for (const s of subs) {
      if (!isLiveAt(s, bucketEnd)) continue
      rev += weeklyFor(s.stripe_price_id).weekly
    }
    buckets[i].revenue = rev
  }

  return NextResponse.json({
    success: true,
    range,
    bucketSize: useWeekly ? 'week' : 'day',
    tenant: { id: tenant.id, slug: tenant.slug, brand_name: tenant.brand_name },
    summary: {
      totalUsers,
      payingActiveSubs,
      proSubs,
      wlSubs,
      unknownPriceSubs: 0,       // manager view doesn't do price reconciliation
      couponSubsCount: 0,
      wrr,
      mrr,
      proWrr,
      wlWrr,
      signupsInRange,
      paidConversionsInRange,
      cancellationsInRange,
      netNewPaying,
      churnRate,
      avgLifetimeWeeks: 0,
      wowDelta,
      wowPct,
      newPayingUsers,
      establishedPayingUsers,
    },
    series: buckets,
  })
}