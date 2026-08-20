import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { loadScriptsByCampaign } from '@/lib/campaignScriptLinks'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

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
          .select('id, team_id, user_id, status, accepted_at, removed_at, joined_via_code, created_at')
          .in('team_id', ownedIds)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('team_codes')
          .select('*')
          .in('team_id', ownedIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('team_campaigns')
          .select('team_id, campaign_id, access_mode, created_at, campaigns(id, name, total_leads, called_leads, status, dialer_mode)')
          .in('team_id', ownedIds),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_id, team_member_id, campaign_id, payer, is_active, access_source, created_at')
          .in('team_id', ownedIds)
          .eq('is_active', true),
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
          user: userById[m.user_id] || { email: null, first_name: null, last_name: null },
          campaignAccess: (accessByMember[m.id] || []).map((a: any) => ({
            id: a.id,
            campaignId: a.campaign_id,
            payer: a.payer,
            accessSource: a.access_source,
            createdAt: a.created_at,
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
          .in('team_id', memberIds),
        supabaseAdmin
          .from('team_members')
          .select('id, team_id, user_id, status')
          .in('team_id', memberIds)
          .eq('status', 'active'),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_id, team_member_id, campaign_id, payer, is_active, access_source, created_at')
          .in('team_id', memberIds)
          .eq('is_active', true),
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
            createdAt: a.created_at,
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

      memberWithCampaigns = member.map((t: any) => ({
        ...t,
        campaigns: campsByTeamId[t.id] || [],
        members: membersByTeamId[t.id] || [],
        pendingMembers: [],
        codes: [],
      }))
    }

    return NextResponse.json({
      success: true,
      teams: { owned, member: memberWithCampaigns },
      // Join requests this viewer is waiting on. Empty for most people.
      myPending,
    })
  } catch (error: any) {
    console.error('Team list error:', error)
    return apiError(error, { route: 'teams/list' })
  }
}