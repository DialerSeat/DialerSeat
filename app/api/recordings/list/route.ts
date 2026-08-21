import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'
import { maskedCampaignIds, maskPhone } from '@/lib/leadMasking'

const supabase = getServiceClient('recordings/list')

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  // ── A TEAM CAMPAIGN'S RECORDINGS BELONG TO THE TEAM ──────────────────────
  // This was strictly the caller's own calls, so a vendor paying for fifteen
  // seats could not listen to a single one of them. Reviewing calls is most of
  // what an owner does with a floor — it is how you catch a closer going off
  // script, and how you settle a dispute about what was said.
  //
  // The widening is DELIBERATELY NARROW: it applies only when a specific
  // campaign is requested and that campaign is attached to a team the caller
  // owns. Everything else stays exactly as it was — their own calls, nobody
  // else's. There is no view here that mixes an owner's personal calls with
  // their agents', because "whose call was this" would stop being answerable.
  let ownsThisTeamCampaign = false
  if (campaignId !== 'all') {
    const { data: myTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', userId)

    const teamIds = (myTeams || []).map((t: any) => t.id)
    if (teamIds.length > 0) {
      const { data: attached } = await supabase
        .from('team_campaigns')
        .select('campaign_id')
        .eq('campaign_id', campaignId)
        .in('team_id', teamIds)
        .limit(1)
      ownsThisTeamCampaign = (attached || []).length > 0
    }
  }

  // Narrow to one agent within that campaign. Only meaningful on a team
  // campaign — asking for somebody else's calls anywhere else returns nothing,
  // because the user_id filter below still applies.
  const agentFilter = searchParams.get('agent_id')

  let query = supabase
    .from('calls')
    .select('*, leads(first_name, last_name, phone, notes), campaigns(name)', { count: 'exact' })
    .or('recording_url.not.is.null,recording_id.not.is.null')

  if (ownsThisTeamCampaign) {
    query = query.eq('campaign_id', campaignId)
    if (agentFilter) query = query.eq('user_id', agentFilter)
  } else {
    query = query.eq('user_id', userId)
  }

    // ── WHY THIS IS NOT JUST "amd_result = human" ──────────────────────────
    // This used to be `amd_result.is.null,amd_result.eq.human`, which hid
    // every call AMD tagged 'machine' or 'not_sure'. That was correct under
    // the old behavior: a machine detection hung the call up instantly with
    // no agent attached, so the recording was a few seconds of voicemail
    // greeting and pure noise in this tab.
    //
    // That is no longer true. Every agent-attended call is bridged the instant
    // the lead picks up, so a 'machine' verdict now lands on a call that was
    // already live. It only ends that call if it arrives inside the
    // amd_max_seconds_after_answer window and the hangup setting allows it
    // (see handleAmdResult in app/api/calls/events/route.ts) — otherwise the
    // conversation continues and is tagged 'machine' anyway. Hiding those
    // recordings loses the one artifact of a call that really happened.
    //
    // 'not_sure' is included outright: Telnyx's own guidance is to treat it
    // as human. And any call that was ANSWERED is included regardless of what
    // AMD guessed, because a recording of an answered call is real audio by
    // definition — AMD's opinion doesn't change that.
  query = query.or('amd_result.is.null,amd_result.eq.human,amd_result.eq.not_sure,answered_at.not.is.null')

  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }
  if (disposition !== 'all') {
    query = query.eq('disposition', disposition)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    return apiError(error, { route: 'recordings/list' })
  }

  let recordings = data || []
  if (search) {
    const s = search.toLowerCase()
    recordings = recordings.filter((r: any) => {
      const lead = r.leads
      if (!lead) return false
      return (
        (lead.first_name || '').toLowerCase().includes(s) ||
        (lead.last_name || '').toLowerCase().includes(s) ||
        (lead.phone || '').includes(s)
      )
    })
  }

  // ── THE SLOW WAY TO STEAL A LIST ──────────────────────────────────────
  // Masking the queue stops somebody copying down a list they were handed. It
  // does nothing about the list they BUILD: an agent dialing two hundred a day
  // has a thousand numbers in their own call history by Friday, and this route
  // was handing over both calls.phone_number and the joined leads.phone.
  //
  // Their own recordings stay theirs — they made those calls and need to find
  // them. The numbers do not, on a campaign whose owner asked for them to be
  // hidden. Last four is enough to locate a call you remember making.
  //
  // Owner-owned campaigns are unaffected; maskedCampaignIds excludes anything
  // the viewer owns.
  try {
    const masked = await maskedCampaignIds(
      recordings.map((r: any) => r.campaign_id).filter(Boolean),
      userId
    )
    if (masked.size > 0) {
      recordings = recordings.map((r: any) => {
        if (!masked.has(r.campaign_id)) return r
        // ── A CALL YOU MADE IS A NUMBER YOU ALREADY HAVE ────────────────
        // This masked the agent's OWN recordings too, on the reasoning that
        // last four is enough to find a call you remember making. Masking
        // exists to stop a list being copied out before it is worked — but
        // this lead HAS been worked, by this person, and the number was in
        // their ear and on their screen while they did it.
        //
        // Continuing to hide it protects nothing and costs them calling
        // somebody back or checking a wrong number. Still scoped tightly:
        // only rows they placed. Another agent's call on the same campaign
        // stays masked, because what is being extended is "you worked this",
        // not "this has been worked".
        if (r.user_id && r.user_id === userId) return r
        return {
          ...r,
          phone_number: maskPhone(r.phone_number),
          leads: r.leads ? { ...r.leads, phone: maskPhone(r.leads.phone) } : r.leads,
          phone_masked: true,
        }
      })
    }
  } catch {
    // Fails open, exactly as the queue does — a settings read that times out
    // must not take somebody's recordings away from them.
  }

  // ── WHOSE CALL WAS THIS ──────────────────────────────────────────────
  // A list of an owner's whole floor is unusable without names on it, and the
  // agent roster is what lets the page offer a filter at all. Only assembled on
  // the team path — on somebody's own recordings every row is theirs and a name
  // column would be the same word repeated down the page.
  let agents: Array<{ userId: string; name: string; recordings: number }> = []
  if (ownsThisTeamCampaign) {
    const counts = new Map<string, number>()
    for (const r of recordings) {
      if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1)
    }
    const ids = Array.from(counts.keys())
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', ids)

      const nameById = new Map<string, string>()
      for (const u of users || []) {
        nameById.set(
          u.clerk_id,
          [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Agent'
        )
      }
      agents = ids
        .map(id => ({
          userId: id,
          name: nameById.get(id) || 'Agent',
          recordings: counts.get(id) || 0,
        }))
        .sort((a, b) => b.recordings - a.recordings)

      recordings = recordings.map((r: any) => ({
        ...r,
        agentName: r.user_id ? (nameById.get(r.user_id) || 'Agent') : null,
      }))
    }
  }

  return NextResponse.json({
    success: true,
    // True when this is a team campaign the caller owns, so the page knows it
    // is looking at a floor rather than at one person.
    teamView: ownsThisTeamCampaign,
    agents,
    recordings,
    total: count || 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}