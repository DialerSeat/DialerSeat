import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { revalidateTag } from 'next/cache'
import { userCacheTag } from '@/lib/tenant'

const supabase = getServiceClient('whitelabel/switch-view')

const ACTIVE_SUB_STATUSES = ['active']

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

  if (isStandardSelection(rawTarget)) {

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

    revalidateTag(userCacheTag(userId), { expire: 0 })
    return NextResponse.json({ success: true, tenant_id: null })
  }

  const targetId = rawTarget
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return NextResponse.json({ error: 'invalid_tenant_id' }, { status: 400 })
  }

  const { data: tenant } = await supabase
    .from('white_label_tenants')
    .select('id, owner_clerk_id, status, is_active')
    .eq('id', targetId)
    .maybeSingle()

  if (!tenant || tenant.status !== 'active' || !tenant.is_active) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })
  }

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