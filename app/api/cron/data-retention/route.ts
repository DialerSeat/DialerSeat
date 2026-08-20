import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('cron/data-retention')

// ─────────────────────────────────────────────────────────────────────────
// COMPRESS WHAT IS STALE, KEEP WHAT IS EVIDENCE
//
// Some data stops being useful the moment its day ends. A row saying somebody
// viewed a page at 14:32 in March, an idempotency key for a webhook processed
// last spring, a receipt for a lead delivery that succeeded — none of it
// answers a question anybody will ask. It is storage cost and query weight
// pretending to be history.
//
// WHAT THIS DELIBERATELY NEVER TOUCHES, and why:
//
//   calls               Analytics, compliance evidence, and the record of work
//                       an agent did. A dispute about a call is settled from
//                       this table.
//   leads               The customer's own asset. Not ours to age out.
//   team_seat_charges   Financial records. Tax statements are generated from
//                       them years later, and the IRS period of limitations
//                       runs to six years in some circumstances.
//   subscriptions       Money.
//   billing_events      Money.
//   team_members        The roster, and the evidence of who was on a seat when.
//   lead_notes          What an agent wrote down. Somebody's work.
//   recordings          Already governed by recording_expires_at, which is a
//                       per-campaign decision rather than a blanket sweep.
//
// The rule this follows: if a human could plausibly need to answer a question
// from a row, the row stays. If the only thing it ever contributed was a number
// on a chart, the number is kept and the row is not.
// ─────────────────────────────────────────────────────────────────────────

// Every Visibility range is 90 days or shorter, so 100 days of raw views covers
// every question the app can ask with room to spare. Beyond that the rollup
// answers, and answers permanently.
const PAGE_VIEW_RAW_DAYS = 100

// Debugging receipts. A vendor diagnosing a broken integration looks at today,
// or at worst last week; nobody has ever needed a delivery receipt from March.
const INGEST_RECEIPT_DAYS = 60

// Idempotency keys only need to outlive a provider's retry window, which is
// hours. A month is already generous.
const EVENT_KEY_DAYS = 30

// "Somebody came online" from eight months ago answers nothing. Billing and
// operational notifications are kept indefinitely — those ARE the record of
// what happened to an account.
const NOISE_NOTIFICATION_DAYS = 45
const NOISE_NOTIFICATION_TYPES = ['agent_online']

// Operational churn history. Useful while tuning the pool, worthless after.
const POOL_LOG_DAYS = 180

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: Record<string, any> = {}
  const cutoff = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // ── 1. ROLL UP BEFORE ANYTHING IS DELETED ────────────────────────────
    // Deliberately first, and deliberately overlapping: it re-summarises the
    // last few days every run as well as the window about to be pruned. A day
    // that was rolled up while still in progress would otherwise keep a partial
    // count forever, and a cron that failed once would leave a permanent hole.
    // The function is idempotent, so re-running a day corrects it.
    try {
      const from = new Date(Date.now() - (PAGE_VIEW_RAW_DAYS + 10) * 24 * 60 * 60 * 1000)
      const to = new Date()
      const { data: rolled, error: rollErr } = await supabase.rpc('rollup_page_views', {
        p_from: from.toISOString().slice(0, 10),
        p_to: to.toISOString().slice(0, 10),
      })
      if (rollErr) throw rollErr
      result.pageViewsRolledUp = rolled ?? 0
    } catch (e: any) {
      // If the rollup fails, the prune below MUST NOT run — that is the whole
      // safety property. Returning early leaves the raw rows in place for the
      // next attempt.
      console.error('[data-retention] rollup failed, skipping prune', e?.message || e)
      return NextResponse.json({
        success: false,
        error: 'Rollup failed — nothing was deleted.',
        detail: e?.message || 'unknown',
      }, { status: 500 })
    }

    // ── 2. RAW PAGE VIEWS, NOW SUMMARISED ────────────────────────────────
    {
      const { count } = await supabase
        .from('page_views')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff(PAGE_VIEW_RAW_DAYS))
      result.pageViewsPruned = count ?? 0
    }

    // ── 3. DELIVERY RECEIPTS ─────────────────────────────────────────────
    {
      const { count } = await supabase
        .from('lead_ingest_events')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff(INGEST_RECEIPT_DAYS))
      result.ingestReceiptsPruned = count ?? 0
    }

    // ── 4. IDEMPOTENCY KEYS ──────────────────────────────────────────────
    // telnyx_events is already swept hourly on a 24-hour window by the
    // stale-call reaper; these are the two nobody was clearing.
    for (const [table, column] of [
      ['stripe_events', 'received_at'],
      ['telephony_events', 'received_at'],
    ] as const) {
      try {
        const { count } = await supabase
          .from(table)
          .delete({ count: 'exact' })
          .lt(column, cutoff(EVENT_KEY_DAYS))
        result[`${table}Pruned`] = count ?? 0
      } catch (e: any) {
        console.error(`[data-retention] ${table} prune failed`, e?.message || e)
        result[`${table}Pruned`] = 'failed'
      }
    }

    // ── 5. NOISE NOTIFICATIONS ONLY ──────────────────────────────────────
    // Scoped by event_type on purpose. A cancellation, a failed payment or a
    // pool warning from a year ago is the history of an account and stays.
    {
      const { count } = await supabase
        .from('admin_notifications')
        .delete({ count: 'exact' })
        .in('event_type', NOISE_NOTIFICATION_TYPES)
        .lt('created_at', cutoff(NOISE_NOTIFICATION_DAYS))
      result.noiseNotificationsPruned = count ?? 0
    }

    // ── 6. POOL CHURN LOG ────────────────────────────────────────────────
    {
      const { count } = await supabase
        .from('pool_cycle_log')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff(POOL_LOG_DAYS))
      result.poolLogPruned = count ?? 0
    }

    console.log('[data-retention]', JSON.stringify(result))
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('data-retention error:', error)
    return apiError(error, { route: 'cron/data-retention' })
  }
}
