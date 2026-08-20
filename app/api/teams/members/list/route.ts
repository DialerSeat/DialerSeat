import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// THE ROSTER, ONE PAGE AT A TIME
//
// /api/teams/list returns every member of every team in one payload, which is
// fine at four people and silently wrong at a thousand: Supabase's Data API
// caps a select at 1,000 rows by default and TRUNCATES rather than erroring, so
// past that point the roster is simply missing people and nothing anywhere says
// so. An owner onboarding a floor would see agents vanish with no explanation.
//
// So this exists: paged, searched and counted on the server, where 10,000 rows
// is a range query rather than 10,000 rows of JSON and 10,000 DOM nodes.
//
// Search is server-side for the same reason. Filtering a list the client only
// half-received finds only what happened to arrive.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200
// A search matching half the platform is not a search. Capped so one broad
// term cannot rebuild the very payload this endpoint exists to avoid.
const SEARCH_MATCH_CAP = 1000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const page = Math.max(0, parseInt(sp.get('page') || '0', 10) || 0)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(sp.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    )
    const search = (sp.get('search') || '').trim()
    const teamFilter = sp.get('teamId')
    const statusFilter = sp.get('status') || 'active'

    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('owner_id', userId)

    let teamIds = (teams || []).map((t: any) => t.id)
    if (teamFilter) {
      if (!teamIds.includes(teamFilter)) {
        return NextResponse.json({ success: false, error: 'Not your team' }, { status: 403 })
      }
      teamIds = [teamFilter]
    }

    if (teamIds.length === 0) {
      return NextResponse.json({
        success: true, rows: [], total: 0, page, pageSize, teams: [],
      })
    }

    const teamNameById = new Map((teams || []).map((t: any) => [t.id, t.name]))

    // Search resolves through `users` first because that is where the name and
    // email live — team_members has only a Clerk id, and there is no foreign
    // key to embed across.
    let searchClerkIds: string[] | null = null
    if (search) {
      const safe = search.replace(/[%,()]/g, ' ').slice(0, 80)
      const { data: matched } = await supabaseAdmin
        .from('users')
        .select('clerk_id')
        .or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
        .limit(SEARCH_MATCH_CAP)
      searchClerkIds = (matched || []).map((u: any) => u.clerk_id)
      if (searchClerkIds.length === 0) {
        return NextResponse.json({
          success: true, rows: [], total: 0, page, pageSize,
          teams: teams || [],
        })
      }
    }

    let q = supabaseAdmin
      .from('team_members')
      .select(
        'id, team_id, user_id, status, accepted_at, created_at, joined_via_code, billing_override, seat_suspended_at, seat_suspend_reason, billing_takeover_at',
        // Exact, because "1–50 of 8,431" is the number that tells somebody how
        // much they are looking at. An estimate here would drift visibly as
        // they page.
        { count: 'exact' }
      )
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (searchClerkIds) q = q.in('user_id', searchClerkIds)

    const { data: members, count, error } = await q
    if (error) throw error

    const rows = members || []

    // One lookup for the page, never per row.
    const clerkIds = Array.from(new Set(rows.map((m: any) => m.user_id)))
    const userById = new Map<string, any>()
    if (clerkIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', clerkIds)
      for (const u of users || []) userById.set(u.clerk_id, u)
    }

    // Campaign access counts for this page only. Fetching every access row for
    // the whole account is precisely the cross-product query that breaks first
    // at scale — agents times campaigns hits the 1,000 cap long before the
    // roster does.
    const memberIds = rows.map((m: any) => m.id)
    const accessCount = new Map<string, number>()
    if (memberIds.length > 0) {
      const { data: access } = await supabaseAdmin
        .from('team_campaign_access')
        .select('team_member_id')
        .in('team_member_id', memberIds)
        .eq('is_active', true)
        .limit(MAX_PAGE_SIZE * 50)
      for (const a of access || []) {
        accessCount.set(a.team_member_id, (accessCount.get(a.team_member_id) || 0) + 1)
      }
    }

    const out = rows.map((m: any) => {
      const u = userById.get(m.user_id)
      const name = u
        ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Agent')
        : 'Agent'
      return {
        memberId: m.id,
        userId: m.user_id,
        name,
        email: u?.email ?? null,
        teamId: m.team_id,
        teamName: teamNameById.get(m.team_id) || 'Team',
        status: m.status,
        suspended: !!m.seat_suspended_at,
        suspendReason: m.seat_suspend_reason || null,
        pickedUp: !!m.billing_takeover_at,
        billingOverride: m.billing_override || null,
        campaignCount: accessCount.get(m.id) || 0,
        joinedAt: m.accepted_at || m.created_at,
      }
    })

    const total = count ?? out.length
    return NextResponse.json({
      success: true,
      rows: out,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: (page + 1) * pageSize < total,
      teams: teams || [],
      searchCapped: !!searchClerkIds && searchClerkIds.length >= SEARCH_MATCH_CAP,
    })
  } catch (error: any) {
    console.error('Members list error:', error)
    return apiError(error, { route: 'teams/members/list' })
  }
}
