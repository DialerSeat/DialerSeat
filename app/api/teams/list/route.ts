import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Lists teams visible to the authenticated user.
 * Returns teams where user is either:
 *   - The owner (full team object)
 *   - An active member (limited fields, omits owner-only data)
 *
 * Each team is tagged with `viewerRole: 'owner' | 'member'` so UI can branch.
 *
 * Optional ?detail=owned — embeds members/pendingMembers/codes/teamCampaigns
 * on each owned team. Each member also gets a campaignAccess[] array showing
 * which campaigns they have active access to and the underlying payer.
 */
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
          .select('team_id, campaign_id, access_mode, created_at, campaigns(id, name, total_leads, called_leads, status)')
          .in('team_id', ownedIds),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_id, team_member_id, campaign_id, payer, is_active, access_source, created_at')
          .in('team_id', ownedIds)
          .eq('is_active', true),
      ])

      // Resolve member identities
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

      // Group access by team_member_id
      const accessByMember: Record<string, any[]> = {}
      for (const a of allAccess || []) {
        if (!accessByMember[a.team_member_id]) accessByMember[a.team_member_id] = []
        accessByMember[a.team_member_id].push(a)
      }

      // Group members by team_id, attaching access + identity
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

      const campaignsByTeam: Record<string, any[]> = {}
      for (const tc of allCampaigns || []) {
        if (!campaignsByTeam[tc.team_id]) campaignsByTeam[tc.team_id] = []
        campaignsByTeam[tc.team_id].push({
          campaignId: tc.campaign_id,
          accessMode: tc.access_mode,
          createdAt: tc.created_at,
          campaign: tc.campaigns,
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

    return NextResponse.json({
      success: true,
      teams: { owned, member },
    })
  } catch (error: any) {
    console.error('Team list error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}