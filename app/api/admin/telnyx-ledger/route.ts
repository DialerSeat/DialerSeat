import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { fetchDetailRecords } from '@/lib/telnyxDetailRecords'

const supabase = getServiceClient('admin/telnyx-ledger')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// =============================================================================
// /api/admin/telnyx-ledger — keep our own copy of their books
// =============================================================================
// GET  reads what has been captured, plus any record they have since revised.
// POST captures a window from Telnyx and stores anything new or changed.
//
// WHY THIS EXISTS AT ALL. Telnyx does not expose transaction detail until the
// following month. Between an event and the invoice that describes it there is
// no record of their position except one we keep ourselves — and a carrier
// that can restate a figure nobody wrote down is a carrier nobody can audit.
// This platform's previous provider was caught exactly this way.
//
// APPEND ONLY. A stored row is never updated. If a later capture returns the
// same record with different content, that becomes a second row and the
// difference is the finding. A ledger that quietly absorbs a revision cannot
// detect one, which would defeat the whole exercise.
// =============================================================================

const TELNYX_API = 'https://api.telnyx.com/v2'

/** Every billable record type on the platform. The ones nobody turned on
 *  matter most: an unexpected charge is by definition not in a category
 *  anybody is watching. */
const RECORD_TYPES = [
  'call-control', 'amd', 'recording', 'sip-trunking', 'webrtc', 'messaging',
  'ai-voice-assistant', 'inference', 'inference-speech-to-text', 'stt', 'tts',
  'noise-suppression', 'media-streaming', 'media_storage',
  'conference', 'conference-participant', 'verify', 'fax', 'wireless',
] as const

type Row = Record<string, unknown>

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** Their id for this record, whichever field this type happens to use. */
function idOf(r: Row): string | null {
  for (const k of ['id', 'uuid', 'record_id', 'call_leg_id', 'call_session_id']) {
    const v = r[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

/** The billed amount, wherever this record type puts it. Checked in order
 *  rather than assumed — a missed field would report a real charge as zero,
 *  which is the exact failure this route exists to prevent. */
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

/** Stable hash of the whole record. Keys are sorted so a re-serialisation in a
 *  different order is not mistaken for a revision. */
function hashOf(r: Row): string {
  const stable = JSON.stringify(r, Object.keys(r).sort())
  return createHash('sha256').update(stable).digest('hex').slice(0, 32)
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const days = Math.min(365, Math.max(1, parseInt(
      new URL(req.url).searchParams.get('days') || '30', 10) || 30))
    const since = new Date(Date.now() - days * 86400_000).toISOString()

    const [storedRes, revisedRes] = await Promise.all([
      supabase
        .from('telnyx_ledger_records')
        .select('record_type, cost, currency, billed_sec, occurred_at, captured_at')
        .gte('captured_at', since)
        .limit(50000),
      // The whole point of the table.
      supabase.from('telnyx_ledger_revisions').select('*').limit(500),
    ])

    const stored = (storedRes.data || []) as Array<{
      record_type: string; cost: number | null; billed_sec: number | null
      occurred_at: string | null; captured_at: string
    }>

    const byType = new Map<string, { records: number; cost: number; billedSec: number }>()
    for (const r of stored) {
      const row = byType.get(r.record_type) ?? { records: 0, cost: 0, billedSec: 0 }
      row.records++
      row.cost += Number(r.cost ?? 0)
      row.billedSec += Number(r.billed_sec ?? 0)
      byType.set(r.record_type, row)
    }

    const revisions = (revisedRes.data || []) as Array<Record<string, unknown>>

    // ── DO NOT SUM EVERY ROW. MOST OF THEM DESCRIBE THE SAME MONEY TWICE ──
    // `call.cost` is an AGGREGATE: its `cost_parts` array already contains the
    // call-control, sip-trunking and call-recording components of that leg.
    // /detail_records then reports those same components as their own rows.
    //
    // Proven by matching on leg id: 24 of 24 call-control detail records have
    // IDENTICAL billed_sec and IDENTICAL cost to the call.cost row for the same
    // leg — $0.0234 against $0.0234. Telnyx is not charging twice; it is the
    // same charge, itemised and aggregated.
    //
    // So a naive sum over this table double-counts, and would show exactly the
    // "I am being charged three times" picture that is NOT happening. Which is
    // worse than useless on a screen someone reads to answer that question.
    //
    // AMD is the exception that proves the rule: it has no cost_part in
    // call.cost at all (§1d), so it is genuinely additive. Same for anything
    // that is not a voice leg.
    const COMPONENT_OF_CALL_COST = new Set(['call-control', 'sip-trunking', 'recording'])

    const aggregate = [...byType.entries()].filter(([t]) => t === 'call.cost')
    const components = [...byType.entries()].filter(([t]) => COMPONENT_OF_CALL_COST.has(t))
    const additive = [...byType.entries()]
      .filter(([t]) => t !== 'call.cost' && !COMPONENT_OF_CALL_COST.has(t))

    const sum = (xs: Array<[string, { cost: number }]>) =>
      Math.round(xs.reduce((n, [, v]) => n + v.cost, 0) * 10000) / 10000

    return NextResponse.json({
      success: true,
      windowDays: days,
      totalRecords: stored.length,
      // call.cost + only the types it does not already contain.
      totalBilledUsd: Math.round((sum(aggregate) + sum(additive)) * 10000) / 10000,
      totals: {
        fromCallCost: sum(aggregate),
        additiveTypes: sum(additive),
        // Shown so the number is legible rather than mysterious, and flagged as
        // what it is: a second view of money already counted above.
        componentsAlreadyInCallCost: sum(components),
      },
      note_on_double_counting:
        'call.cost already contains call-control, sip-trunking and recording as ' +
        'cost_parts. Those detail rows are the SAME charge itemised, verified by ' +
        'matching leg ids, and are excluded from the total. AMD has no cost_part ' +
        'and is added.',
      byType: [...byType.entries()]
        .map(([recordType, v]) => ({
          recordType,
          records: v.records,
          billedUsd: Math.round(v.cost * 10000) / 10000,
          billedSeconds: v.billedSec,
          // The flag that stops someone adding the column up by hand.
          countedInTotal: recordType === 'call.cost' || !COMPONENT_OF_CALL_COST.has(recordType),
          ...(COMPONENT_OF_CALL_COST.has(recordType)
            ? { note: 'already included inside call.cost cost_parts' }
            : {}),
        }))
        .sort((a, b) => b.billedUsd - a.billedUsd),
      // Non-empty means a figure moved after we first read it.
      revisions,
      revisionCount: revisions.length,
      firstCapture: stored.length
        ? stored.reduce((m, r) => (r.captured_at < m ? r.captured_at : m), stored[0].captured_at)
        : null,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-ledger' })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'TELNYX_API_KEY is not configured on this deployment.' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const range: string = typeof body?.range === 'string' ? body.range : 'today'
    const types: string[] = Array.isArray(body?.types) && body.types.length
      ? body.types : [...RECORD_TYPES]

    let captured = 0
    let unchanged = 0
    let revised = 0
    const perType: Array<{ type: string; fetched: number; stored: number; error?: string }> = []

    // Shared budget: Vercel Hobby kills a function at 10s and this route does
    // not declare a maxDuration. A 19-type sweep that gets killed mid-walk
    // stores nothing and says nothing, which is how a capture silently becomes
    // seven minutes of data (see lib/telnyxDetailRecords.ts).
    const started = Date.now()
    const OVERALL_BUDGET_MS = 7_000
    const truncated: string[] = []

    for (const recordType of types) {
      const remaining = OVERALL_BUDGET_MS - (Date.now() - started)
      if (remaining < 500) {
        perType.push({ type: recordType, fetched: 0, stored: 0, error: 'skipped: time budget spent' })
        continue
      }

      try {
        const page = await fetchDetailRecords({
          apiKey, recordType, dateRange: range, budgetMs: remaining,
        })
        if (page.error && page.rows.length === 0) {
          perType.push({ type: recordType, fetched: 0, stored: 0, error: page.error })
          continue
        }
        if (page.truncated) {
          truncated.push(
            `${recordType}: stored ${page.rows.length} of ${page.totalResults ?? '?'} ` +
            `(stopped by ${page.stoppedBecause})`
          )
        }

        const rows = page.rows as Row[]
        let storedHere = 0

        // ── ONE DEDUPE QUERY PER TYPE, NOT ONE PER ROW ──────────────────
        // This used to SELECT inside the row loop. At one page of 50 that was
        // 50 queries and survivable; paging properly makes it thousands, and
        // the function dies at 10 seconds long before it finishes. Fixing the
        // pagination without fixing this would have turned a silently
        // truncated capture into one that simply times out.
        const ids = rows.map(r => idOf(r) ?? '').filter(Boolean)
        const seenByIdHash = new Set<string>()
        const seenIds = new Set<string>()
        if (ids.length > 0) {
          const { data: existing } = await supabase
            .from('telnyx_ledger_records')
            .select('telnyx_id, payload_hash')
            .eq('record_type', recordType)
            .in('telnyx_id', ids)
          for (const e of (existing || []) as Array<{ telnyx_id: string; payload_hash: string }>) {
            seenIds.add(e.telnyx_id)
            seenByIdHash.add(`${e.telnyx_id}::${e.payload_hash}`)
          }
        }

        const toInsert: Array<Record<string, unknown>> = []
        for (const r of rows) {
          const telnyxId = idOf(r)
          const payloadHash = hashOf(r)
          if (seenByIdHash.has(`${telnyxId ?? ''}::${payloadHash}`)) { unchanged++; continue }
          if (seenIds.has(telnyxId ?? '')) revised++   // same record, different content
          toInsert.push({
            record_type: recordType,
            telnyx_id: telnyxId,
            occurred_at: occurredAt(r),
            cost: costOf(r),
            rate: num(r.rate),
            billed_sec: num(r.billed_sec) ?? num(r.billed_seconds),
            currency: typeof r.currency === 'string' ? r.currency : 'USD',
            payload: r,
            payload_hash: payloadHash,
            capture_window: range,
          })
        }

        // Chunked bulk insert. A duplicate is not an error worth failing the
        // run for — two captures racing is normal and the unique index is
        // doing its job — so a failed chunk is counted, not thrown.
        for (let i = 0; i < toInsert.length; i += 500) {
          const chunk = toInsert.slice(i, i + 500)
          const { error } = await supabase.from('telnyx_ledger_records').insert(chunk)
          if (!error) { captured += chunk.length; storedHere += chunk.length }
        }

        perType.push({ type: recordType, fetched: rows.length, stored: storedHere })
      } catch (err) {
        perType.push({
          type: recordType, fetched: 0, stored: 0,
          error: err instanceof Error ? err.message : 'request failed',
        })
      }
    }

    return NextResponse.json({
      success: true,
      range,
      captured,
      unchanged,
      // The number that matters. Anything above zero is Telnyx reporting a
      // record differently than they reported it before.
      revised,
      perType: perType.filter(p => p.fetched > 0 || p.error),
      // ── SAY WHEN THE CAPTURE IS NOT THE WHOLE WINDOW ─────────────────
      // The 15 Sept capture stored exactly 50 records of every type and said
      // nothing about it — seven minutes of sip-trunking presented as a
      // ledger. Silence here is the thing that made a truncated capture look
      // like a complete one, so truncation now comes back as data.
      truncated,
      complete: truncated.length === 0,
      note: [
        revised > 0
          ? `${revised} record(s) came back different from a previous capture. See GET revisions.`
          : 'No record changed since it was last captured.',
        truncated.length > 0
          ? `INCOMPLETE: ${truncated.length} type(s) were cut short — re-run, or narrow the range. ` +
            `Stored totals for those types are PARTIAL.`
          : 'Every requested type was read to the end of the window.',
      ].join(' '),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-ledger' })
  }
}
