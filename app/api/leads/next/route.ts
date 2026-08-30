import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { isCallableNow } from '@/lib/callingWindow'
import { hasCallingWindowOverride } from '@/lib/callingWindowOverride'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'
import { shouldMaskCampaign, maskLeadRow } from '@/lib/leadMasking'
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
// WHY THERE IS NO ATTEMPT-COUNT GUARD HERE
// =============================================================================
// One was added and immediately removed. It refused any lead whose
// dial_attempts had reached its campaign's dial_repeat_count, and it blocked
// dialing outright:
//
//   refusing lead 019e3e56... — 1 attempts is at or past its campaign cap
//
// The two numbers measure different things. dial_repeat_count is how many
// times to redial a lead IN A ROW before moving on. dial_attempts is a
// LIFETIME counter. Comparing them means a lead dialed once last week is
// refused forever, and on a campaign set to 1x the entire list dies after one
// pass.
//
// The correct gate already exists and always did: bumpLeadAttemptAndRelease
// writes status='maxed' when a lead genuinely exhausts its retries, and
// isDialableLead excludes it. Status is the authoritative signal for "this
// lead is finished" — a raw count is not, because only the bumper knows how
// many of those attempts belong to the current pass.
//
// The over-dialing this was meant to stop (26 people, 224 calls, nine to one
// person inside a minute) is a CLIENT-side multiplication: the dialer runs its
// own retry loop that redials the same lead effectiveMax times per server
// attempt, so client retries multiply against server passes. It has to be
// fixed where the multiplication happens, not by second-guessing the queue.
// =============================================================================

// Fetch the campaign's dialer mode + AMD setting so the client can drive
// per-call behavior (especially for ALL_ACTIVE which dials across many
// campaigns each with its own mode).
//
// The fallback only fires when the campaign row is gone, since dialer_mode is
// NOT NULL. It used to read power+AMD-on, which contradicted itself: this
// codebase treats AMD as the only thing separating power from progressive, so
// that pairing already WAS progressive, spelled wrong.
async function fetchCampaignMode(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('dialer_mode, amd_enabled')
    .eq('id', campaignId)
    .maybeSingle()
  return {
    dialer_mode: (data?.dialer_mode as string) || 'progressive',
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

// Served over BOTH verbs — see the exports at the bottom of this file for why.
async function handleNextLead(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const user_id = gate.userId

    // Resolved once per request and passed into every isCallableNow below —
    // both the team path and the personal path. False for any account not on
    // the allowlist in lib/callingWindowOverride.ts, and on any lookup error.
    const overrideWindow = await hasCallingWindowOverride(user_id)

    const { searchParams } = new URL(req.url)
    let campaign_id = searchParams.get('campaign_id')
    let team_id = searchParams.get('team_id')

    // ── THE ORDERED ALLOWLIST ────────────────────────────────────────────
    // The dialer's queue panel sends its ENTIRE displayed order here, and the
    // server dials the first entry in it that is actually dialable right now.
    // That is what makes "what gets dialed" match "what is shown", including
    // the panel's search, sort and rotation — none of which the server can
    // reconstruct on its own.
    //
    // THIS USED TO BE TRUNCATED TO THE FIRST 200 IDS. That looked harmless,
    // because dialing only ever wants the top of the list. It is not: if every
    // one of the top 200 is outside its own calling window — which is normal
    // for a list grouped by region early in the morning, and uploads are
    // usually grouped by region — the server correctly finds nothing among the
    // 200 it was given and reports "no leads", while thousands of dialable
    // leads sit at position 201 and beyond. A silent stall that looks exactly
    // like an empty queue.
    //
    // The truncation existed because the ids travelled in a query string and
    // a few thousand UUIDs overflow it. So the list now comes in a POST body
    // instead, and nothing is dropped.
    let leadIdsRaw: string[] | null = null
    const leadIdsParam = searchParams.get('lead_ids')
    if (leadIdsParam !== null) leadIdsRaw = leadIdsParam.split(',')

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      if (body && typeof body === 'object') {
        if (typeof body.campaign_id === 'string') campaign_id = body.campaign_id
        if (typeof body.team_id === 'string') team_id = body.team_id
        // Accepts an array (what the dialer sends) or the same comma-joined
        // string the query-string form used, so a caller can move to POST
        // without also changing how it encodes the list.
        if (Array.isArray(body.lead_ids)) leadIdsRaw = body.lead_ids.map(String)
        else if (typeof body.lead_ids === 'string') leadIdsRaw = body.lead_ids.split(',')
      }
    }

    // A circuit breaker, NOT a product limit. Nothing on this path should ever
    // approach it — it exists so a malformed caller cannot hand Postgres an
    // unbounded array to run array_position against, which is O(n) per row.
    // If a real queue ever gets near this, the ordering strategy needs
    // rethinking, not a bigger number.
    const ALLOWLIST_CIRCUIT_BREAKER = 25_000
    const leadIdAllowlist = leadIdsRaw !== null
      ? leadIdsRaw.map(s => String(s).trim()).filter(Boolean).slice(0, ALLOWLIST_CIRCUIT_BREAKER)
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

      for (const c of orderedCandidates) {
        if (callable) { toRelease.push(c.id); continue }
        const result = isCallableNow({ phone: c.phone ?? '', state: c.state }, { overrideWindow })
        if (result.allowed) { callable = c; continue }
        if (!blockReason) blockReason = result.reason || null
        diagnosis.add(result.code, c.phone ?? undefined)
        toRelease.push(c.id)
      }

      // Hand back everything we claimed and aren't dialing, immediately —
      // otherwise a single request would lock up to CANDIDATE_LIMIT leads for
      // the full 30-second TTL and starve every other agent on the floor.
      //
      // AWAITED, not fired and forgotten. This was `void`, which on Vercel means
      // the instance may freeze the moment the response returns and the update
      // never reaches Postgres — producing exactly the starvation the paragraph
      // above says it prevents, and only under load, because that is when there
      // are enough concurrent requests for the leaked claims to add up.
      //
      // The cost is one indexed UPDATE on the hot path. That is worth paying:
      // a few milliseconds per request against a floor of agents watching an
      // empty queue while the leads sit claimed by nobody.
      if (toRelease.length > 0) {
        const { error: releaseErr } = await supabaseAdmin
          .from('leads')
          .update({ claimed_at: null, claimed_by_session_id: null })
          .in('id', toRelease)
        // Not fatal — the 30-second TTL reclaims them anyway. Logged because a
        // persistent failure here shows up as a queue that mysteriously thins
        // out under load, which is near-impossible to diagnose from the outside.
        if (releaseErr) console.error('[leads/next] claim release failed', releaseErr)
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

      // ── THE NUMBER STAYS ON THE SERVER ──────────────────────────────────
      // On a campaign set to hide numbers, the real one never leaves here —
      // not even alongside a masked copy, because a value in the network
      // response is a value anyone who opens devtools can read, and that is
      // precisely the person this exists to stop. /api/calls/outbound resolves
      // the number from the lead id instead, so dialing is unaffected.
      const maskThis = await shouldMaskCampaign(callable.campaign_id, user_id)
      return NextResponse.json({
        success: true,
        lead: maskThis ? maskLeadRow(callable) : callable,
        campaign,
      })
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

    // ── THE ALLOWLIST GOES IN THE URL, AND URLS RUN OUT ─────────────────────
    // supabase-js sends `.in('id', [...])` as a query string — `id=in.(uuid,
    // uuid, ...)`. Each uuid costs 37 characters, so a panel showing 848 leads
    // built a ~31KB request line and PostgREST rejected the whole thing with a
    // bare 400 Bad Request. The dialer surfaced that as "dialing isn't
    // working", with nothing naming a length limit anywhere.
    //
    // This is not a predictive problem. /api/leads/next is the shared dial path
    // for every mode, so importing a few hundred leads broke preview, power,
    // progressive and predictive at once — the failure had nothing to do with
    // whichever mode happened to be selected. It appeared the moment the old
    // 200-id cap was lifted, which had been hiding the limit rather than
    // respecting it.
    //
    // Chunked, and walked IN PANEL ORDER, which also makes it cheaper than what
    // it replaces: the previous version raised the row limit to the size of the
    // whole allowlist and pulled every matching lead back just to reorder them
    // in memory. The panel's earliest rows live in the first chunk, so the
    // common case now answers from one small query and stops.
    const ID_CHUNK_SIZE = 150

    // ── THE CHUNK COMES BACK WHOLE, OR THE ORDER IS A LIE ───────────────────
    // A chunk is queried with a row limit, and the database applies that limit
    // using ITS OWN ordering (dial_attempts, then created_at) — not the panel's.
    // With a 150-id chunk and a limit of 50, it discarded 100 rows before the
    // panel order was ever applied, so on a newest-first or shuffled panel it
    // handed back the OLDEST rows of the top 150. The reorder below then picked
    // the best of an already-wrong subset, and dialing started in the middle of
    // the list and walked down correctly from there — which is exactly what it
    // looked like.
    //
    // A chunk is 150 rows. Fetching all of them costs nothing and is the only
    // way the panel-position sort below can see the true top row.
    const buildQuery = (idChunk: string[] | null, rowLimit: number) => {
      let q = supabaseAdmin
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
        .limit(rowLimit)

      if (campaign_id && campaign_id !== 'all') {
        q = q.eq('campaign_id', campaign_id)
      } else {
        q = q.in('campaign_id', activeCampaignIds)
      }

      if (idChunk) q = q.in('id', idChunk)
      return q
    }

    let candidates: any[] = []

    if (leadIdAllowlist) {
      if (leadIdAllowlist.length === 0) {
        return NextResponse.json({ success: false, error: 'No leads match the current filter', tcpaBlocked: false }, { status: 404 })
      }

      for (let i = 0; i < leadIdAllowlist.length; i += ID_CHUNK_SIZE) {
        const chunk = leadIdAllowlist.slice(i, i + ID_CHUNK_SIZE)
        // Whole chunk, never a slice of it — see buildQuery.
        const { data, error } = await buildQuery(chunk, chunk.length)
        if (error) {
          return apiError(error, { route: 'leads/next' })
        }
        candidates.push(...(data || []))
        // Chunks are walked in panel order, so ANY dialable lead in this chunk
        // outranks everything in every later chunk. Stop at the first chunk
        // that yields something — going further could only add rows that sort
        // below what we already have.
        if (candidates.length > 0) break
      }

      // ── THE WINDOW MUST NEVER BE ABLE TO STALL DIALING ──────────────────
      // The client now sends only the top of the panel's order rather than all
      // of it, because a 100,000-lead All Active book cannot be shipped every
      // five seconds. That reintroduces the exact hazard the old 200-id cap
      // had: on a region-grouped list the entire window can be outside its
      // calling window, and reporting "no leads" while thousands of dialable
      // ones sit below the cut is the worst possible answer.
      //
      // So an empty result from the allowlist is treated as "the window was
      // not representative" rather than as an answer. Falling back to the
      // unconstrained query gives up panel ORDER for this one dial — the
      // server's own dial_attempts/created_at ordering takes over — which is a
      // far better failure than a dialer that stops.
      if (candidates.length === 0) {
        const { data, error } = await buildQuery(null, CANDIDATE_LIMIT)
        if (error) {
          return apiError(error, { route: 'leads/next' })
        }
        candidates = data || []
      }
    } else {
      const { data, error } = await buildQuery(null, CANDIDATE_LIMIT)
      if (error) {
        return apiError(error, { route: 'leads/next' })
      }
      candidates = data || []
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

// ── BOTH VERBS, ONE HANDLER ─────────────────────────────────────────────────
// POST is the one the dialer uses: the ordered allowlist is the agent's whole
// visible queue, and a few thousand UUIDs do not fit in a URL. Sending them in
// a body is what let the 200-id truncation go away.
//
// GET stays because it was the only form for the life of this route, it is
// harmless, and a read with no body is a perfectly reasonable way to ask for
// the next lead. Removing it would break any caller still using it for no
// benefit — the handler is identical either way.
export async function GET(req: Request) {
  return handleNextLead(req)
}

export async function POST(req: Request) {
  return handleNextLead(req)
}