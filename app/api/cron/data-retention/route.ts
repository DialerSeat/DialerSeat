import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('cron/data-retention')

// ─────────────────────────────────────────────────────────────────────────
// COMPRESS BY DEFAULT, KEEP ON PURPOSE
//
// What gets pruned is no longer a list in this file. Every table declares
// itself in `retention_policy` as either evidence (kept, because somebody could
// need to answer a question from a row) or ephemeral (compressed, then pruned,
// because the row's only contribution was a number on a chart).
//
// The point of moving it into the database is that a hardcoded list here means
// every new table silently accumulates forever until somebody remembers it
// exists. Now an unclassified table is REPORTED — loudly, every day — so it gets
// a decision instead of quietly filling with air.
//
// Unclassified still means KEEP. Defaulting an unknown table to deletion would
// mean the next table somebody adds, quite possibly holding financial records,
// starts destroying itself on day one. The report gets the same outcome —
// nothing accumulates unnoticed — without a default that is catastrophic when
// it is wrong.
//
// ORDER IS THE SAFETY PROPERTY. The rollup runs first and the prune is gated on
// it: if summarising fails, nothing is deleted and the rows wait for tomorrow.
// ─────────────────────────────────────────────────────────────────────────

// Re-summarise an overlapping window every run, not just the part about to be
// pruned. A day rolled up while still in progress would otherwise keep a partial
// count forever, and a run that failed once would leave a permanent hole. The
// rollup is idempotent, so re-doing a day corrects it.
const ROLLUP_LOOKBACK_DAYS = 120

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. COMPRESS ───────────────────────────────────────────────────────
    let rolledUp = 0
    try {
      const from = new Date(Date.now() - ROLLUP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase.rpc('rollup_page_views', {
        p_from: from.toISOString().slice(0, 10),
        p_to: new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
      rolledUp = data ?? 0
    } catch (e: any) {
      console.error('[data-retention] rollup failed — nothing pruned', e?.message || e)
      return NextResponse.json({
        success: false,
        error: 'Rollup failed. Nothing was deleted.',
        detail: e?.message || 'unknown',
      }, { status: 500 })
    }

    // ── 2. PRUNE, ACCORDING TO WHAT EACH TABLE DECLARED ───────────────────
    const { data: pruned, error: pruneErr } = await supabase.rpc('run_retention', {
      p_dry_run: false,
    })
    if (pruneErr) throw pruneErr

    const rows = (pruned || []) as Array<{ table_name: string; deleted: number; note: string }>
    const deletedTotal = rows.reduce((n, r) => n + (Number(r.deleted) || 0), 0)
    const failures = rows.filter(r => (r.note || '').startsWith('FAILED') || (r.note || '').startsWith('SKIPPED'))

    // ── 3. ANYTHING NOBODY HAS CLASSIFIED ────────────────────────────────
    const { data: unclassified } = await supabase.rpc('unclassified_tables')
    const unknown = (unclassified || []) as Array<{ table_name: string; approx_rows: number }>

    // Told, not just logged. A new table quietly growing forever is exactly the
    // failure this whole mechanism exists to prevent, and a line in a cron log
    // nobody reads would recreate it.
    if (unknown.length > 0) {
      const names = unknown.slice(0, 5).map(u => u.table_name).join(', ')
      await sendAdminPush(
        'webhook_silence',
        `${unknown.length} table(s) have no retention policy and are being kept by ` +
        `default: ${names}${unknown.length > 5 ? '…' : ''}. Classify them in retention_policy.`,
        { title: 'Unclassified tables' }
      ).catch(() => {})
    }

    if (failures.length > 0) {
      console.error('[data-retention] problems:', JSON.stringify(failures))
    }

    const summary = {
      pageViewsRolledUp: rolledUp,
      deletedTotal,
      byTable: rows
        .filter(r => Number(r.deleted) > 0)
        .map(r => ({ table: r.table_name, deleted: Number(r.deleted) })),
      problems: failures.map(r => ({ table: r.table_name, note: r.note })),
      unclassified: unknown.map(u => u.table_name),
    }

    console.log('[data-retention]', JSON.stringify(summary))
    return NextResponse.json({ success: true, ...summary })
  } catch (error: any) {
    console.error('data-retention error:', error)
    return apiError(error, { route: 'cron/data-retention' })
  }
}
