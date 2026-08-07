import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { isCallableNow } from '@/lib/callingWindow'
import { hasCallingWindowOverride } from '@/lib/callingWindowOverride'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'
import { DIALABLE_STATUSES, isDialableLead } from '@/lib/dialableLead'
import { QueueDiagnosisBuilder } from '@/lib/queueDiagnosis'

// SECURITY (was IDOR): this route took ?user_id from the query string and used
// it for BOTH personal lead scoping AND team-membership verification. That let
// any signed-in user (a) pull another user's personal leads, and (b) spoof
// membership by passing a real member's id. Identity now comes from the Clerk
// session; the query param is ignored.

// How many candidate leads to evaluate before giving up.
// We over-fetch then filter in JS because Supabase can't run our time-zone
// logic. Most pools at 50-200 leads, this is plenty.
const CANDIDATE_LIMIT = 50

// =============================================================================
// THE ATTEMPT CEILING — ONE PLACE, SERVER SIDE
// =============================================================================
// A customer dialed 26 people 224 times in thirty minutes while 282 untouched
// leads sat in the same campaign. Nine calls to one person inside half an hour.
//
// The cause was that "how many times may this lead be dialed" was answered in
// three different places that could disagree:
//
//   - the dialer client, from local state that only syncs when a SPECIFIC
//     campaign is selected (so All Active never syncs it at all)
//   - bumpLeadAttemptAndRelease in the webhook, defaulting to 3
//   - the campaign row itself, which said 1
//
// Status filtering alone could not save it. A lead is only marked 'maxed'
// AFTER the server bumps it, so a client running its own retry loop gets its
// dials in before the status that would have stopped them exists.
//
// So the queue now refuses at source. Whatever the client asks for, and
// whatever order it asks in, a lead at or over its campaign's cap is not
// handed out. This is the belt to the client's braces, and it is the one that
// cannot be bypassed by a stale tab or an unsynced setting.
// =============================================================================

/** Absolute maximum regardless of configuration. Three in a row is the rule. */
const HARD_ATTEMPT_CEILING = 3

async function attemptCapFor(campaignId: string | null | undefined): Promise<number> {
  if (!campaignId) return HARD_ATTEMPT_CEILING
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('dial_repeat_count')
    .eq('id', campaignId)
    .maybeSingle()
  const n = Number(data?.dial_repeat_count)
  if (!Number.isFinite(n) || n < 1) return HARD_ATTEMPT_CEILING
  return Math.min(n, HARD_ATTEMPT_CEILING)
}

/**
 * Has this lead already had every dial it is entitled to?
 *
 * Deliberately >= rather than >. dial_attempts is incremented AFTER a dial, so
 * a lead showing 1 attempt against a cap of 1 has had its call.
 */
function attemptsExhausted(dialAttempts: unknown, cap: number): boolean {
  const n = Number(dialAttempts)
  return Number.isFinite(n) && n >= cap
}

// Fetch the campaign's dialer mode + AMD setting so the client can drive
// per-call behavior (especially for ALL_ACTIVE which dials across many
// campaigns each with its own mode). Falls back to power+AMD-on if not set.
async function fetchCampaignMode(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('dialer_mode, amd_enabled')
    .eq('id', campaignId)
    .maybeSingle()
  return {
    dialer_mode: (data?.dialer_mode as string) || 'power',
    amd_enabled: data?.amd_enabled !== false,
  }
}

/**
 * The agent_sessions row id for this agent, used as the claim owner.
 *
 * Claims are a LEASE, not a lock: claim_next_lead_across_campaigns only
 * considers a lead taken for 30 seconds, and the heartbeat renews the lease
 * every 5 seconds for as long as the agent is live. That combination is what
 * makes a crashed browser release its lead automatically while a three-minute
 * conversation keeps hold of one — dial_attempts is not incremented until the
 * call ENDS, so without renewal a long call would expire its own claim and
 * another agent could dial the person it was already talking to.
 *
 * Falls back to a random id if no session exists yet. In practice the dialer
 * heartbeats before it can dial, so this is the cold-start case only; the
 * consequence is simply that the claim is not renewable and expires normally.
 */
/** The columns of `leads` this route actually reads off a claimed row. */
interface ClaimedLead {
  id: string
  phone: string | null
  state: string | null
  campaign_id: string
  [key: string]: unknown
}

async function resolveAgentSessionId(clerkId: string): Promise<string> {
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (userRow?.id) {
    const { data: session } = await supabaseAdmin
      .from('agent_sessions')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle()
    if (session?.id) return session.id
  }

  console.warn(`[leads/next] no agent_session for ${clerkId} — claim will not be renewable`)
  return crypto.randomUUID()
}

export async function GET(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const user_id = gate.userId

    // Resolved once per request and passed into every isCallableNow below —
    // both the team path and the personal path. False for any account not on
    // the allowlist in lib/callingWindowOverride.ts, and on any lookup error.
    const overrideWindow = await hasCallingWindowOverride(user_id)

    const { searchParams } = new URL(req.url)
    const campaign_id = searchParams.get('campaign_id')
    const team_id = searchParams.get('team_id')
    // Optional allowlist of lead ids — set by the dialer's queue panel when
    // the agent has an active FILTER (name/phone/state) applied. When
    // present, dialing is restricted to exactly these leads, so what's
    // actually dialed matches what the filtered queue is showing, not the
    // full unfiltered pool. Comma-separated; capped so a pathological huge
    // list can't blow up the query.
    const leadIdsParam = searchParams.get('lead_ids')
    const leadIdAllowlist = leadIdsParam !== null
      ? leadIdsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200)
      : null

    // ── TEAM SCOPE ──
    if (team_id) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id, owner_id')
        .eq('id', team_id)
        .maybeSingle()

      if (!team) {
        return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
      }

      const isOwner = team.owner_id === user_id
      if (!isOwner) {
        const { data: membership } = await supabaseAdmin
          .from('team_members')
          .select('id')
          .eq('team_id', team_id)
          .eq('user_id', user_id)
          .eq('status', 'active')
          .maybeSingle()
        if (!membership) {
          return NextResponse.json({ success: false, error: 'Not a member of this team' }, { status: 403 })
        }
      }

      const { data: tcRows } = await supabaseAdmin
        .from('team_campaigns')
        .select('campaign_id, campaigns(status)')
        .eq('team_id', team_id)

      const teamCampaignIds = (tcRows || [])
        .filter((tc: any) => tc.campaigns?.status === 'active')
        .map((tc: any) => tc.campaign_id)

      if (teamCampaignIds.length === 0) {
        return NextResponse.json({ success: false, error: 'No active campaigns in team' }, { status: 404 })
      }

      let scopedCampaignIds: string[]
      if (campaign_id && campaign_id !== 'all') {
        if (!teamCampaignIds.includes(campaign_id)) {
          return NextResponse.json({ success: false, error: 'Campaign not in team' }, { status: 403 })
        }
        scopedCampaignIds = [campaign_id]
      } else {
        scopedCampaignIds = teamCampaignIds
      }

      // ── ATOMIC CLAIM ──────────────────────────────────────────────────
      // This used to be a plain SELECT that returned the top lead and marked
      // nothing. Fine for one agent; broken for a team. Nothing in the
      // codebase wrote claimed_at and nothing filtered on it, so every agent
      // sharing a campaign was handed the SAME lead — not as a race, but
      // deterministically, because the ordering is stable. The prospect got
      // simultaneous calls from several different numbers, which is a bad
      // experience and real TCPA exposure.
      //
      // claim_next_lead_across_campaigns claims a batch with FOR UPDATE SKIP
      // LOCKED, so concurrent agents are handed different rows instead of
      // blocking on each other. We claim a batch rather than one row because
      // the top lead may be outside its calling window — we need candidates
      // to fall through to, and we release every one we don't use.
      const sessionId = await resolveAgentSessionId(user_id)

      const { data: claimedRaw, error: claimErr } = await supabaseAdmin.rpc(
        'claim_next_lead_across_campaigns',
        {
          p_campaign_ids: scopedCampaignIds,
          p_session_id: sessionId,
          p_lead_ids: leadIdAllowlist,
          p_limit: leadIdAllowlist ? Math.min(200, Math.max(CANDIDATE_LIMIT, leadIdAllowlist.length)) : CANDIDATE_LIMIT,
        }
      )

      if (claimErr) {
        return apiError(claimErr, { route: 'leads/next' })
      }

      // The RPC already returns them in the client's requested order when an
      // allowlist was sent, and in dial_attempts/created_at priority otherwise
      // — the ordering that used to be re-done in JS here now lives in SQL,
      // where it has to be anyway for the claim to pick the right rows.
      const orderedCandidates = (claimedRaw || []) as ClaimedLead[]

      let callable: ClaimedLead | null = null
      let blockReason: string | null = null
      const toRelease: string[] = []
      // Counts every refusal rather than keeping the first. See
      // lib/queueDiagnosis — reporting only the first reason is how a queue of
      // broken phone numbers came to be described as "outside calling hours".
      const diagnosis = new QueueDiagnosisBuilder()

      // Cache per campaign — a team queue spans several, and this loop can
      // run over a few hundred candidates.
      const capCache = new Map<string, number>()
      const capFor = async (cid: string | null | undefined): Promise<number> => {
        const key = cid || '-'
        if (!capCache.has(key)) capCache.set(key, await attemptCapFor(cid))
        return capCache.get(key)!
      }

      for (const c of orderedCandidates) {
        if (callable) { toRelease.push(c.id); continue }

        // Refuse before the calling-window check, because an over-dialed lead
        // is not a "try again later" case — it is finished.
        if (attemptsExhausted((c as { dial_attempts?: number }).dial_attempts,
                              await capFor((c as { campaign_id?: string }).campaign_id))) {
          console.warn(
            `[leads/next] refusing lead ${c.id} — ${(c as { dial_attempts?: number }).dial_attempts} attempts ` +
            `is at or past its campaign cap. If the client asked for this, the client is out of sync.`
          )
          toRelease.push(c.id)
          continue
        }

        const result = isCallableNow({ phone: c.phone ?? '', state: c.state }, { overrideWindow })
        if (result.allowed) { callable = c; continue }
        if (!blockReason) blockReason = result.reason || null
        diagnosis.add(result.code, c.phone ?? undefined)
        toRelease.push(c.id)
      }

      // Hand back everything we claimed and aren't dialing, immediately —
      // otherwise a single request would lock up to CANDIDATE_LIMIT leads for
      // the full 30-second TTL and starve every other agent on the floor.
      if (toRelease.length > 0) {
        void supabaseAdmin
          .from('leads')
          .update({ claimed_at: null, claimed_by_session_id: null })
          .in('id', toRelease)
          .then(undefined, (e: unknown) => console.error('[leads/next] claim release failed', e))
      }

      if (!callable) {
        // Distinguish between "no leads" and "all leads outside callable window".
        // Surface the REAL reason from isCallableNow (e.g. "Unknown state —
        // cannot determine calling window", a Sunday-calling restriction, or an
        // actual too-early/too-late window) instead of a hardcoded 8am-9pm
        // message that's misleading when the true cause is something else.
        const hasAnyCandidates = orderedCandidates.length > 0
        const summary = diagnosis.build()
        return NextResponse.json({
          success: false,
          error: hasAnyCandidates
            ? summary.summary
            : 'No leads left to dial in this team’s campaigns.',
          // The single most specific reason, for the per-row outcome chip.
          detail: blockReason ?? undefined,
          // Full breakdown so the UI can show every reason, not just the top one.
          diagnosis: hasAnyCandidates ? summary : undefined,
          // Only true when waiting actually helps. Broken numbers never become
          // dialable, so promising "dialing will resume" would be a lie.
          tcpaBlocked: hasAnyCandidates && summary.waitingOnClock,
        }, { status: 404 })
      }

      const campaign = await fetchCampaignMode(callable.campaign_id)
      return NextResponse.json({ success: true, lead: callable, campaign })
    }

    // ── PERSONAL SCOPE ──
    const { data: activeCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'active')

    const activeCampaignIds = activeCampaigns?.map(c => c.id) || []

    // If the client asked for a specific campaign, check THAT campaign's
    // status directly rather than only checking "does this user have any
    // active campaign at all". Previously, requesting a specific inactive
    // campaign_id while the user had zero active campaigns produced the
    // generic 'No active campaigns' message (fine), but if the user had a
    // DIFFERENT active campaign, the code silently queried leads under the
    // requested (inactive) campaign anyway — worse, if that campaign had no
    // matching leads it surfaced as 'No more leads', which reads exactly like
    // the campaign is exhausted rather than simply turned off.
    if (campaign_id && campaign_id !== 'all' && !activeCampaignIds.includes(campaign_id)) {
      const { data: requested } = await supabaseAdmin
        .from('campaigns')
        .select('id, status, user_id')
        .eq('id', campaign_id)
        .maybeSingle()

      if (!requested || requested.user_id !== user_id) {
        return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: false,
        error: `Campaign is ${requested.status || 'inactive'}, not active. Turn it on to start dialing.`,
      }, { status: 404 })
    }

    if (activeCampaignIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No active campaigns' }, { status: 404 })
    }

    // See the team-scope query above for why this can't just use
    // CANDIDATE_LIMIT when an allowlist is present.
    const effectiveLimit = leadIdAllowlist ? Math.max(CANDIDATE_LIMIT, leadIdAllowlist.length) : CANDIDATE_LIMIT

    let query = supabaseAdmin
      .from('leads')
      .select('*, extra_data')
      .eq('user_id', user_id)
      // Dialable statuses come from lib/dialableLead.ts, the same definition
      // /api/leads/list?disposition=queue uses to build the panel — so the
      // displayed queue and the dial order describe the same set of leads.
      // They used to be maintained separately here and there, and drifted.
      .in('status', DIALABLE_STATUSES as unknown as string[])
      .not('phone', 'is', null)
      .neq('phone', '')
      .order('dial_attempts', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(effectiveLimit)

    if (campaign_id && campaign_id !== 'all') {
      query = query.eq('campaign_id', campaign_id)
    } else {
      query = query.in('campaign_id', activeCampaignIds)
    }

    if (leadIdAllowlist) {
      if (leadIdAllowlist.length === 0) {
        return NextResponse.json({ success: false, error: 'No leads match the current filter', tcpaBlocked: false }, { status: 404 })
      }
      query = query.in('id', leadIdAllowlist)
    }

    const { data: candidates, error } = await query

    if (error) {
      return apiError(error, { route: 'leads/next' })
    }

    // Same reordering as the team-scope branch above — when lead_ids came
    // in with a specific order (queue panel filter/shuffle), dial in that
    // exact order rather than the database's own dial_attempts/created_at
    // sort, which Supabase's .in() doesn't override on its own.
    let orderedPersonalCandidates = candidates || []
    if (leadIdAllowlist) {
      const positionById = new Map(leadIdAllowlist.map((id, idx) => [id, idx]))
      orderedPersonalCandidates = [...orderedPersonalCandidates].sort((a, b) => {
        const posA = positionById.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const posB = positionById.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return posA - posB
      })
    }

    // Filter to only leads currently inside their local TCPA window, keeping
    // the real reason for the first blocked lead so a data problem (missing
    // state, unrecognized area code) isn't misreported as a time-of-day issue.
    let callable: any = null
    let blockReason: string | null = null
    const personalDiagnosis = new QueueDiagnosisBuilder()
    for (const c of orderedPersonalCandidates) {
      // Belt-and-braces against the status query above: isDialableLead also
      // rejects the retiring dispositions (DO NOT CALL / NOT INTERESTED /
      // CLOSED), which the status filter alone would miss for any row whose
      // status and disposition disagree. Same predicate the queue panel is
      // built from, so a lead can never be shown as next-up here and
      // rejected there.
      if (!isDialableLead(c)) continue

      // Same ceiling as the team branch. See the comment on attemptCapFor:
      // status filtering cannot catch a client that re-dials faster than the
      // webhook can mark the lead maxed.
      if (attemptsExhausted(c.dial_attempts, await attemptCapFor(c.campaign_id))) {
        console.warn(
          `[leads/next] refusing lead ${c.id} — ${c.dial_attempts} attempts is at or ` +
          `past its campaign cap. If the client asked for this, the client is out of sync.`
        )
        continue
      }

      const result = isCallableNow({ phone: c.phone, state: c.state }, { overrideWindow })
      if (result.allowed) { callable = c; break }
      if (!blockReason) blockReason = result.reason || null
      personalDiagnosis.add(result.code, c.phone ?? undefined)
    }

    if (!callable) {
      const hasAnyCandidates = (candidates?.length || 0) > 0
      const summary = personalDiagnosis.build()
      return NextResponse.json({
        success: false,
        error: hasAnyCandidates
          ? summary.summary
          : 'No leads left to dial in this campaign.',
        detail: blockReason ?? undefined,
        diagnosis: hasAnyCandidates ? summary : undefined,
        tcpaBlocked: hasAnyCandidates && summary.waitingOnClock,
      }, { status: 404 })
    }

    const campaign = await fetchCampaignMode(callable.campaign_id)
    return NextResponse.json({ success: true, lead: callable, campaign })
  } catch (error: any) {
    return apiError(error, { route: 'leads/next' })
  }
}