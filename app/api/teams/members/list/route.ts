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
// half-received finds only what happened to arrive. It used to resolve names
// through `users` first and feed the matching ids back in, which needed its
// own cap to stop one broad term rebuilding the payload this route exists to
// avoid; the grouped query does the join itself and pages the result, so the
// cap went with it.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

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

    const teamIds = (teams || []).map((t: any) => t.id)
    if (teamFilter && !teamIds.includes(teamFilter)) {
      return NextResponse.json({ success: false, error: 'Not your team' }, { status: 403 })
    }

    if (teamIds.length === 0) {
      return NextResponse.json({
        success: true, rows: [], total: 0, seatTotal: 0, page, pageSize, teams: [],
      })
    }

    // ── ONE ROW PER PERSON ────────────────────────────────────────────────
    // This paged over team_members, so somebody on two teams came back twice
    // and read as a duplicate on a screen called All Users.
    //
    // Grouping in the client cannot fix that. The list is server-paginated,
    // and a person's two memberships can land either side of a page boundary
    // — so the copies would merge on one page and not on the next, which is
    // worse than consistently showing both.
    //
    // So the grouping happens in the database, in owner_roster, along with
    // the search and both totals. Everything this route used to assemble by
    // hand — the user lookup, the campaign-access counts, the exact count —
    // comes back in one round trip, which also removes the three separate
    // reads that each had their own truncation ceiling.
    const { data: rowsRaw, error } = await supabaseAdmin.rpc('owner_roster', {
      p_owner: userId,
      p_team: teamFilter || null,
      p_status: statusFilter,
      p_search: search ? search.replace(/[%_]/g, ' ').slice(0, 80) : null,
      p_limit: pageSize,
      p_offset: page * pageSize,
    })
    if (error) throw error

    const rows = (rowsRaw || []) as any[]

    const out = rows.map((r: any) => {
      const memberships = Array.isArray(r.memberships) ? r.memberships : []
      const realName =
        [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || 'Agent'
      // A nickname belongs to a MEMBERSHIP, so somebody on two teams can carry
      // two. The first one set wins for the person-level name rather than
      // inventing a precedence rule nobody asked for; each team's own label is
      // still on its membership below.
      const nickname = memberships.find((m: any) => m?.nickname)?.nickname || null

      return {
        userId: r.user_id,
        name: nickname || realName,
        realName,
        email: r.email ?? null,
        seatCount: Number(r.seat_count) || memberships.length,
        joinedAt: r.latest_joined,
        memberships,
        // Flattened for the table, which asks one question per column.
        memberIds: memberships.map((m: any) => m.memberId),
        teamNames: memberships.map((m: any) => m.teamName),
        // The row a click opens. First membership rather than a choice —
        // opening somebody should not start with a question.
        primaryTeamId: memberships[0]?.teamId ?? null,
        primaryMemberId: memberships[0]?.memberId ?? null,
        campaignCount: memberships.reduce(
          (sum: number, m: any) => sum + (Number(m.campaignCount) || 0), 0
        ),
        // Dimmed only when there is nowhere left to dial. Somebody suspended
        // on one team and working on another is not a suspended agent.
        suspended: memberships.length > 0 && memberships.every((m: any) => m.suspended),
        anySuspended: memberships.some((m: any) => m.suspended),
        pickedUp: memberships.some((m: any) => m.pickedUp),
      }
    })

    const total = rows.length > 0 ? Number(rows[0].user_total) : 0
    const seatTotal = rows.length > 0 ? Number(rows[0].seat_total) : 0

    return NextResponse.json({
      success: true,
      rows: out,
      // PEOPLE, which is what is being paged.
      total,
      // SEATS. A person on two teams is one row here and two seats on the
      // bill, and the seat tile must not start under-reporting because this
      // screen started grouping.
      seatTotal,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: (page + 1) * pageSize < total,
      teams: teams || [],
    })
  } catch (error: any) {
    console.error('Members list error:', error)
    return apiError(error, { route: 'teams/members/list' })
  }
}
