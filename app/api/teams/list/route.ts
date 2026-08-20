import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { loadScriptsByCampaign } from '@/lib/campaignScriptLinks'
import { summariseSeatTier } from '@/lib/seatTiers'

// ── EXPLICIT, SO TRUNCATION STOPS BEING SILENT ──────────────────────────
// Supabase caps a select at 1,000 rows and returns them without erroring, so an
// unbounded query on a big account quietly loses data and nothing says so —
// agents missing from campaigns they can dial fine, with no error to chase.
//
// These caps are deliberately ABOVE that default so the limit reached is ours
// and we can tell when it was hit. The sidebar tree is a navigation aid, not a
// roster: /api/teams/members/list is the paged, counted source for the actual
// list of people, and this response now says when the tree is a partial view.
const TREE_MEMBER_CAP = 2000
const TREE_ACCESS_CAP = 5000
const TREE_CODE_CAP = 500

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // True when the tree is showing a partial view. Surfaced rather than
    // hidden: a sidebar that is quietly incomplete is worse than one that says
    // so and points at the full list.
    let treeTruncated = false

    const { searchParams } = new URL(req.url)
    const detail = searchParams.get('detail') === 'owned'

    const { data: ownedTeams, error: ownedErr } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (ownedErr) throw ownedErr

    const { data: memberRows, error: memberErr } = await supabaseAdmin
      .from('team_members')
      .select('team_id, status, accepted_at, joined_via_code')
      .eq('user_id', userId)
      .eq('status', 'active')
      // One person is not on hundreds of teams, but an unbounded select is an
      // unbounded select — every one of them in this file now names its ceiling
      // so none can quietly become the next silent truncation.
      .limit(200)

    if (memberErr) throw memberErr

    // ── THE VIEWER'S OWN PENDING REQUESTS ─────────────────────────────────
    // The query above is active-only, which is right for "teams I can work" —
    // but it meant an agent who joined with a review code saw nothing at all
    // afterwards. No team in the sidebar, no request anywhere, no indication
    // the code had even been accepted. From their side the join silently
    // failed.
    //
    // Returned separately rather than mixed into `member`, because a pending
    // request is not a team you belong to: it must not appear in the tree or
    // grant anything. It exists so the agent can see they are waiting, and on
    // whom.
    const { data: myPendingRows } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')

    let myPending: any[] = []
    if (myPendingRows && myPendingRows.length > 0) {
      const { data: pendingTeams } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .in('id', myPendingRows.map((r: any) => r.team_id))
      const nameById: Record<string, string> = {}
      for (const t of pendingTeams || []) nameById[t.id] = t.name
      myPending = myPendingRows.map((r: any) => ({
        id: r.id,
        teamId: r.team_id,
        teamName: nameById[r.team_id] || 'Team',
        requestedAt: r.created_at,
      }))
    }

    // ── AN ANSWER THEY HAVE NOT SEEN YET ─────────────────────────────────
    // A pending request is not news — nothing has happened and the agent can do
    // nothing about it, which is why it no longer badges. A DECISION is news
    // exactly once. Accepted or declined, somebody answered them, and they
    // should not have to notice a team quietly appearing in a tree to find out.
    const { data: decidedRows } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, status, accepted_at, removed_at')
      .eq('user_id', userId)
      .in('status', ['active', 'removed'])
      .is('decision_seen_at', null)
      .limit(25)

    let myDecisions: any[] = []
    if (decidedRows && decidedRows.length > 0) {
      const { data: decidedTeams } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .in('id', decidedRows.map((r: any) => r.team_id))
      const nameById: Record<string, string> = {}
      for (const t of decidedTeams || []) nameById[t.id] = t.name
      myDecisions = decidedRows.map((r: any) => ({
        id: r.id,
        teamId: r.team_id,
        teamName: nameById[r.team_id] || 'Team',
        outcome: r.status === 'active' ? 'accepted' : 'declined',
        decidedAt: r.accepted_at || r.removed_at,
      }))
    }

    const memberTeamIds = (memberRows || []).map((m: any) => m.team_id)

    let memberTeams: any[] = []
    if (memberTeamIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('teams')
        .select('id, name, description, owner_id, created_at')
        .in('id', memberTeamIds)

      if (error) throw error
      memberTeams = data || []
    }

    let owned = (ownedTeams || []).map((t: any) => ({ ...t, viewerRole: 'owner' as const }))
    const member = memberTeams.map((t: any) => ({ ...t, viewerRole: 'member' as const }))

    if (owned.length > 0) {
      const { data: ownerTenant } = await supabaseAdmin
        .from('white_label_tenants')
        .select('id, slug, brand_name, logo_url, primary_color, custom_domain, status, is_active')
        .eq('owner_clerk_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      const tenant = ownerTenant && ownerTenant.status === 'active' ? ownerTenant : null
      owned = owned.map((t: any) => ({ ...t, tenant }))
    }

    if (detail && owned.length > 0) {
      const ownedIds = owned.map((t: any) => t.id)

      const [
        { data: allMembers },
        { data: allCodes },
        { data: allCampaigns },
        { data: allAccess },
      ] = await Promise.all([
        supabaseAdmin
          .from('team_members')
          // Seat state comes back too: an owner managing a member needs to
          // know who is paying and whether the seat is suspended before they
          // can sensibly do anything about either.
          .select('id, team_id, user_id, status, accepted_at, removed_at, joined_via_code, created_at, billing_override, seat_price_override_cents, seat_suspended_at, seat_suspend_reason, billing_takeover_at')
          .in('team_id', ownedIds)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false })
          .limit(TREE_MEMBER_CAP),
        supabaseAdmin
          .from('team_codes')
          .select('*')
          .in('team_id', ownedIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(TREE_CODE_CAP),
        supabaseAdmin
          .from('team_campaigns')
          .select('team_id, campaign_id, access_mode, created_at, campaigns(id, name, total_leads, called_leads, status, dialer_mode)')
          .in('team_id', ownedIds)
          .limit(TREE_CODE_CAP),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_id, team_member_id, campaign_id, payer, is_active, access_source, granted_at')
          .in('team_id', ownedIds)
          .eq('is_active', true)
          // Agents times campaigns — the cross product hits the cap long before
          // the roster does, which is why this was the first thing to break.
          .limit(TREE_ACCESS_CAP),
      ])

      const memberClerkIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)))
      let userById: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
      if (memberClerkIds.length > 0) {
        const { data: userRows } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', memberClerkIds)
        for (const u of userRows || []) {
          userById[u.clerk_id] = {
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
          }
        }
      }

      const accessByMember: Record<string, any[]> = {}
      for (const a of allAccess || []) {
        if (!accessByMember[a.team_member_id]) accessByMember[a.team_member_id] = []
        accessByMember[a.team_member_id].push(a)
      }

      const membersByTeam: Record<string, any[]> = {}
      const pendingByTeam: Record<string, any[]> = {}
      for (const m of allMembers || []) {
        const enriched = {
          ...m,
          // Explicit, because the row's own `id` is the MEMBERSHIP id and the
          // two are easy to confuse downstream — one addresses a person, the
          // other their place in this team.
          userId: m.user_id,
          user: userById[m.user_id] || { email: null, first_name: null, last_name: null },
          campaignAccess: (accessByMember[m.id] || []).map((a: any) => ({
            id: a.id,
            campaignId: a.campaign_id,
            payer: a.payer,
            accessSource: a.access_source,
            grantedAt: a.granted_at,
          })),
        }
        const bucket = m.status === 'active' ? membersByTeam : pendingByTeam
        if (!bucket[m.team_id]) bucket[m.team_id] = []
        bucket[m.team_id].push(enriched)
      }

      const codesByTeam: Record<string, any[]> = {}
      for (const c of allCodes || []) {
        if (!codesByTeam[c.team_id]) codesByTeam[c.team_id] = []
        codesByTeam[c.team_id].push(c)
      }

      const campaignScripts = await loadScriptsByCampaign(
        Array.from(new Set((allCampaigns || []).map((tc: any) => tc.campaign_id)))
      )

      const campaignsByTeam: Record<string, any[]> = {}
      for (const tc of allCampaigns || []) {
        if (!campaignsByTeam[tc.team_id]) campaignsByTeam[tc.team_id] = []
        campaignsByTeam[tc.team_id].push({
          campaignId: tc.campaign_id,
          accessMode: tc.access_mode,
          createdAt: tc.created_at,
          campaign: tc.campaigns
            ? { ...tc.campaigns, scripts: campaignScripts[tc.campaign_id] || [] }
            : null,
        })
      }

      treeTruncated =
        (allMembers || []).length >= TREE_MEMBER_CAP ||
        (allAccess || []).length >= TREE_ACCESS_CAP

      owned = owned.map((t: any) => ({
        ...t,
        members: membersByTeam[t.id] || [],
        pendingMembers: pendingByTeam[t.id] || [],
        codes: codesByTeam[t.id] || [],
        teamCampaigns: campaignsByTeam[t.id] || [],
      }))
    }

    // ── A MEMBER NEEDS TO SEE THE CAMPAIGNS TOO ───────────────────────────
    // The enrichment above is owned-only, so a team someone JOINED came back
    // as a bare name: no campaigns under it in the sidebar, nothing to select,
    // no sign of what they had been given access to. From the agent's side,
    // being approved onto a team looked identical to not being on one.
    //
    // Deliberately narrower than the owner's view. An agent gets the campaigns
    // and who else is on them, which is what they need to work; they do not
    // get join codes or pending requests, which are the owner's business.
    let memberWithCampaigns = member
    if (member.length > 0) {
      const memberIds = member.map((t: any) => t.id)

      const [{ data: mCampaigns }, { data: mMembers }, { data: mAccess }] = await Promise.all([
        supabaseAdmin
          .from('team_campaigns')
          .select('team_id, campaign_id, access_mode, created_at, campaigns(id, name, total_leads, called_leads, status, dialer_mode)')
          .in('team_id', memberIds)
          .limit(TREE_CODE_CAP),
        supabaseAdmin
          .from('team_members')
          .select('id, team_id, user_id, status')
          .in('team_id', memberIds)
          .eq('status', 'active')
          .limit(TREE_MEMBER_CAP),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_id, team_member_id, campaign_id, payer, is_active, access_source, granted_at')
          .in('team_id', memberIds)
          .eq('is_active', true)
          .limit(TREE_ACCESS_CAP),
      ])

      const userIds = Array.from(new Set((mMembers || []).map((m: any) => m.user_id)))
      const userById: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: userRows } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', userIds)
        for (const u of userRows || []) userById[u.clerk_id] = u
      }

      const accessByMember: Record<string, any[]> = {}
      for (const a of mAccess || []) {
        if (!accessByMember[a.team_member_id]) accessByMember[a.team_member_id] = []
        accessByMember[a.team_member_id].push(a)
      }

      const membersByTeamId: Record<string, any[]> = {}
      for (const m of mMembers || []) {
        if (!membersByTeamId[m.team_id]) membersByTeamId[m.team_id] = []
        membersByTeamId[m.team_id].push({
          ...m,
          userId: m.user_id,
          user: userById[m.user_id] || { email: null, first_name: null, last_name: null },
          campaignAccess: (accessByMember[m.id] || []).map((a: any) => ({
            id: a.id,
            campaignId: a.campaign_id,
            payer: a.payer,
            accessSource: a.access_source,
            grantedAt: a.granted_at,
          })),
        })
      }

      const campsByTeamId: Record<string, any[]> = {}
      for (const tc of mCampaigns || []) {
        if (!campsByTeamId[tc.team_id]) campsByTeamId[tc.team_id] = []
        campsByTeamId[tc.team_id].push({
          campaignId: tc.campaign_id,
          accessMode: tc.access_mode,
          createdAt: tc.created_at,
          campaign: tc.campaigns || null,
        })
      }

      memberWithCampaigns = member.map((t: any) => {
        // Which campaigns THIS viewer may actually dial on this team. Two
        // sources, because access has two shapes: a grant made to them
        // specifically, and a campaign the owner opened to the whole team.
        const roster = membersByTeamId[t.id] || []
        const mine = roster.find((m: any) => m.user_id === userId)
        const granted = new Set(
          (mine?.campaignAccess || []).map((a: any) => a.campaignId)
        )
        const openToTeam = (campsByTeamId[t.id] || [])
          .filter((c: any) => c.accessMode === 'free' || c.accessMode === 'public')
          .map((c: any) => c.campaignId)
        for (const cid of openToTeam) granted.add(cid)

        return {
          ...t,
          campaigns: campsByTeamId[t.id] || [],
          members: roster,
          pendingMembers: [],
          codes: [],
          myCampaignIds: Array.from(granted),
        }
      })
    }

    // ── VOLUME TIER, COUNTED ACROSS EVERY TEAM THEY OWN ──────────────────
    // The owner is the billing entity, so a vendor running three teams of eight
    // is a twenty-four-seat customer — not three small ones. Counting per team
    // would punish exactly the structure the tiers exist to reward.
    //
    // Suspended seats are excluded: a paused seat is not being billed, so it
    // cannot count toward a discount on the bill.
    let seatTier = null
    if (owned.length > 0) {
      const ownedIdsForSeats = owned.map((t: any) => t.id)

      // The whole roster — earns badges and the sales handoff.
      const { count: totalSeatCount } = await supabaseAdmin
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .in('team_id', ownedIdsForSeats)
        .eq('status', 'active')
        .is('seat_suspended_at', null)

      // Seats this owner is actually billed for — the only ones a discount can
      // reduce. Counted from intent (the override, or the code they joined
      // with) rather than from settled charges: charge rows have been
      // unreliable, and under-counting here would quietly withhold a discount
      // somebody has earned.
      const { count: overrideOwnerCount } = await supabaseAdmin
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .in('team_id', ownedIdsForSeats)
        .eq('status', 'active')
        .is('seat_suspended_at', null)
        .eq('billing_override', 'owner')

      const { data: ownerPayCodes } = await supabaseAdmin
        .from('team_codes')
        .select('code')
        .in('team_id', ownedIdsForSeats)
        .eq('payer', 'owner')

      let viaCodeCount = 0
      const codeStrings = (ownerPayCodes || []).map((c: any) => c.code).filter(Boolean)
      if (codeStrings.length > 0) {
        const { count } = await supabaseAdmin
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .in('team_id', ownedIdsForSeats)
          .eq('status', 'active')
          .is('seat_suspended_at', null)
          .is('billing_override', null)
          .in('joined_via_code', codeStrings)
        viaCodeCount = count || 0
      }

      const total = totalSeatCount || 0
      // Capped at the roster: the two queries are disjoint by construction
      // (one requires the override set, the other requires it null), but a
      // count that exceeded the roster would be nonsense on the page.
      const ownerPaid = Math.min((overrideOwnerCount || 0) + viaCodeCount, total)

      seatTier = summariseSeatTier(ownerPaid, total)
    }

    return NextResponse.json({
      success: true,
      teams: { owned, member: memberWithCampaigns },
      // Join requests this viewer is waiting on. Empty for most people.
      myPending,
      // Decisions made about them that they have not seen yet.
      myDecisions,
      seatTier,
      treeTruncated,
    })
  } catch (error: any) {
    console.error('Team list error:', error)
    return apiError(error, { route: 'teams/list' })
  }
}