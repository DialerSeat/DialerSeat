import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'
import { fetchDetailRecords } from '@/lib/telnyxDetailRecords'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vercel Pro allows up to 300s. The admin route this borrows from caps itself
// at 7 seconds with a comment about "Vercel Hobby kills a function at 10s" --
// that assumption is stale, and it is why a manual capture on 15 Sept stored
// 250 sip-trunking records covering thirty-seven minutes and stopped.
export const maxDuration = 300

// =============================================================================
// PULLING THE RECORDS THE SURCHARGE IS ACTUALLY COMPUTED FROM
// =============================================================================
// Telnyx flagged this account for short-duration calls and the only numbers we
// could argue with were our own. Our compliance screen reads the call.cost
// WEBHOOK and infers "short" from billed_sec <= 6. That inference is good but
// it is not their answer, and it has a known blind spot: a PSTN leg bills a
// full 60 seconds however briefly it actually ran, so a genuinely short lead
// leg is invisible to it. Measured against their own records, 1 of 44 flagged
// short calls was exactly that case.
//
// The detail records report is different. Every sip-trunking row carries
// Telnyx's OWN `short_duration_call` and `connected` flags -- the fields the
// surcharge is computed from -- so reading them is not an approximation of
// their number, it IS their number.
//
// ── WHY THIS IS A CRON AND NOT A BUTTON ────────────────────────────────────
// The rep confirmed the method and the source, then said he could not pull
// account-specific CDRs or the billing-system ratio himself and routed it to
// the Support queue. That queue does not answer. September is assessed on the
// 30th, so waiting on it is not a plan.
//
// This removes the dependency entirely: pull the authoritative rows on a
// schedule, compute their formula over their flags, and the question "has it
// gone down" gets answered from Telnyx's own data without asking anybody.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
// It does not settle whether a single agent leg, billed on both the SIP
// credential connection and the Call Control connection, counts once or twice.
// Nothing in the records can answer that -- it is a policy question about their
// billing system. What this DOES do is make the swing visible: the companion
// RPC reports the ratio per connection as well as combined, so both readings
// sit side by side and the answer, whenever it arrives, just selects one.
// =============================================================================

const supabase = getServiceClient('cron/telnyx-compliance-sync')

/**
 * How far back to re-read on every run.
 *
 * Longer than the gap between runs on purpose. Detail records are not instant
 * -- a call that ends near a boundary can land in the report minutes later --
 * so a window that only covered "since the last run" would drop exactly the
 * rows that sit on the boundary, every time, invisibly. Re-reading is free:
 * the dedupe below stores nothing for a row already held.
 */
const LOOKBACK_HOURS = 36

/**
 * Leave headroom under maxDuration. Being killed mid-walk stores nothing and
 * reports nothing, which is the failure this whole file exists to avoid.
 */
const FETCH_BUDGET_MS = 240_000

// sip-trunking ONLY. It is the family that carries short_duration_call --
// call-control rows do not have the field at all, verified across all 1,192 of
// them -- and pulling types this question cannot use would spend the budget
// that the ones it can use need.
const RECORD_TYPE = 'sip-trunking'

type Row = Record<string, unknown>

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

// ── THESE FOUR MATCH app/api/admin/telnyx-ledger EXACTLY ───────────────────
// Both writers land in the same table and dedupe against each other's rows. A
// different id field or a differently-ordered hash would make every record
// look new to the other writer, and the table would quietly double.
function idOf(r: Row): string | null {
  for (const k of ['id', 'uuid', 'record_id', 'call_leg_id', 'call_session_id']) {
    const v = r[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function costOf(r: Row): number | null {
  const direct = r.cost ?? r.total_cost ?? r.billed_cost
  if (direct !== undefined && direct !== null) return num(direct)
  return num((r.cost as { amount?: unknown } | undefined)?.amount)
}

function occurredAt(r: Row): string | null {
  for (const k of ['created_at', 'started_at', 'occurred_at', 'completed_at']) {
    const v = r[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function hashOf(r: Row): string {
  const stable = JSON.stringify(r, Object.keys(r).sort())
  return createHash('sha256').update(stable).digest('hex').slice(0, 32)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    // Loud rather than a silent no-op. A compliance capture that quietly stops
    // running looks identical to a compliance problem that quietly went away.
    console.error('[telnyx-compliance-sync] TELNYX_API_KEY missing; nothing captured')
    return NextResponse.json(
      { success: false, error: 'TELNYX_API_KEY is not configured' },
      { status: 500 }
    )
  }

  try {
    const to = new Date()
    const from = new Date(to.getTime() - LOOKBACK_HOURS * 3600_000)

    const page = await fetchDetailRecords({
      apiKey,
      recordType: RECORD_TYPE,
      from: from.toISOString(),
      to: to.toISOString(),
      budgetMs: FETCH_BUDGET_MS,
    })

    if (page.error && page.rows.length === 0) {
      console.error('[telnyx-compliance-sync] fetch failed', page.error)
      return NextResponse.json({ success: false, error: page.error }, { status: 502 })
    }

    const rows = page.rows as Row[]

    // One dedupe read for the whole batch. Doing it per row is what made the
    // admin route die at its time budget once pagination started working.
    const ids = rows.map(r => idOf(r) ?? '').filter(Boolean)
    const seenIdHash = new Set<string>()
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500)
      const { data: existing } = await supabase
        .from('telnyx_ledger_records')
        .select('telnyx_id, payload_hash')
        .eq('record_type', RECORD_TYPE)
        .in('telnyx_id', slice)
      for (const e of (existing || []) as Array<{ telnyx_id: string; payload_hash: string }>) {
        seenIdHash.add(`${e.telnyx_id}::${e.payload_hash}`)
      }
    }

    const toInsert = rows
      .filter(r => !seenIdHash.has(`${idOf(r) ?? ''}::${hashOf(r)}`))
      .map(r => ({
        record_type: RECORD_TYPE,
        telnyx_id: idOf(r),
        occurred_at: occurredAt(r),
        cost: costOf(r),
        rate: num(r.rate),
        billed_sec: num(r.billed_sec) ?? num(r.billed_seconds),
        currency: typeof r.currency === 'string' ? r.currency : 'USD',
        payload: r,
        payload_hash: hashOf(r),
        // Named for what it is, so these rows are distinguishable from the
        // one-off manual pulls already in the table.
        capture_window: 'cron:compliance',
      }))

    let stored = 0
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500)
      // A duplicate is the unique index doing its job on two overlapping runs,
      // not a reason to fail the sweep.
      const { error } = await supabase.from('telnyx_ledger_records').insert(chunk)
      if (!error) stored += chunk.length
    }

    // Truncation has to be impossible to miss. A capture that silently covered
    // thirty-seven minutes of a day is exactly how this account ended up
    // arguing with the carrier using its own inference instead of their data.
    if (page.truncated) {
      console.error(
        `[telnyx-compliance-sync] TRUNCATED: fetched ${rows.length} of ` +
        `${page.totalResults ?? '?'} (stopped by ${page.stoppedBecause}). ` +
        `The window is not fully covered.`
      )
    }

    console.log(
      `[telnyx-compliance-sync] ${from.toISOString()} -> ${to.toISOString()}: ` +
      `fetched ${rows.length}, stored ${stored}, already held ${rows.length - toInsert.length}, ` +
      `pages ${page.pagesFetched}, truncated ${page.truncated}`
    )

    return NextResponse.json({
      success: true,
      window: { from: from.toISOString(), to: to.toISOString() },
      fetched: rows.length,
      stored,
      alreadyHeld: rows.length - toInsert.length,
      totalResults: page.totalResults,
      pagesFetched: page.pagesFetched,
      truncated: page.truncated,
      stoppedBecause: page.stoppedBecause,
    })
  } catch (err: unknown) {
    console.error('[telnyx-compliance-sync] failed', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
