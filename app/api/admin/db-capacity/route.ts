import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/db-capacity')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/db-capacity — how close the database is to going read-only
// =============================================================================
// At 500MB the Supabase Free Plan switches the project to READ-ONLY. Not slow,
// not degraded: no call rows, no dispositions, no heartbeats, no lead uploads.
// The dialer keeps dialing and stops remembering, which is the worst shape a
// failure can take because nothing looks broken until somebody goes looking for
// a call that was never written.
//
// ops-health already alerts on the total at 70% and 85% (see its
// checkDatabaseCapacity). This route exists for the other half of the question:
// a warning that says "you are at 78%" and nothing else leaves an operator
// guessing which table to attack. So this reports the breakdown, names what is
// safe to purge, and says how long there is at the current rate.
//
// The thresholds and the limit are duplicated from ops-health deliberately —
// importing a cron route into an API route to share three numbers couples two
// things that have no other reason to know about each other. If Supabase moves
// the ceiling, both change.
// =============================================================================

const DB_LIMIT_BYTES = 500 * 1024 * 1024
const WARN_FRACTION = 0.70
const URGENT_FRACTION = 0.85

/**
 * Tables whose old rows can be deleted without losing anything a person needs.
 *
 * Deliberately conservative. `calls` and `leads` are NOT here: they are the
 * product's memory, and an operator hunting for space at 90% should not be
 * shown a button that deletes the thing the business is made of. Recording
 * retention already prunes audio on its own schedule.
 *
 * call_events is partitioned by month, so its old partitions can be DROPPED
 * rather than deleted from — which returns the space immediately instead of
 * leaving dead tuples for autovacuum to reclaim whenever it gets to it.
 */
const PURGEABLE = new Set(['telnyx_events', 'page_views', 'stripe_events'])
const PARTITION_PREFIX = 'call_events_'

interface TableRow {
  table_name: string
  total_bytes: number
  table_bytes: number
  index_bytes: number
  row_estimate: number
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

    const [sizeRes, tablesRes, callsRes, eventsRes] = await Promise.all([
      supabase.rpc('database_size_bytes'),
      supabase.rpc('table_sizes'),
      // The two dominant growth drivers, counted over a real week rather than
      // extrapolated from a single day. Today alone is not a trend, and the
      // first real dialing day is exactly the day somebody would mistake for
      // one.
      supabase.from('calls')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
      supabase.from('call_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
    ])

    const totalBytes = Number(sizeRes.data) || 0
    const tables = (tablesRes.data || []) as TableRow[]

    const byName = new Map(tables.map(t => [t.table_name, t]))
    const bytesPerRow = (name: string, fallback: number) => {
      const t = byName.get(name)
      if (!t || !t.row_estimate) return fallback
      return t.total_bytes / t.row_estimate
    }

    // call_events lives in monthly partitions, so its per-row cost has to come
    // from the partitions rather than the (empty) parent table.
    const eventPartitions = tables.filter(t => t.table_name.startsWith(PARTITION_PREFIX))
    const eventBytes = eventPartitions.reduce((n, t) => n + t.total_bytes, 0)
    const eventRows = eventPartitions.reduce((n, t) => n + t.row_estimate, 0)

    const callsWeek = callsRes.count ?? 0
    const eventsWeek = eventsRes.count ?? 0

    const growthPerDay =
      (callsWeek * bytesPerRow('calls', 1200) +
        eventsWeek * (eventRows ? eventBytes / eventRows : 700)) / 7

    const remaining = Math.max(0, DB_LIMIT_BYTES - totalBytes)
    const daysToFull = growthPerDay > 0 ? remaining / growthPerDay : null

    const purgeable = tables.filter(
      t => PURGEABLE.has(t.table_name) || t.table_name.startsWith(PARTITION_PREFIX)
    )
    const purgeableBytes = purgeable.reduce((n, t) => n + t.total_bytes, 0)

    const used = totalBytes / DB_LIMIT_BYTES

    return NextResponse.json({
      success: true,
      limitBytes: DB_LIMIT_BYTES,
      totalBytes,
      usedPct: Math.round(used * 1000) / 10,
      remainingBytes: remaining,
      level: used >= URGENT_FRACTION ? 'urgent' : used >= WARN_FRACTION ? 'warn' : 'ok',
      warnPct: WARN_FRACTION * 100,
      urgentPct: URGENT_FRACTION * 100,

      // Null when nothing has been written in a week — an idle platform has no
      // trend, and inventing one would be worse than saying so.
      growthBytesPerDay: Math.round(growthPerDay),
      daysToFull: daysToFull === null || !Number.isFinite(daysToFull)
        ? null
        : Math.round(daysToFull),
      sampleCalls: callsWeek,
      sampleEvents: eventsWeek,

      purgeableBytes,
      purgeableTables: purgeable.length,

      tables: tables.slice(0, 25).map(t => ({
        name: t.table_name,
        totalBytes: t.total_bytes,
        indexBytes: t.index_bytes,
        rows: t.row_estimate,
        pctOfDb: totalBytes ? Math.round((t.total_bytes / totalBytes) * 1000) / 10 : 0,
        purgeable: PURGEABLE.has(t.table_name) || t.table_name.startsWith(PARTITION_PREFIX),
        // A partition can be dropped whole, which returns the space at once.
        // Deleting rows from an ordinary table leaves dead tuples behind until
        // autovacuum reclaims them, so the number on this screen would not move
        // and somebody would delete twice.
        partition: t.table_name.startsWith(PARTITION_PREFIX),
      })),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/db-capacity' })
  }
}
