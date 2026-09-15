import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { fetchDetailRecords, truncationNote } from '@/lib/telnyxDetailRecords'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// =============================================================================
// /api/admin/telnyx-charges — what Telnyx actually billed, today, per record
// =============================================================================
// The portal hides transaction detail until the following month, which is why
// every cost answer on this platform has been an inference: our rates times
// our usage, reconciled against a balance that only moves in whole cents and
// settles in batches hours late.
//
// That inference broke down on 14 Sept. Two debits of $2.03 and $2.12 landed
// inside a window whose entire billable activity — thirty calls, 117 seconds
// of talk, 71 seconds of recording — models out at seven cents. Sixty times
// off, with no explanation available until October.
//
// GET /v2/detail_records answers it now. Every record carries `cost`, `rate`
// and `currency`, so this is not our estimate of what something should have
// cost; it is the number Telnyx billed.
//
// ── WHY IT ASKS FOR EVERY RECORD TYPE ───────────────────────────────────────
// Because the surprise is by definition not in the category anybody is
// watching. Calls and AMD are already modelled and already add up. A charge
// that does not fit belongs to something nobody knew was running — voice AI,
// inference, speech-to-text, media streaming, noise suppression are all
// separately billed product lines on the same account, and any of them would
// appear exactly like this: real money, no matching row in our tables.
//
// Read-only. It spends nothing and changes nothing.
// =============================================================================

const TELNYX_API = 'https://api.telnyx.com/v2'


/**
 * Every billable record type the platform exposes.
 *
 * Ordered with the ones we already model first, so a reader can see those
 * reconcile before reaching the ones that might not.
 */
const RECORD_TYPES = [
  'call-control',
  'amd',
  'recording',
  'sip-trunking',
  'webrtc',
  'messaging',
  // Separately billed product lines. None of these should be running.
  'ai-voice-assistant',
  'inference',
  'inference-speech-to-text',
  'stt',
  'tts',
  'noise-suppression',
  'media-streaming',
  'media_storage',
  'conference',
  'conference-participant',
  'verify',
  'fax',
  'wireless',
] as const

interface Charge {
  recordType: string
  count: number
  totalCost: number
  currency: string
  /** The individual records that cost the most, for reading by eye. */
  largest: Array<Record<string, unknown>>
  error?: string
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0
  return Number.isFinite(n) ? n : 0
}

/** A record's billed amount, wherever this record type happens to put it. */
function costOf(r: Record<string, unknown>): number {
  // Telnyx is not consistent across record types: some carry a flat `cost`,
  // others nest it. Checked in order rather than assumed, because a missed
  // field would silently report a real charge as zero — which is the exact
  // failure this route exists to stop.
  const direct = r.cost ?? r.total_cost ?? r.billed_cost
  if (direct !== undefined && direct !== null) return num(direct)
  const nested = (r.cost as { amount?: unknown } | undefined)?.amount
  return num(nested)
}

export async function GET(req: NextRequest) {
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
    const url = new URL(req.url)
    // Explicit ISO range wins; otherwise a preset Telnyx understands.
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const dateRange = url.searchParams.get('range') || 'today'
    const only = url.searchParams.get('type')

    const types = only ? [only] : [...RECORD_TYPES]
    const charges: Charge[] = []

    // Budget shared across every type, so a 19-type sweep cannot be killed by
    // the 10s Hobby function timeout partway through with nothing to show.
    const started = Date.now()
    const OVERALL_BUDGET_MS = 7_000
    const truncations: string[] = []

    for (const recordType of types) {
      const remaining = OVERALL_BUDGET_MS - (Date.now() - started)
      if (remaining < 500) {
        charges.push({
          recordType, count: 0, totalCost: 0, currency: 'USD', largest: [],
          error: 'skipped: overall time budget spent. Narrow the range or use ?type=',
        })
        continue
      }

      // ── PAGED, BECAUSE ONE PAGE IS 50 ROWS ───────────────────────────
      // This used to set page[number]=1 and stop. Telnyx caps a page at 50
      // however large a page[size] you ask for, so a full day of sip-trunking
      // came back as SEVEN MINUTES of it — while `count` below reported
      // meta.total_results, the true figure. An accurate count beside a cost
      // summed from one page reads as authoritative and is wrong by ~200x.
      const page = await fetchDetailRecords({
        apiKey, recordType, dateRange, from, to, budgetMs: remaining,
      })

      if (page.error && page.rows.length === 0) {
        // A record type this account has never used commonly 404s or 422s.
        // Reported rather than swallowed: "we did not check" and "there was
        // nothing there" are different answers.
        charges.push({
          recordType, count: 0, totalCost: 0, currency: 'USD', largest: [],
          error: page.error,
        })
        continue
      }

      const note = truncationNote(page, recordType)
      if (note) truncations.push(note)

      const total = page.rows.reduce((n, r) => n + costOf(r), 0)
      charges.push({
        recordType,
        // Telnyx's own total when we have it, so the gap against what we
        // actually summed is visible rather than hidden.
        count: page.totalResults ?? page.rows.length,
        totalCost: Math.round(total * 10000) / 10000,
        currency: String(page.rows[0]?.currency ?? 'USD'),
        largest: page.rows
          .slice()
          .sort((a, b) => costOf(b) - costOf(a))
          .slice(0, 5)
          .filter(r => costOf(r) > 0),
        ...(note ? { error: note } : {}),
      })
    }

    const withCharges = charges.filter(c => c.totalCost > 0)
    const grandTotal = withCharges.reduce((n, c) => n + c.totalCost, 0)

    return NextResponse.json({
      success: true,
      window: from && to ? { from, to } : { range: dateRange },
      grandTotalUsd: Math.round(grandTotal * 10000) / 10000,
      // Sorted by cost so whatever is unexpected is at the top rather than
      // buried under the lines that were always going to be there.
      charged: withCharges.sort((a, b) => b.totalCost - a.totalCost),
      noCharges: charges.filter(c => c.totalCost === 0 && !c.error).map(c => c.recordType),
      unavailable: charges.filter(c => c.error).map(c => ({ type: c.recordType, error: c.error })),
      note:
        'Billed amounts straight from Telnyx, not our rate model. A record type '
        + 'listed under noCharges was queried and returned nothing; one under '
        + 'unavailable was not successfully queried at all.',
    })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-charges' })
  }
}
