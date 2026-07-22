import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/recordings/list')

const PAGE_SIZE = 50

// Admin-wide equivalent of app/api/recordings/list/route.ts — same query
// shape, but not scoped to the caller's own userId (that route is
// deliberately locked to the authenticated user's own calls; this one is
// for the Data Explorer app's new Recordings tab, which needs to see
// every user's recordings). Optional ?user_id= filters to one specific
// person, matching how Explorer's other tabs (campaigns, leads) already
// drill down from a selected user.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id') || 'all'
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const amdResult = searchParams.get('amd_result') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  let query = supabase
    .from('calls')
    .select('*, leads(first_name, last_name, phone, notes), campaigns(name)', { count: 'exact' })
    .not('recording_url', 'is', null)

  if (userId !== 'all') {
    query = query.eq('user_id', userId)
  }
  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }
  if (disposition !== 'all') {
    query = query.eq('disposition', disposition)
  }
  if (amdResult !== 'all') {
    // Explicit opt-in filter only — the base query above intentionally
    // does NOT filter by amd_result by default. It used to (amd_result.is
    // .null OR amd_result.eq.human), which silently hid every recording
    // with amd_result 'unknown', 'machine_end_beep', or 'machine_start' —
    // confirmed via direct query against production that this was
    // excluding roughly a quarter of all real recordings that exist,
    // with no indication to the admin that anything was missing. This tab
    // is supposed to show every user's recordings; filtering out
    // machine-detected calls is a legitimate thing an admin might want,
    // but it has to be a visible choice they make, not something baked
    // silently into the query.
    query = amdResult === 'none'
      ? query.is('amd_result', null)
      : query.eq('amd_result', amdResult)
  }
  if (search) {
    // Matches the phone number on the call itself — searching across the
    // joined leads table isn't supported by PostgREST's .or() in a single
    // query, so this stays call-level, same limitation the user-facing
    // route already has.
    query = query.or(`phone_number.ilike.%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[admin/recordings/list] query failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to load recordings' }, { status: 500 })
  }

  // calls.user_id has no real foreign key to users.clerk_id (both are
  // plain text columns) — PostgREST's embedded-resource join syntax only
  // works with an actual FK constraint, so the owning user has to be
  // fetched separately and merged in here rather than joined in the query
  // above.
  const ownerIds = Array.from(new Set((data || []).map(c => c.user_id).filter(Boolean)))
  const { data: owners } = ownerIds.length > 0
    ? await supabase.from('users').select('clerk_id, email, first_name, last_name').in('clerk_id', ownerIds)
    : { data: [] }
  const ownerById = new Map((owners || []).map(u => [u.clerk_id, u]))

  const recordings = (data || []).map(call => ({
    ...call,
    owner: ownerById.get(call.user_id) || null,
  }))

  return NextResponse.json({
    success: true,
    recordings,
    total: count ?? 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}
