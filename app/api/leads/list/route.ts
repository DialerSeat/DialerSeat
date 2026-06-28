import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

// SECURITY (was IDOR): scoped only by client-supplied ?user_id with no auth.
// Identity now comes from the Clerk session.

const PAGE_SIZE = 50

// Disposition strings for virtual sub-campaigns. These MUST match the ones
// declared in /api/campaigns/list/route.ts. If the dialer writes different
// disposition values, update both files together.
const SUB_DISPOSITIONS: Record<string, string> = {
  appointments: 'APPOINTMENT',
  not_interested: 'NOT_INTERESTED',
}

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const rawCampaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const sort = searchParams.get('sort') || 'created_desc'
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  // Parse virtual sub-campaign IDs of the form `${parentId}:${subType}`.
  // When detected, treat it as the parent campaign + an enforced disposition
  // filter. The colon split is safe: real campaign IDs are UUIDs which contain
  // dashes but no colons.
  let campaignId = rawCampaignId
  let virtualDispositionFilter: string | null = null
  if (campaignId !== 'all' && campaignId.includes(':')) {
    const [parentId, subType] = campaignId.split(':')
    if (parentId && subType && SUB_DISPOSITIONS[subType]) {
      campaignId = parentId
      virtualDispositionFilter = SUB_DISPOSITIONS[subType]
    } else {
      // Malformed virtual id — return empty rather than 400 so the dialer
      // doesn't error out on a stale URL.
      return NextResponse.json({
        success: true,
        leads: [],
        total: 0,
        nextCursor: null,
      })
    }
  }

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }

  // The virtual sub-campaign filter takes precedence over the disposition
  // query param. A virtual sub is by definition pinned to one disposition.
  if (virtualDispositionFilter) {
    query = query.eq('disposition', virtualDispositionFilter)
  } else if (disposition !== 'all') {
    if (disposition === 'uncalled') {
      query = query.is('disposition', null)
    } else {
      query = query.eq('disposition', disposition)
    }
  }

  if (search) {
    // Search across name, phone fields. Supabase OR syntax.
    const safe = search.replace(/[%,()]/g, '')
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`
    )
  }

  // Sorting
  switch (sort) {
    case 'created_asc':
      query = query.order('created_at', { ascending: true })
      break
    case 'last_called_desc':
      query = query.order('last_called_at', { ascending: false, nullsFirst: false })
      break
    case 'attempts_desc':
      query = query.order('dial_attempts', { ascending: false })
      break
    case 'created_desc':
    default:
      query = query.order('created_at', { ascending: false })
  }

  // Add a stable secondary sort so pagination is deterministic
  query = query.order('id', { ascending: false })

  query = query.range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('leads list error', error)
    return apiError(error, { route: 'leads/list' })
  }

  return NextResponse.json({
    success: true,
    leads: data || [],
    total: count || 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}