import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'
import { EXCLUDED_DIALABLE_DISPOSITIONS } from '@/lib/dialableLead'
// Shared with /api/campaigns/list so a sub-queue's count and the rows inside
// it cannot disagree. They previously held separate copies of these strings,
// kept faithfully in sync with each other and both wrong.
import { SUB_DISPOSITION_FORMS, SUB_COLUMN, isSubType } from '@/lib/subDispositions'

// SECURITY (was IDOR): scoped only by client-supplied ?user_id with no auth.
// Identity now comes from the Clerk session.

const PAGE_SIZE = 50


export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const singleId = searchParams.get('id')

  // Single-lead lookup — used by the "Dial Lead" action on the leads and
  // recordings pages to hand a specific lead to the dialer page via
  // ?leadId=. Bypasses all the campaign/pagination/search logic below;
  // still scoped to the authenticated user's own leads (no IDOR).
  if (singleId) {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', singleId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('leads list (single) error', error)
      return apiError(error, { route: 'leads/list' })
    }
    if (!data) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, lead: data })
  }

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
  let virtualDispositionFilter: string[] | null = null
  let virtualDispositionColumn: 'disposition' | 'last_call_disposition' = 'disposition'
  if (campaignId !== 'all' && campaignId.includes(':')) {
    const [parentId, subType] = campaignId.split(':')
    if (parentId && isSubType(subType)) {
      campaignId = parentId
      virtualDispositionFilter = SUB_DISPOSITION_FORMS[subType]
      virtualDispositionColumn = SUB_COLUMN[subType]
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
    query = query.in(virtualDispositionColumn, virtualDispositionFilter)
  } else if (disposition === 'dialable') {
    // No DB-level filter here on purpose — see EXCLUDED_DIALABLE_DISPOSITIONS
    // above and the post-fetch filter below. A DB-level "disposition IS NULL
    // OR disposition NOT IN (...)" filter is the semantically correct query,
    // but two of the three excluded values ('DO NOT CALL', 'NOT INTERESTED')
    // contain spaces, and constructing that as a raw PostgREST OR-filter
    // string without being able to test it against the real database risks
    // a silent, hard-to-diagnose mismatch (rows wrongly shown OR wrongly
    // hidden) — a plain JS array filter after the fetch is directly
    // readable and carries no query-syntax risk.
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

  // ── CALLERS THAT NEED THE WHOLE BOOK CAN ASK FOR BIGGER PAGES ────────────
  // The dialer's queue panel holds every lead in the campaign, so at the
  // default 50 an 831-lead list took 17 sequential round-trips to assemble and
  // a 10,000-lead one would take 200. Every one of those is a chance to fail
  // partway and leave the panel silently short.
  //
  // Optional and clamped, so existing callers are unaffected and nobody can ask
  // for a page big enough to hit PostgREST's own 1000-row ceiling.
  const requestedPageSize = Number(searchParams.get('page_size'))
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(Math.floor(requestedPageSize), 500)
    : PAGE_SIZE

  query = query.range(cursor, cursor + pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('leads list error', error)
    return apiError(error, { route: 'leads/list' })
  }

  const rawLeads = data || []
  const leads =
    disposition === 'dialable'
      ? rawLeads.filter((l: any) => !EXCLUDED_DIALABLE_DISPOSITIONS.has(l.disposition))
      : rawLeads

  return NextResponse.json({
    success: true,
    leads,
    total: count || 0,
    // Based on rawLeads.length (the actual DB page size), not the
    // post-filter leads.length — filtering can make this page's returned
    // array shorter than PAGE_SIZE even though more rows genuinely exist
    // past this window, and cursor advancement needs to reflect the real
    // window, not how many of those rows happened to survive the filter.
    nextCursor: (rawLeads.length === pageSize) ? cursor + pageSize : null,
  })
}