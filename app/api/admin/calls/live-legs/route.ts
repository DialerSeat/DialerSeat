import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { listLiveLegs, killLegs } from '@/lib/liveLegs'

const supabase = getServiceClient('admin/live-legs')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/calls/live-legs — see what is actually up, and end it by hand
// =============================================================================
// The manual override for when automatic teardown misses one. Three things
// already end a call: the hangup webhook, the AMD verdict path, and the stale
// call reaper. All three have failed at some point here, and the symptom is
// expensive rather than quiet — a leg nobody is on bills by the minute until
// somebody notices, which is what a report of 100 legs in flight at 400 to 500
// seconds each looks like from the balance side.
//
// GET lists every leg Telnyx reports on the connection. POST ends the ones it
// is given, or every leg older than a stated age.
//
// See lib/liveLegs.ts for why the list starts at the carrier rather than at our
// calls table: the leg worth worrying about is the one our table has already
// lost track of, and that leg is invisible to any view built from our rows.
// =============================================================================

/** How far back to look for calls rows to attach to the carrier's legs. */
const CORRELATION_WINDOW_HOURS = 12

// ── THE ID GOES INTO A URL PATH ────────────────────────────────────────────
// hangupCallControlId builds .../v2/calls/${id}/actions/hangup by
// interpolation, without encoding. Everything that reached it before came from
// our own database; this route is the first to hand it a string out of a
// request body, so the shape is checked here rather than trusted there.
//
// A slash is the one that matters: it would walk the request to a different
// Telnyx endpoint entirely. Real ids are 36 to 57 characters of base64url plus
// a "v3:" prefix — "v3:ZzMzTf-NN7cjpZp7cqJMH32b-xeow9psbhxPA2VizQhGUZp4UnRrPg"
// — so the colon has to be allowed and nothing that changes a path does.
const CALL_CONTROL_ID = /^[A-Za-z0-9_=.:-]{16,128}$/

// ── A FLOOR UNDER THE AGE SWEEP ────────────────────────────────────────────
// What this is for is legs that are open and INACTIVE. Zero would mean every
// leg with a known age, which is every live conversation on the floor, and
// that is a fat-finger away from hanging up on every agent at once. Anything
// newer than this is ended individually by id, deliberately one at a time.
const MIN_SWEEP_AGE_SECONDS = 30

async function correlationRows() {
  const since = new Date(Date.now() - CORRELATION_WINDOW_HOURS * 60 * 60_000).toISOString()
  const { data } = await supabase
    .from('calls')
    .select('call_control_id, agent_call_control_id, created_at, phone_number, user_id')
    .gte('created_at', since)
    .or('call_control_id.not.is.null,agent_call_control_id.not.is.null')
    .limit(20000)

  // ── ONE DIAL IS TWO LEGS ──────────────────────────────────────────────
  // A call row carries both: call_control_id is the lead and
  // agent_call_control_id is the browser. Telnyx lists them as two separate
  // entries, because on the connection they ARE two, which is also why a
  // user dial uses two of the concurrency budget.
  //
  // Both are indexed to the same row. Keying on the lead alone would have
  // reported every agent leg as orphaned, which is the one label on this
  // screen that is supposed to mean something is wrong.
  const map = new Map<string, {
    created_at: string; phone_number: string | null; user_id: string | null; leg: 'lead' | 'agent'
  }>()
  for (const r of (data || []) as Array<{
    call_control_id: string | null; agent_call_control_id: string | null
    created_at: string; phone_number: string | null; user_id: string | null
  }>) {
    const base = { created_at: r.created_at, phone_number: r.phone_number, user_id: r.user_id }
    if (r.call_control_id) map.set(r.call_control_id, { ...base, leg: 'lead' })
    if (r.agent_call_control_id) map.set(r.agent_call_control_id, { ...base, leg: 'agent' })
  }
  return map
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const result = await listLiveLegs(await correlationRows())
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return apiError(err, { route: 'admin/calls/live-legs' })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const ids: unknown = body?.callControlIds
    const olderThan: unknown = body?.olderThanSeconds

    // ── ONE EXPLICIT TARGET, NEVER AN IMPLICIT ONE ────────────────────────
    // No "kill everything" default. This endpoint ends live phone calls, and a
    // request that forgot to say which ones must fail rather than guess.
    if (Array.isArray(ids) && ids.length > 0) {
      const wanted = ids.filter((i): i is string => typeof i === 'string' && CALL_CONTROL_ID.test(i))
      if (wanted.length !== ids.length) {
        // Refused rather than filtered: a caller that sent a malformed id is a
        // caller whose request was not what they thought it was, and quietly
        // ending the subset that happened to parse is worse than ending none.
        return NextResponse.json(
          { success: false, error: 'One or more callControlIds are not valid call control ids' },
          { status: 400 }
        )
      }
      const results = await killLegs(wanted)
      return NextResponse.json({
        success: true,
        requested: wanted.length,
        ended: results.filter(r => r.ended).length,
        results,
      })
    }

    if (typeof olderThan === 'number' && Number.isFinite(olderThan)) {
      if (olderThan < MIN_SWEEP_AGE_SECONDS) {
        return NextResponse.json(
          {
            success: false,
            error: `olderThanSeconds must be at least ${MIN_SWEEP_AGE_SECONDS}. `
              + 'End anything newer by id, one at a time.',
          },
          { status: 400 }
        )
      }
      const { legs, authoritative, error } = await listLiveLegs(await correlationRows())
      if (!authoritative) {
        // Refusing rather than proceeding on an empty list: "Telnyx did not
        // answer" and "nothing is live" are the same empty array, and only one
        // of them means the job is done.
        return NextResponse.json(
          { success: false, error: error || 'Could not reach Telnyx to list legs' },
          { status: 503 }
        )
      }
      // A leg whose age is unknown is NOT swept. It has no calls row, so it
      // may be seconds old, and an age filter that silently includes the
      // unmeasured is an age filter that kills live conversations. Those are
      // listed by GET and can be ended explicitly by id.
      const targets = legs.filter(l => l.ageSeconds !== null && l.ageSeconds >= olderThan)
      const results = await killLegs(targets.map(l => l.callControlId))
      return NextResponse.json({
        success: true,
        olderThanSeconds: olderThan,
        requested: targets.length,
        ended: results.filter(r => r.ended).length,
        skippedUnknownAge: legs.filter(l => l.ageSeconds === null).length,
        results,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Provide callControlIds[] or olderThanSeconds' },
      { status: 400 }
    )
  } catch (err) {
    return apiError(err, { route: 'admin/calls/live-legs' })
  }
}
