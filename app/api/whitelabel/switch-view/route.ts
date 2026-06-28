// app/api/whitelabel/switch-view/route.ts
// =============================================================================
// SWITCH ACTIVE TENANT VIEW (v2 — normalize 'standard'/empty → null)
// =============================================================================
// POST /api/whitelabel/switch-view
// Body: { tenant_id: string | null }
//
//   tenant_id = uuid        → switch to that tenant's branded view
//                             (must be owner OR active team member)
//   tenant_id = null        → switch to standard DialerSeat view
//   tenant_id = 'standard'  → ALSO treated as standard view (v2)
//   tenant_id = '' / missing → ALSO treated as standard view (v2)
//
// v2 FIX: the settings <select> uses the literal value 'standard' for the
// DialerSeat Pro option. If the client posts { tenant_id: 'standard' } (or an
// empty string), the old route fell through to the specific-tenant branch,
// looked up a tenant whose id is 'standard', got tenant_not_found (404), and
// NEVER wrote anything — so active_tenant_id stayed pinned to the previous
// tenant and "switch to DialerSeat Pro" silently did nothing. We now normalize
// 'standard'/''/null/undefined to a single STANDARD sentinel up front, so the
// standard-view branch always runs regardless of which the client sends.
//
// On success, busts the user's cache tag so the next page render reflects the
// change immediately.
//
// SECURITY: the validation here is the ONLY guard against a user switching to
// a tenant they don't belong to. The middleware enforces SUBDOMAIN access;
// this enforces SELECTION access. Both layers needed.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { revalidateTag } from 'next/cache'
import { userCacheTag } from '@/lib/tenant'

const supabase = getServiceClient('whitelabel/switch-view')

const ACTIVE_SUB_STATUSES = ['active']

// Values that all mean "standard DialerSeat view" (active_tenant_id = null).
// The settings <select> uses 'standard' as the option value; older/other
// callers may send null or omit the field.
function isStandardSelection(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === 'standard'
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 })
  }

  const rawTarget = body?.tenant_id

  // ── BRANCH: switching to standard view ─────────────────────────────────
  // v2: normalize 'standard'/''/null/undefined all to this branch.
  if (isStandardSelection(rawTarget)) {
    // Must have self-sub OR own a tenant
    const [ownedRes, subsRes] = await Promise.all([
      supabase
        .from('white_label_tenants')
        .select('id')
        .eq('owner_clerk_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId),
    ])

    const ownsTenant = !!ownedRes.data
    const now = Date.now()
    const hasSelfSub = (subsRes.data || []).some(s => {
      if (ACTIVE_SUB_STATUSES.includes(s.status)) return true
      if (s.status === 'canceled' && s.current_period_end &&
          new Date(s.current_period_end).getTime() > now) return true
      return false
    })

    if (!ownsTenant && !hasSelfSub) {
      return NextResponse.json(
        {
          error: 'no_standard_access',
          detail: 'Pro view requires your own subscription. ' +
                  'Subscribe at /billing or contact your team owner.',
        },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('users')
      .update({ active_tenant_id: null })
      .eq('clerk_id', userId)

    if (error) {
      console.error('switch-view (null) failed:', error)
      return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
    }

    // Next.js 16: revalidateTag(tag, { expire: 0 }) for immediate expiry —
    // the user clicking "switch view" expects the new brand on the NEXT page
    // load, not after a stale-while-revalidate window.
    revalidateTag(userCacheTag(userId), { expire: 0 })
    return NextResponse.json({ success: true, tenant_id: null })
  }

  // ── BRANCH: switching to a specific tenant ─────────────────────────────
  // At this point rawTarget is a non-empty, non-'standard' string. Anything
  // that isn't a string here is invalid.
  const targetId = rawTarget
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return NextResponse.json({ error: 'invalid_tenant_id' }, { status: 400 })
  }

  // Verify the tenant exists and is active
  const { data: tenant } = await supabase
    .from('white_label_tenants')
    .select('id, owner_clerk_id, status, is_active')
    .eq('id', targetId)
    .maybeSingle()

  if (!tenant || tenant.status !== 'active' || !tenant.is_active) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })
  }

  // Verify the user has access: owner OR active team member of owner's team
  let hasAccess = tenant.owner_clerk_id === userId

  if (!hasAccess) {
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('team_id, teams!inner(owner_id)')
      .eq('user_id', userId)
      .eq('status', 'active')

    hasAccess = (memberRows || []).some(
      (r: any) => r.teams?.owner_id === tenant.owner_clerk_id
    )
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'You are not a member of this tenant.' },
      { status: 403 }
    )
  }

  const { error: updErr } = await supabase
    .from('users')
    .update({ active_tenant_id: targetId })
    .eq('clerk_id', userId)

  if (updErr) {
    console.error('switch-view failed:', updErr)
    return NextResponse.json({ error: 'db_error', detail: updErr.message }, { status: 500 })
  }

  revalidateTag(userCacheTag(userId), { expire: 0 })
  return NextResponse.json({ success: true, tenant_id: targetId })
}