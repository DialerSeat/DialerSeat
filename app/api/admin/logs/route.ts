import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/logs')

const MAX_ENTRIES = 200

// The 5 selectable timeframes for the Logs UI. 'all' skips the date filter
// entirely rather than being approximated by a large day-count, so it's a
// genuine, correct "everything in billing_events since it was introduced,"
// not "everything from the last N days" for some arbitrarily large N.
type TimeframeKey = '24h' | '7d' | '30d' | '90d' | 'all'
const TIMEFRAME_DAYS: Record<Exclude<TimeframeKey, 'all'>, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}
const DEFAULT_TIMEFRAME: TimeframeKey = '90d'

function parseTimeframe(raw: string | null): TimeframeKey {
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw
  return DEFAULT_TIMEFRAME
}

interface LogEntry {
  id: string
  event_type: 'account_created' | 'initial_sub' | 'resub' | 'renewal' | 'cancel' | 'account_deleted'
  user_name: string
  user_email: string | null
  amount_cents: number
  date_iso: string
  retention_weeks: number | null
  source: string
}

// This route used to reconstruct history on every request by joining the
// live `users` and `subscriptions` tables, plus a live Stripe invoices.list
// call for renewals. Two problems with that: (1) deleteAccount() hard-deletes
// both `users` and `subscriptions` rows, so every event tied to a deleted
// account — including ones from weeks earlier that had already appeared in
// this exact log — disappeared the moment the account was deleted; (2) it
// depended on a live Stripe API call succeeding on every page load.
//
// billing_events (see migrations/BILLING_EVENTS_AUDIT_LOG_2026-07-18.sql) is
// written once, at the moment each event actually happens, with a
// denormalized name/email snapshot — no foreign key to `users`, so it can't
// be deleted by cascade and doesn't depend on the user still existing to
// render correctly. This route now just reads that table directly.
//
// Note: events that occurred before this table was introduced were never
// recorded here and won't appear — this only guarantees no *future* event
// gets lost to a later account deletion. That means even 'all time' here
// only ever goes back to whenever billing_events first started being
// written, not to the true beginning of the business.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const timeframe = parseTimeframe(req.nextUrl.searchParams.get('timeframe'))
  const day = 86400000
  const windowStart =
    timeframe === 'all'
      ? null
      : new Date(Date.now() - TIMEFRAME_DAYS[timeframe] * day).toISOString()

  try {
    // Admin/excluded users are filtered out at write time everywhere else
    // in this app's analytics (e.g. app/api/admin/analytics/route.ts), but
    // billing_events has no such flag of its own (it's a denormalized
    // snapshot, not a live join) — cross-reference against whichever of
    // these clerk_ids still have a live users row flagged that way. A
    // clerk_id with no live users row at all (i.e. the account was since
    // deleted) is never excluded by this check, which is the whole point.
    const { data: excludedUsers } = await supabase
      .from('users')
      .select('clerk_id')
      .or('is_admin.eq.true,exclude_from_analytics.eq.true')

    const excluded = new Set((excludedUsers || []).map((u: { clerk_id: string }) => u.clerk_id))

    let query = supabase
      .from('billing_events')
      .select('id, clerk_id, event_type, plan, amount_cents, retention_weeks, created_at, user_name, user_email')
      .order('created_at', { ascending: false })
      .limit(MAX_ENTRIES + excluded.size) // pad so post-filter still fills MAX_ENTRIES where possible

    if (windowStart) {
      query = query.gte('created_at', windowStart)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('[admin/logs] failed to read billing_events:', error)
      return NextResponse.json({ error: 'Failed to build logs' }, { status: 500 })
    }

    const counts = { accountsCreated: 0, accountsDeleted: 0, initialSubs: 0, resubs: 0, renewals: 0, cancels: 0 }
    const entries: LogEntry[] = []

    for (const e of events || []) {
      if (excluded.has(e.clerk_id)) continue

      switch (e.event_type) {
        case 'account_created': counts.accountsCreated++; break
        case 'account_deleted': counts.accountsDeleted++; break
        case 'initial_sub': counts.initialSubs++; break
        case 'resub': counts.resubs++; break
        case 'renewal': counts.renewals++; break
        case 'cancel': counts.cancels++; break
      }

      entries.push({
        id: e.id,
        event_type: e.event_type,
        user_name: e.user_name || '(unknown)',
        user_email: e.user_email ?? null,
        amount_cents: e.amount_cents ?? 0,
        date_iso: e.created_at,
        retention_weeks: e.retention_weeks ?? null,
        source: 'supabase:billing_events',
      })
    }

    return NextResponse.json({
      entries: entries.slice(0, MAX_ENTRIES),
      counts,
      timeframe,
      window_days: timeframe === 'all' ? null : TIMEFRAME_DAYS[timeframe],
    })
  } catch (err) {
    console.error('[admin/logs] failed:', err)
    return NextResponse.json({ error: 'Failed to build logs' }, { status: 500 })
  }
}