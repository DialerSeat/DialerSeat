import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

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

    return NextResponse.json({
      success: true,
      windowDays: days,
      totalRecords: stored.length,
      totalBilledUsd: Math.round(stored.reduce((n, r) => n + Number(r.cost ?? 0), 0) * 10000) / 10000,
      byType: [...byType.entries()]
        .map(([recordType, v]) => ({
          recordType,
          records: v.records,
          billedUsd: Math.round(v.cost * 10000) / 10000,
          billedSeconds: v.billedSec,
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

    for (const recordType of types) {
      const qs = new URLSearchParams()
      qs.set('filter[record_type]', recordType)
      qs.set('filter[date_range]', range)
      qs.set('page[size]', '250')
      qs.set('page[number]', '1')

      try {
        const res = await fetch(`${TELNYX_API}/detail_records?${qs}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          perType.push({
            type: recordType, fetched: 0, stored: 0,
            error: `HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`,
          })
          continue
        }

        const json = await res.json()
        const rows = Array.isArray(json?.data) ? json.data as Row[] : []
        let storedHere = 0

        for (const r of rows) {
          const telnyxId = idOf(r)
          const payloadHash = hashOf(r)

          // Was this exact content already stored? The unique index would
          // catch it, but asking first keeps the revision count honest —
          // an upsert conflict cannot tell "identical" from "changed".
          const { data: existing } = await supabase
            .from('telnyx_ledger_records')
            .select('id, payload_hash')
            .eq('record_type', recordType)
            .eq('telnyx_id', telnyxId ?? '')
            .limit(5)

          const seen = (existing || []) as Array<{ payload_hash: string }>
          if (seen.some(e => e.payload_hash === payloadHash)) { unchanged++; continue }
          if (seen.length > 0) revised++   // same record, different content

          const { error } = await supabase.from('telnyx_ledger_records').insert({
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
          // A duplicate is not an error worth failing the run for — two
          // captures racing is normal and the index is doing its job.
          if (!error) { captured++; storedHere++ }
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
      note: revised > 0
        ? `${revised} record(s) came back different from a previous capture. See GET revisions.`
        : 'No record changed since it was last captured.',
    })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-ledger' })
  }
}
