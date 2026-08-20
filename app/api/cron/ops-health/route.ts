import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush, type NotifEventType } from '@/lib/pushNotify'
import { getPlatformConfig } from '@/lib/platformConfig'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// OPS HEALTH — alerts for the failures that used to be silent
// =============================================================================
// Every notification this platform could send was about money: signups,
// subscriptions, renewals, cancellations. Nothing told an admin the product had
// stopped working — and during the Telnyx migration a string of failures were
// each discovered only because a human noticed something felt wrong:
//
//   - Telnyx refused every agent leg for hours. Dials "succeeded", leads
//     answered, AMD ran, and there was no audio. No error surfaced anywhere,
//     because the dial request itself returned 200 with a call_control_id.
//   - The caller-ID pool held numbers from the previous provider, so every
//     lead leg was rejected. Symptom: an error about phone number formatting.
//   - A talk-time query joined on the wrong column, so the admin dashboard
//     reported 0 minutes connected for agents who had been talking all day.
//
// This route checks for that class of thing on a schedule, using data the app
// already writes. Three conditions to start, chosen because each maps to a real
// incident rather than a hypothetical.
//
// DESIGN RULES:
//   - Read-only. It observes and notifies; it never mutates operational state.
//     A health check that "fixes" things is a health check that can cause an
//     outage.
//   - De-duplicated. An ongoing condition stays true for hours, and an alert
//     channel that fires every few minutes gets muted — which is strictly worse
//     than no alerting. Each alert has a cooldown recorded in ops_alert_log.
//   - Never throws. A failing health check must not page anyone by itself, and
//     must not take down the cron runner.
// =============================================================================

const supabase = getServiceClient('cron/ops-health')

// ── SCHEDULING CONSTRAINT — READ BEFORE CHANGING vercel.json ────────────────
// These are "the product is broken right now" alerts and are worth very little
// on a daily schedule — a webhook outage found 20 hours later is not an alert,
// it's a post-mortem. The intended cadence is every 15 minutes.
//
// It runs daily because Vercel's Hobby plan rejects sub-daily crons at DEPLOY
// time, failing the entire deployment. A */15 here silently blocked releases.
//
// Pro allows minute granularity; alternatively drive this from an external
// scheduler using the CRON_SECRET bearer token. The COOLDOWN_MINUTES
// de-duplication below already makes frequent invocation safe.
// ────────────────────────────────────────────────────────────────────────────

/** How long before the same alert may fire again. */
const COOLDOWN_MINUTES = 60

/** Window for counting refused agent legs. */
const REFUSAL_LOOKBACK_MINUTES = 30

interface AlertResult {
  key: string
  fired: boolean
  reason: string
}

/**
 * Fire an alert unless the same key fired inside the cooldown.
 *
 * Records every fire so the cooldown survives across serverless instances —
 * an in-memory guard would be per-instance and would let each cold start
 * re-alert on the same ongoing condition.
 */
async function fireOnce(
  key: string,
  eventType: NotifEventType,
  body: string
): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString()

  const { data: recent, error } = await supabase
    .from('ops_alert_log')
    .select('id')
    .eq('alert_key', key)
    .gte('created_at', since)
    .limit(1)

  if (error) {
    // Can't establish whether we already alerted. Prefer alerting: a duplicate
    // notification is annoying, a missed outage alert is the thing this route
    // exists to prevent.
    console.error(`[ops-health] cooldown check failed for ${key}, alerting anyway:`, error.message)
  } else if (recent && recent.length > 0) {
    return false
  }

  await sendAdminPush(eventType, body)
  await supabase.from('ops_alert_log').insert({ alert_key: key, detail: body })
  return true
}

// ── 1. AGENT LEGS BEING REFUSED ─────────────────────────────────────────────
// An agent leg is a call row's sibling that has NO calls row of its own — we
// only insert rows for lead legs. So a hangup on a call_control_id with no
// matching calls row, with cause 'user_busy', is Telnyx refusing to route to
// the agent's SIP endpoint. That means the call has no agent audio at all,
// which is never acceptable and was 100% of dials during the migration.
async function checkAgentLegRefusals(threshold: number): Promise<AlertResult> {
  const key = 'agent_leg_refused'
  const since = new Date(Date.now() - REFUSAL_LOOKBACK_MINUTES * 60_000).toISOString()

  const { data: events, error } = await supabase
    .from('call_events')
    .select('call_control_id')
    .eq('event_type', 'completed')
    .eq('status', 'user_busy')
    .gte('created_at', since)
    .limit(500)

  if (error) return { key, fired: false, reason: `query failed: ${error.message}` }
  const ids = [...new Set((events || []).map(e => e.call_control_id).filter(Boolean))] as string[]
  if (ids.length === 0) return { key, fired: false, reason: 'no user_busy hangups' }

  // Keep only the ids with no calls row — those are agent legs.
  const { data: known, error: knownErr } = await supabase
    .from('calls')
    .select('call_control_id')
    .in('call_control_id', ids)

  if (knownErr) return { key, fired: false, reason: `calls lookup failed: ${knownErr.message}` }
  const knownSet = new Set((known || []).map(c => c.call_control_id))
  const refused = ids.filter(id => !knownSet.has(id))

  if (refused.length < threshold) {
    return { key, fired: false, reason: `${refused.length} refused, under threshold ${threshold}` }
  }

  const fired = await fireOnce(
    key,
    'agent_leg_refused',
    `${refused.length} agent leg(s) refused by Telnyx in the last ${REFUSAL_LOOKBACK_MINUTES}m. ` +
    `Those calls had NO agent audio. Usually SIP URI calling disabled on the agent connection.`
  )
  return { key, fired, reason: `${refused.length} refused` }
}

// ── 2. CALLER-ID POOL NEAR CAPACITY ─────────────────────────────────────────
// Every active number has a daily_cap. Once all of them are at cap,
// pickNumberForLead returns null and EVERY user gets "No phone numbers
// available in pool" — a total outage with a support-ticket-shaped symptom.
// This has to fire well before 100% to leave time to buy numbers.
async function checkPoolCapacity(alertPct: number): Promise<AlertResult> {
  const key = 'pool_capacity'

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('daily_cap, daily_call_count')
    .eq('status', 'active')

  if (error) return { key, fired: false, reason: `query failed: ${error.message}` }

  const rows = numbers || []
  if (rows.length === 0) {
    const fired = await fireOnce(
      key,
      'pool_capacity',
      'The caller-ID pool has NO active numbers. Every outbound call will fail until one is added.'
    )
    return { key, fired, reason: 'pool empty' }
  }

  const capacity = rows.reduce((s, n) => s + (n.daily_cap ?? 0), 0)
  const used = rows.reduce((s, n) => s + (n.daily_call_count ?? 0), 0)
  if (capacity <= 0) return { key, fired: false, reason: 'no capacity configured' }

  const pct = Math.round((used / capacity) * 100)
  if (pct < alertPct) return { key, fired: false, reason: `${pct}% used, under ${alertPct}%` }

  const fired = await fireOnce(
    key,
    'pool_capacity',
    `Caller-ID pool at ${pct}% of today's capacity (${used}/${capacity} calls across ` +
    `${rows.length} number(s)). At 100% every user gets "No phone numbers available".`
  )
  return { key, fired, reason: `${pct}% used` }
}

// ── 3. WEBHOOK SILENCE ──────────────────────────────────────────────────────
// Telnyx webhooks drive everything downstream: answered_at, duration, AMD
// results, recordings, disposition timing. If delivery breaks — or the
// signature check starts rejecting — calls still connect but every metric reads
// zero and AMD never fires. Calls existing WITHOUT events is the signature of
// that, and it is invisible from the dialer itself.
async function checkWebhookSilence(silenceMinutes: number): Promise<AlertResult> {
  const key = 'webhook_silence'
  const since = new Date(Date.now() - silenceMinutes * 60_000).toISOString()

  const { count: callCount, error: callErr } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (callErr) return { key, fired: false, reason: `calls query failed: ${callErr.message}` }
  if (!callCount || callCount === 0) {
    // No calls at all — silence is expected, not a fault. Alerting here would
    // page overnight every night.
    return { key, fired: false, reason: 'no calls in window' }
  }

  const { count: eventCount, error: evErr } = await supabase
    .from('call_events')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'webhook')
    .gte('created_at', since)

  if (evErr) return { key, fired: false, reason: `events query failed: ${evErr.message}` }
  if ((eventCount ?? 0) > 0) {
    return { key, fired: false, reason: `${eventCount} webhook events present` }
  }

  const fired = await fireOnce(
    key,
    'webhook_silence',
    `${callCount} call(s) placed in the last ${silenceMinutes}m but ZERO webhook events received. ` +
    `Telnyx delivery or signature verification is likely broken — talk time, AMD and recordings ` +
    `will all be missing.`
  )
  return { key, fired, reason: `${callCount} calls, 0 events` }
}

// ── IS ANYTHING REACHABLE WITH THE PUBLIC ANON KEY? ────────────────────────
// Two exposures were found by hand rather than by any tool: SECURITY DEFINER
// functions that kept Postgres's default EXECUTE-to-PUBLIC grant, and an anon
// SELECT policy on a table holding Stripe identifiers. Both were reachable by
// anyone who read the browser bundle, and both had been that way a long time.
//
// A one-off audit proves that day was fine and says nothing about the next
// migration. security_invariants() states the rules as queries; running it here
// turns "somebody should check" into something that announces itself.
//
// This alert is not rate-limited by severity for a reason: it fires only when a
// hole is actually open, so it should keep firing until it is closed.
async function checkSecurityInvariants(): Promise<AlertResult> {
  const { data, error } = await supabase.rpc('security_invariants')
  if (error) {
    return { key: 'security_invariants', fired: false, reason: `rpc failed: ${error.message}` }
  }

  const rows = (data || []) as Array<{ severity: string; invariant: string; detail: string }>
  const critical = rows.filter(r => r.severity === 'CRITICAL')
  if (critical.length === 0) {
    return {
      key: 'security_invariants',
      fired: false,
      reason: rows.length === 0 ? 'clean' : `${rows.length} warning(s), no critical`,
    }
  }

  const fired = await fireOnce(
    'security_invariants',
    'webhook_silence',
    `${critical.length} security invariant(s) broken — data may be reachable with the ` +
    `public anon key. ${critical[0].detail}`
  )
  return {
    key: 'security_invariants',
    fired,
    reason: `${critical.length} critical: ${critical.map(c => c.invariant).join(', ')}`,
  }
}

// ── THE PLATFORM LIMIT THAT STOPS THE DIALER ───────────────────────────────
// Supabase puts a Free Plan project into READ-ONLY mode when the database
// exceeds 500 MB. Read-only is not degraded service: no lead uploads, no call
// rows, no dispositions, no heartbeats. The dialer stops, mid-shift, and the
// cause is invisible from inside the app — every write simply fails.
//
// It is also completely predictable, which is the point. Roughly 1,400 bytes
// per lead including indexes means the ceiling arrives at a few hundred
// thousand leads, and it arrives on an ordinary Tuesday when somebody uploads a
// list. Nothing else in this codebase can see it coming, so this does.
//
// Warns at 70% and again at 85% — early enough to upgrade deliberately rather
// than discovering it from an agent saying the dialer stopped saving.
const DB_LIMIT_BYTES = 500 * 1024 * 1024
const DB_WARN_FRACTION = 0.70
const DB_URGENT_FRACTION = 0.85

async function checkDatabaseCapacity(): Promise<AlertResult> {
  const { data, error } = await supabase.rpc('database_size_bytes')
  if (error) {
    return { key: 'db_capacity', fired: false, reason: `rpc failed: ${error.message}` }
  }

  const bytes = Number(data) || 0
  const used = bytes / DB_LIMIT_BYTES
  const mb = Math.round(bytes / 1024 / 1024)
  const pct = Math.round(used * 100)

  if (used < DB_WARN_FRACTION) {
    return { key: 'db_capacity', fired: false, reason: `${mb}MB used (${pct}%)` }
  }

  const urgent = used >= DB_URGENT_FRACTION
  // Distinct keys so crossing into urgent alerts immediately rather than being
  // swallowed by the earlier warning's cooldown.
  const fired = await fireOnce(
    urgent ? 'db_capacity_urgent' : 'db_capacity',
    'webhook_silence',
    urgent
      ? `Database is ${pct}% of the 500MB Free Plan limit (${mb}MB). At 100% Supabase ` +
        `switches the project to READ-ONLY — uploads, calls and dispositions all stop. ` +
        `Upgrade to Pro before that happens.`
      : `Database is ${pct}% of the 500MB Free Plan limit (${mb}MB). Read-only mode ` +
        `starts at 100%. Plan the Pro upgrade now rather than mid-shift.`
  )

  return {
    key: 'db_capacity',
    fired,
    reason: `${mb}MB used (${pct}%)${urgent ? ' — URGENT' : ''}`,
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getPlatformConfig()

    // Run independently so one failing check cannot suppress the others —
    // these are unrelated failure modes and a query error in one says nothing
    // about the rest.
    const results = await Promise.all([
      checkAgentLegRefusals(config.agent_leg_refusal_alert_count).catch(err => ({
        key: 'agent_leg_refused', fired: false, reason: `threw: ${err?.message ?? err}`,
      })),
      checkPoolCapacity(config.pool_capacity_alert_pct).catch(err => ({
        key: 'pool_capacity', fired: false, reason: `threw: ${err?.message ?? err}`,
      })),
      checkWebhookSilence(config.webhook_silence_minutes).catch(err => ({
        key: 'webhook_silence', fired: false, reason: `threw: ${err?.message ?? err}`,
      })),
      checkSecurityInvariants().catch(err => ({
        key: 'security_invariants', fired: false, reason: `threw: ${err?.message ?? err}`,
      })),
      checkDatabaseCapacity().catch(err => ({
        key: 'db_capacity', fired: false, reason: `threw: ${err?.message ?? err}`,
      })),
    ])

    const firedKeys = results.filter(r => r.fired).map(r => r.key)
    if (firedKeys.length > 0) {
      console.warn(`[ops-health] alerts fired: ${firedKeys.join(', ')}`)
    }

    return NextResponse.json({ success: true, checks: results })
  } catch (err) {
    return apiError(err, { route: 'cron/ops-health' })
  }
}
