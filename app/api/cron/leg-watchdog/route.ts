import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'
import { listLiveLegs, killLegs } from '@/lib/liveLegs'
import { getPlatformConfig } from '@/lib/platformConfig'
import { classifyLeg, summariseSweep, type WatchdogThresholds, type WatchdogVerdict } from '@/lib/legWatchdog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// LEG WATCHDOG — the leg nobody is on, found from the carrier's side
// =============================================================================
// The stale-call reaper covers the case where an agent's browser dies holding a
// call. This covers the case it structurally cannot see: a leg Telnyx has up
// that our `calls` table has already closed, or never knew about. Both bill by
// the minute, and neither appears in any query over our own rows — which is the
// entire reason there was once a report of 100 legs in flight at 400-500
// seconds each with the balance draining behind them.
//
// Runs every two minutes. The whole point is to catch a runaway inside the
// billing minute it starts, not after lunch.
//
// ── OBSERVATION AND TEARDOWN ARE SEPARATE SWITCHES ─────────────────────────
// leg_watchdog_enabled gates THE HANGUP ONLY. Sightings are recorded and
// verdicts are computed either way, so the table fills with exactly the
// evidence needed to judge whether turning it on is safe — and so that turning
// it off does not blind the thing that would tell you it was needed.
//
// It ships OFF. A cron that hangs up phone calls should earn its way on with a
// few days of "here is what I would have ended" first.
//
// See lib/legWatchdog.ts for the rules and why each is safe. Everything that
// decides is pure and unit-tested; this file only fetches, applies and records.
// =============================================================================

/** Matches the manual live-legs view, so both agree on what "untracked" means. */
const CORRELATION_WINDOW_HOURS = 12

/** How long a sighting outlives the leg, as the audit trail for a teardown. */
const SIGHTING_RETENTION_HOURS = 48

interface CorrelatedRow {
  createdAt: string
  duration: number | null
  disposition: string | null
  phone: string | null
  userId: string | null
}

// ── HOW LONG BEFORE AN OPEN ROW IS PRESUMED DEAD ────────────────────────
// Only applied to rows whose legs are absent from an authoritative live list,
// so this is not really a liveness guess — it is headroom for the ordinary
// race where a call has just been placed and the hangup event is still in
// flight. Ninety seconds is far longer than that gap and far shorter than
// leaving a phantom call on screen.
const CLOSE_ORPHAN_ROW_SECONDS = 90

async function correlationRows(db: ReturnType<typeof getServiceClient>) {
  const since = new Date(Date.now() - CORRELATION_WINDOW_HOURS * 60 * 60_000).toISOString()
  const { data } = await db
    .from('calls')
    .select('call_control_id, agent_call_control_id, created_at, phone_number, user_id, duration, disposition')
    .gte('created_at', since)
    .or('call_control_id.not.is.null,agent_call_control_id.not.is.null')
    .limit(20000)

  // One dial is two legs, and both are indexed to the same row — keying on the
  // lead alone would report every agent leg as untracked, which is the one
  // label here that is supposed to mean something is wrong.
  const map = new Map<string, CorrelatedRow>()
  for (const r of (data || []) as Array<{
    call_control_id: string | null; agent_call_control_id: string | null
    created_at: string; phone_number: string | null; user_id: string | null
    duration: number | null; disposition: string | null
  }>) {
    const v: CorrelatedRow = {
      createdAt: r.created_at, duration: r.duration, disposition: r.disposition,
      phone: r.phone_number, userId: r.user_id,
    }
    if (r.call_control_id) map.set(r.call_control_id, v)
    if (r.agent_call_control_id) map.set(r.agent_call_control_id, v)
  }
  return map
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/leg-watchdog')
    const cfg = await getPlatformConfig()

    const thresholds: WatchdogThresholds = {
      enabled: cfg.leg_watchdog_enabled,
      runawaySeconds: cfg.leg_watchdog_runaway_seconds,
      untrackedSeconds: cfg.leg_watchdog_untracked_seconds,
      finishedSeconds: cfg.leg_watchdog_finished_seconds,
    }

    const rows = await correlationRows(db)
    const { legs, authoritative, error } = await listLiveLegs(
      // listLiveLegs only needs these three fields; the finish state is read
      // from `rows` directly below.
      new Map([...rows].map(([id, r]) => [id, {
        created_at: r.createdAt, phone_number: r.phone, user_id: r.userId,
      }]))
    )

    // ── AN UNREACHABLE CARRIER IS NOT AN EMPTY FLOOR ──────────────────────
    // "Telnyx did not answer" and "nothing is live" are the same empty array.
    // Acting on the first as if it were the second would mean the watchdog
    // reports all-clear precisely when it has no idea, and would let sightings
    // expire for legs that are still up.
    if (!authoritative) {
      return NextResponse.json({
        success: false,
        skipped: 'carrier unreachable',
        error: error || 'Could not reach Telnyx',
      }, { status: 503 })
    }

    const now = Date.now()
    const liveIds = legs.map(l => l.callControlId)

    // ── A CALL NOBODY WILL EVER CLOSE ─────────────────────────────────────
    // Two jobs were watching legs and neither closed a row. This watchdog
    // hangs up legs that are LIVE at Telnyx past their thresholds, and the
    // stale-call reaper frees an agent_sessions row when a heartbeat dies.
    // Between them sits the case that actually happened: the leg is gone, the
    // agent is still online, and no hangup event ever arrived — so the calls
    // row stays duration 0 with no hangup_cause, forever. It shows as a live
    // call on screen and counts as one to anything reading that shape.
    //
    // Safe to decide here and nowhere else, because this is the one place
    // holding an AUTHORITATIVE list of what Telnyx currently has up — the
    // request already returned 503 above if that list could not be fetched.
    // Without that guarantee this would close every open row the moment
    // Telnyx was unreachable, ending calls on screen while people were still
    // talking on them.
    const liveIdSet = new Set(liveIds)
    const closableBefore = new Date(now - CLOSE_ORPHAN_ROW_SECONDS * 1000).toISOString()

    const { data: openRows } = await db
      .from('calls')
      .select('id, call_control_id, agent_call_control_id, created_at')
      .is('hangup_cause', null)
      .or('duration.is.null,duration.eq.0')
      .lt('created_at', closableBefore)
      .gte('created_at', new Date(now - CORRELATION_WINDOW_HOURS * 60 * 60_000).toISOString())
      .limit(500)

    const orphanRowIds = (openRows || [])
      .filter(r => {
        // Untracked rows carry no leg id at all, so there is nothing to check
        // them against and nothing this can safely conclude. Left alone.
        const ids = [r.call_control_id, r.agent_call_control_id].filter(Boolean) as string[]
        if (ids.length === 0) return false
        // Open at Telnyx on either half means the call is real and ongoing;
        // the threshold logic further down owns that case, not this one.
        return !ids.some(id => liveIdSet.has(id))
      })
      .map(r => r.id)

    if (orphanRowIds.length > 0) {
      const { error: closeErr } = await db
        .from('calls')
        .update({
          // Distinct from a carrier cause on purpose. These are rows closed
          // by inference rather than by an event, and a rising count is a
          // signal that hangup webhooks are being missed.
          hangup_cause: 'orphaned_no_hangup_event',
          hangup_source: 'leg_watchdog',
        })
        .in('id', orphanRowIds)
      if (closeErr) {
        console.error('[leg-watchdog] could not close orphaned rows:', closeErr.message)
      } else {
        console.warn(
          `[leg-watchdog] closed ${orphanRowIds.length} call row(s) whose legs `
          + 'are not live at Telnyx and never received a hangup event'
        )
      }
    }

    const { data: priorSightings } = liveIds.length
      ? await db
          .from('live_leg_sightings')
          .select('call_control_id, first_seen_at, times_seen')
          .in('call_control_id', liveIds)
      : { data: [] as Array<{ call_control_id: string; first_seen_at: string; times_seen: number }> }

    const sightingById = new Map(
      (priorSightings || []).map(s => [s.call_control_id, s])
    )

    // ── RECORD BEFORE DECIDING ────────────────────────────────────────────
    // The sighting write happens first so that a crash anywhere below still
    // advances the clock on every leg. A watchdog that only records when it
    // also succeeds at everything else would restart its own evidence each
    // time it failed, and would never reach a second sighting.
    const nowIso = new Date(now).toISOString()
    if (legs.length > 0) {
      const { error: upsertErr } = await db
        .from('live_leg_sightings')
        .upsert(
          legs.map(l => {
            const prior = sightingById.get(l.callControlId)
            const row = rows.get(l.callControlId)
            return {
              call_control_id: l.callControlId,
              // Preserved explicitly: upsert would otherwise reset it to the
              // column default on every pass and no leg would ever age.
              first_seen_at: prior?.first_seen_at ?? nowIso,
              last_seen_at: nowIso,
              times_seen: (prior?.times_seen ?? 0) + 1,
              user_id: l.userId ?? row?.userId ?? null,
              phone: l.phone ?? row?.phone ?? null,
              had_row: !!row,
            }
          }),
          { onConflict: 'call_control_id' }
        )
      if (upsertErr) console.error('[leg-watchdog] sighting upsert failed:', upsertErr.message)
    }

    // Verdicts are computed against the sighting as it stood BEFORE this pass
    // incremented it, plus this pass — which is what times_seen now holds.
    const verdicts: WatchdogVerdict[] = legs.map(l => {
      const row = rows.get(l.callControlId)
      const prior = sightingById.get(l.callControlId)
      return classifyLeg({
        callControlId: l.callControlId,
        row: row
          ? { createdAt: row.createdAt, duration: row.duration, disposition: row.disposition }
          : null,
        sighting: {
          firstSeenAt: prior?.first_seen_at ?? nowIso,
          timesSeen: (prior?.times_seen ?? 0) + 1,
        },
      }, thresholds, now)
    })

    const doomed = verdicts.filter(v => v.action === 'end')
    const summary = summariseSweep(verdicts)

    // ── THE OFF SWITCH GATES THE TEARDOWN, NOT THE OBSERVATION ────────────
    // An off flag that only guards the entry point leaves the cleanup branch
    // live; this codebase has been bitten by exactly that. The hangup is
    // therefore gated here, at the call itself, and everything above runs
    // regardless so the dry-run data is real.
    let ended = 0
    if (thresholds.enabled && doomed.length > 0) {
      const results = await killLegs(doomed.map(v => v.callControlId))
      ended = results.filter(r => r.ended).length

      const endedIds = results.filter(r => r.ended).map(r => r.callControlId)
      if (endedIds.length > 0) {
        await db
          .from('live_leg_sightings')
          .update({ ended_at: nowIso })
          .in('call_control_id', endedIds)
      }
      for (const v of doomed) {
        await db
          .from('live_leg_sightings')
          .update({ ended_rule: v.rule })
          .eq('call_control_id', v.callControlId)
      }
    }

    // One event per leg acted on (or that would have been), so the reason a
    // call ended is answerable later from call_events alongside everything
    // else about it, rather than only from a cron response nobody kept.
    for (const v of doomed) {
      void logCallEvent({
        event_type: 'reaped',
        call_control_id: v.callControlId,
        status: thresholds.enabled ? 'ended' : 'would_end',
        source: 'reaper',
        detail: {
          kind: 'leg_watchdog',
          rule: v.rule,
          reason: v.reason,
          age_seconds: v.ageSeconds,
          age_is_lower_bound: v.ageIsLowerBound,
          enforced: thresholds.enabled,
        },
      })
    }

    // Prune. A sighting outlives its leg only as long as it is useful as the
    // record of why something was hung up.
    const pruneBefore = new Date(now - SIGHTING_RETENTION_HOURS * 60 * 60_000).toISOString()
    const { count: pruned } = await db
      .from('live_leg_sightings')
      .delete({ count: 'exact' })
      .lt('last_seen_at', pruneBefore)

    return NextResponse.json({
      success: true,
      enforced: thresholds.enabled,
      ...summary,
      ended,
      wouldEnd: thresholds.enabled ? 0 : doomed.length,
      prunedSightings: pruned ?? 0,
      thresholds,
      // Small enough to read in a cron log, and the only place the reasoning
      // is visible when the watchdog is still in dry run.
      decisions: doomed.map(v => ({
        callControlId: v.callControlId, rule: v.rule,
        ageSeconds: v.ageSeconds, lowerBound: v.ageIsLowerBound, reason: v.reason,
      })),
    })
  } catch (error) {
    return apiError(error, { route: 'cron/leg-watchdog' })
  }
}
