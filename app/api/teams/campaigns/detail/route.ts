import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// ONE CAMPAIGN, EVERYTHING ABOUT IT
//
// The team view can only ever show a campaign as a row: a name, a lead count,
// a pause button. Everything an owner actually does to a campaign — see who is
// on it, take someone off, change how it dials, stop the numbers leaking —
// had no home, so it was spread across the campaigns page, the dialer, and
// nowhere.
//
// Deliberately owner-only. An agent's view of a campaign is the queue panel;
// this is the control surface, and the two should not be the same page
// pretending to be different.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = req.nextUrl.searchParams.get('campaignId')
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, status, dialer_mode, total_leads, called_leads, amd_enabled, recording_enabled, predictive_lines_per_agent, mask_lead_numbers, agent_picks_mode, ingest_token, ingest_enabled, last_lead_added_at, user_id, created_at')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    // Two ways to be entitled to this page: you made the campaign, or you own a
    // team it is attached to. Checked against the data rather than trusted from
    // the request — this returns a lead list's shape and who can dial it.
    const { data: attachRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id, access_mode')
      .eq('campaign_id', campaignId)

    const teamIds = (attachRows || []).map((r: any) => r.team_id)
    let ownedTeam: any = null
    if (teamIds.length > 0) {
      const { data: teams } = await supabaseAdmin
        .from('teams')
        .select('id, name, owner_id')
        .in('id', teamIds)
      ownedTeam = (teams || []).find((t: any) => t.owner_id === userId) || null
    }

    const isCampaignOwner = campaign.user_id === userId
    if (!isCampaignOwner && !ownedTeam) {
      // ── A DIALER IS NOT A TRESPASSER ────────────────────────────────────
      // This used to end here with "Not your campaign", so an agent who opened
      // a campaign they dial every day was told, in red, that it was not
      // theirs. True in the ownership sense and useless in every other: they
      // have a real reason to look, and refusing them taught them nothing
      // except that the page is not for them.
      //
      // Ownership decides what somebody may CHANGE. It should not decide
      // whether they may see the work they are doing. So a member with access
      // gets a view scoped to exactly that: the campaign's name and state, and
      // their own numbers on it.
      //
      // Deliberately absent, and worth stating because the temptation is to
      // widen it later: no other agent's name or figures, no lead data, no
      // settings, no codes, no drip token, nothing that spends money. A
      // member's view answers "how am I doing on this" and nothing else.
      const memberAccess = await resolveMemberAccess(userId, campaignId, teamIds)
      if (!memberAccess) {
        return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
      }

      const [mine, scripts, recent, daily] = await Promise.all([
        myCampaignStats(userId, campaignId),
        campaignScripts(campaignId),
        myRecentCalls(userId, campaignId),
        myDailyCalls(userId, campaignId),
      ])

      return NextResponse.json({
        success: true,
        viewerRole: 'member',
        team: { id: memberAccess.teamId, name: memberAccess.teamName, accessMode: null },
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          dialerMode: campaign.dialer_mode,
          // How much of the list is left is legitimately theirs to know: it is
          // the difference between settling in and expecting to run dry.
          totalLeads: campaign.total_leads ?? 0,
          calledLeads: campaign.called_leads ?? 0,
          remainingLeads: Math.max((campaign.total_leads ?? 0) - (campaign.called_leads ?? 0), 0),
        },
        myStats: mine,
        // The scripts they dial with. Not a new disclosure — these are already
        // in front of them on every call; putting them here is the same words
        // somewhere they can read before the phone is ringing.
        scripts,
        // Their own call history on this campaign. Outcome, when, how long.
        // Deliberately no lead name or number: a member's record of their own
        // work does not require handing back the list, and this product has a
        // masking feature precisely because that data is not freely shared.
        myRecentCalls: recent,
        myDailyCalls: daily,
        // Stated rather than hidden. Somebody whose calls are recorded should
        // be told so by the product, not find out later.
        recordingEnabled: !!campaign.recording_enabled,
        agents: [],
        availableMembers: [],
        ingestLog: [],
        isCampaignOwner: false,
      })
    }

    const accessMode =
      (attachRows || []).find((r: any) => r.team_id === ownedTeam?.id)?.access_mode ?? null

    // Who can dial it. Only meaningful for a campaign attached to a team the
    // viewer owns — a personal campaign has exactly one dialer.
    let agents: any[] = []
    if (ownedTeam) {
      const { data: accessRows } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id, team_member_id, payer, access_source, granted_at')
        .eq('campaign_id', campaignId)
        .eq('team_id', ownedTeam.id)
        .eq('is_active', true)

      const memberIds = (accessRows || []).map((a: any) => a.team_member_id)
      if (memberIds.length > 0) {
        const { data: members } = await supabaseAdmin
          .from('team_members')
          .select('id, user_id, status, seat_suspended_at')
          .in('id', memberIds)

        const userIds = Array.from(new Set((members || []).map((m: any) => m.user_id)))
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', userIds)

        const userById: Record<string, any> = {}
        for (const u of users || []) userById[u.clerk_id] = u

        const memberById: Record<string, any> = {}
        for (const m of members || []) memberById[m.id] = m

        agents = (accessRows || []).map((a: any) => {
          const m = memberById[a.team_member_id]
          const u = m ? userById[m.user_id] : null
          const name = u
            ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email)
            : 'Unknown'
          return {
            accessId: a.id,
            memberId: a.team_member_id,
            userId: m?.user_id ?? null,
            name,
            email: u?.email ?? null,
            payer: a.payer,
            accessSource: a.access_source,
            suspended: !!m?.seat_suspended_at,
          }
        })
      }
    }

    // Everyone on the team who is NOT already on this campaign. Returned with
    // the campaign rather than fetched separately, because "who can dial it"
    // and "who could" are two halves of one question and splitting them across
    // two requests is how the two lists end up disagreeing.
    let availableMembers: any[] = []
    if (ownedTeam) {
      const alreadyOn = new Set(agents.map((a: any) => a.memberId))
      const { data: roster } = await supabaseAdmin
        .from('team_members')
        .select('id, user_id, seat_suspended_at')
        .eq('team_id', ownedTeam.id)
        .eq('status', 'active')
        .is('seat_suspended_at', null)

      const candidates = (roster || []).filter((m: any) => !alreadyOn.has(m.id))
      if (candidates.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', Array.from(new Set(candidates.map((m: any) => m.user_id))))

        const byId: Record<string, any> = {}
        for (const u of users || []) byId[u.clerk_id] = u

        availableMembers = candidates.map((m: any) => {
          const u = byId[m.user_id]
          const name = u
            ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email)
            : 'Unknown'
          return { memberId: m.id, userId: m.user_id, name, email: u?.email ?? null }
        }).sort((a: any, b: any) => a.name.localeCompare(b.name))
      }
    }

    let ingestLog: any[] = []
    if (campaign.user_id === userId) {
      const { data: events } = await supabaseAdmin
        .from('lead_ingest_events')
        .select('id, ok, received, accepted, duplicates, rejected, message, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(8)
      ingestLog = events || []
    }

    const total = campaign.total_leads || 0
    const called = campaign.called_leads || 0

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        dialerMode: campaign.dialer_mode,
        totalLeads: total,
        calledLeads: called,
        // Stated rather than left to the reader to subtract. "How much is left"
        // is the question an owner actually opens this page with.
        remainingLeads: Math.max(total - called, 0),
        amdEnabled: campaign.amd_enabled,
        recordingEnabled: campaign.recording_enabled,
        predictiveLines: campaign.predictive_lines_per_agent,
        maskLeadNumbers: !!campaign.mask_lead_numbers,
        agentPicksMode: !!campaign.agent_picks_mode,
        ingestEnabled: !!campaign.ingest_enabled,
        // The token only goes to the campaign's OWNER. A team owner who did not
        // create the campaign can see that drip is on; they cannot read the
        // secret that lets anybody push leads into it.
        ingestToken: campaign.user_id === userId ? (campaign.ingest_token || null) : null,
        lastLeadAddedAt: campaign.last_lead_added_at || null,
        createdAt: campaign.created_at,
      },
      // The last few deliveries, accepted or not. A vendor whose CRM is sending
      // malformed JSON otherwise has no way to find out except by noticing that
      // leads never arrive — and "it is not working" with no evidence is what
      // turns an integration into a support ticket.
      ingestLog: ingestLog,
      team: ownedTeam ? { id: ownedTeam.id, name: ownedTeam.name, accessMode } : null,
      agents,
      availableMembers,
      isCampaignOwner,
    })
  } catch (error: any) {
    console.error('Campaign detail error:', error)
    return apiError(error, { route: 'teams/campaigns/detail' })
  }
}

/** Is this user an active member of a team the campaign is attached to, AND
 *  granted access to it? Both are required: being on the team is not the same
 *  as being put on the campaign. */
async function resolveMemberAccess(
  clerkId: string,
  campaignId: string,
  teamIds: string[]
): Promise<{ teamId: string; teamName: string } | null> {
  if (teamIds.length === 0) return null

  const { data: memberships } = await supabaseAdmin
    .from('team_members')
    .select('id, team_id, status')
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .in('team_id', teamIds)

  if (!memberships || memberships.length === 0) return null

  // An 'free' campaign is open to the whole team; otherwise the grant has to
  // exist against this specific member.
  const memberIds = memberships.map((m: any) => m.id)
  const { data: grants } = await supabaseAdmin
    .from('team_campaign_access')
    .select('team_member_id')
    .eq('campaign_id', campaignId)
    .in('team_member_id', memberIds)
    .is('revoked_at', null)

  const granted = new Set((grants || []).map((g: any) => g.team_member_id))

  const { data: attach } = await supabaseAdmin
    .from('team_campaigns')
    .select('team_id, access_mode')
    .eq('campaign_id', campaignId)

  const openTeams = new Set(
    (attach || []).filter((a: any) => a.access_mode === 'free').map((a: any) => a.team_id)
  )

  const hit = memberships.find(
    (m: any) => granted.has(m.id) || openTeams.has(m.team_id)
  )
  if (!hit) return null

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('id', hit.team_id)
    .maybeSingle()

  return { teamId: hit.team_id, teamName: team?.name || 'Team' }
}

/** The viewer's OWN numbers on this campaign. Never anybody else's. */
async function myCampaignStats(clerkId: string, campaignId: string) {
  const { data } = await supabaseAdmin
    .from('calls')
    .select('disposition, duration')
    .eq('user_id', clerkId)
    .eq('campaign_id', campaignId)

  const rows = data || []

  // ── THE STORED VALUES USE SPACES, NOT UNDERSCORES ──────────────────────
  // Live data holds 'NOT INTERESTED' and 'DO NOT CALL'. Matching on
  // 'NOT_INTERESTED' and 'DNC' — which is what a reader would reasonably
  // assume, and what a comment elsewhere in this codebase still says — returns
  // zero for both, forever, with no error. A stat that silently reads zero is
  // worse than one that is missing: it looks like an answer.
  //
  // Both spellings are accepted so older rows, and any path that writes the
  // underscored form, still count.
  const by = (...forms: string[]) => {
    const set = new Set(forms)
    return rows.filter((r: any) => set.has(r.disposition)).length
  }

  return {
    calls: rows.length,
    talkSeconds: rows.reduce((n: number, r: any) => n + (Number(r.duration) || 0), 0),
    appointments: by('APPOINTMENT', 'APPOINTMENT_SET'),
    closed: by('CLOSED'),
    notInterested: by('NOT INTERESTED', 'NOT_INTERESTED'),
    dnc: by('DO NOT CALL', 'DNC'),
  }
}

/** Scripts attached to this campaign, in the order the owner arranged them.
 *  Two queries rather than a PostgREST embed: campaign_script_links has no
 *  guaranteed foreign key to scripts, and an embed that cannot resolve returns
 *  null rather than erroring — a silent empty list is exactly the failure this
 *  codebase keeps producing. */
async function campaignScripts(campaignId: string) {
  const { data: links } = await supabaseAdmin
    .from('campaign_script_links')
    .select('script_id, sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })

  const ids = (links || []).map((l: any) => l.script_id).filter(Boolean)
  if (ids.length === 0) return []

  const { data: rows } = await supabaseAdmin
    .from('scripts')
    .select('id, name, body')
    .in('id', ids)

  const byId = new Map((rows || []).map((r: any) => [r.id, r]))
  return (links || [])
    .map((l: any) => byId.get(l.script_id))
    .filter(Boolean)
    .map((r: any) => ({ id: r.id, name: r.name, body: r.body }))
}

/** The viewer's own last calls on this campaign. No lead identity. */
async function myRecentCalls(clerkId: string, campaignId: string) {
  const { data } = await supabaseAdmin
    .from('calls')
    .select('created_at, disposition, duration')
    .eq('user_id', clerkId)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(12)

  return (data || []).map((r: any) => ({
    at: r.created_at,
    disposition: r.disposition,
    seconds: Number(r.duration) || 0,
  }))
}

/** The viewer's own call count per day for the last week, oldest first, with
 *  empty days included — a gap in a sparse list reads as missing data, and a
 *  day off is a real answer. */
async function myDailyCalls(clerkId: string, campaignId: string) {
  const since = new Date(Date.now() - 6 * 24 * 3600 * 1000)
  since.setHours(0, 0, 0, 0)

  const { data } = await supabaseAdmin
    .from('calls')
    .select('created_at')
    .eq('user_id', clerkId)
    .eq('campaign_id', campaignId)
    .gte('created_at', since.toISOString())

  const counts = new Map<string, number>()
  for (const r of data || []) {
    const key = String((r as any).created_at).slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const out: Array<{ day: string; calls: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    const key = d.toISOString().slice(0, 10)
    out.push({ day: key, calls: counts.get(key) || 0 })
  }
  return out
}
