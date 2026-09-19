// =============================================================================
// PAGING TELNYX'S DETAIL RECORDS, AND KNOWING WHEN YOU DIDN'T GET THEM ALL
// =============================================================================
// GET /v2/detail_records is the only place several charges exist at all. AMD is
// the proof: it is billed as its own record type at $0.002 an invocation and
// appears NOWHERE in the call.cost webhook, so 13% of the bill was invisible
// until this endpoint was read (docs/COST-FINDINGS.md §1d).
//
// ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
// Both callers set `page[number]` to 1 and never incremented it. Telnyx caps a
// page at 50 rows regardless of the `page[size]=250` we ask for, so a capture
// on 15 Sept returned exactly 50 records of every type — covering SEVEN MINUTES
// of sip-trunking and twelve of call-control, out of a full day.
//
// Worse, `/api/admin/telnyx-charges` then reported `meta.total_results` as the
// count next to a cost summed over those 50 rows. An accurate record count
// beside a cost understated ~200x reads as authoritative and is not. A number
// that is wrong and looks right is worse than no number.
//
// So: page properly, and make truncation IMPOSSIBLE TO MISS when it happens.

const TELNYX_API = 'https://api.telnyx.com/v2'

/** Telnyx caps a detail-records page at 50 whatever we ask for. Ask anyway. */
const REQUEST_PAGE_SIZE = 250

/** Hard stop. 200 pages x 50 = 10,000 records, far beyond a normal day. */
// Telnyx serves 50 per page whatever page[size] asks for, so this is a record
// cap of MAX_PAGES * 50. At 200 it was 10,000, and a calendar month of this
// account's traffic is roughly 16,000 sip-trunking CDRs — so a 'this_month'
// walk would have stopped two thirds of the way through and reported a ratio
// over a partial month, which is the exact failure this capture exists to
// avoid. The time budget, not this, is meant to be what stops a walk.
const MAX_PAGES = 600

/**
 * Wall-clock budget. Vercel Hobby kills a function at 10 seconds by default and
 * neither admin route declares a `maxDuration`, so a long page walk would be
 * killed mid-write with no result at all. Stopping early and SAYING SO beats
 * being terminated silently — the caller reports `truncated` either way.
 */
const DEFAULT_BUDGET_MS = 6_000

export interface DetailRecordPage {
  rows: Array<Record<string, unknown>>
  /** Telnyx's own count for the filter, independent of what we fetched. */
  totalResults: number | null
  pagesFetched: number
  /** True when rows.length is less than Telnyx says exists. */
  truncated: boolean
  /** Why it stopped, for the response. */
  stoppedBecause: 'exhausted' | 'page_cap' | 'time_budget' | 'error'
  error?: string
}

/**
 * Fetch every page of one record type, within a time budget.
 *
 * Never throws. A failure mid-walk returns what was gathered plus the error,
 * because half a ledger with a reason is more useful than an exception.
 */
export async function fetchDetailRecords(opts: {
  apiKey: string
  recordType: string
  /** Either a Telnyx preset ('today', 'yesterday', …) … */
  dateRange?: string
  /** … or an explicit ISO window, which wins if both are given. */
  from?: string | null
  to?: string | null
  budgetMs?: number
}): Promise<DetailRecordPage> {
  const started = Date.now()
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS
  const rows: Array<Record<string, unknown>> = []
  let totalResults: number | null = null
  let pagesFetched = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (Date.now() - started > budget) {
      return {
        rows, totalResults, pagesFetched, stoppedBecause: 'time_budget',
        truncated: totalResults === null ? true : rows.length < totalResults,
      }
    }

    const qs = new URLSearchParams()
    qs.set('filter[record_type]', opts.recordType)
    // ── DATE_RANGE IS THE ONLY DATE FILTER THIS ENDPOINT HAS ─────────────
    // This used to send filter[created_at][gte] / [lt] for an explicit
    // window. /detail_records does not support it. The documented filters are
    // filter[record_type] and filter[date_range], the latter taking presets:
    // today, yesterday, this_week, last_week, this_month, last_month, and the
    // dynamic last_N_days.
    //
    // It failed silently rather than erroring, which is why it survived: the
    // compliance cron ran every six hours for four days and stored nothing,
    // while the sibling route that happened to pass a preset kept working.
    // The table held thirty-seven minutes of one day and the month-to-date
    // ratio computed off it looked plausible.
    //
    // An explicit window is now served by asking for the smallest preset that
    // covers it and trimming the result to the window here. Slightly more
    // data over the wire; it is the difference between a number and no
    // number.
    qs.set('filter[date_range]', coveringRange(opts))
    qs.set('page[size]', String(REQUEST_PAGE_SIZE))
    qs.set('page[number]', String(page))

    let json: { data?: unknown; meta?: { total_results?: number } }
    try {
      const res = await fetch(`${TELNYX_API}/detail_records?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = await res.text()
        return {
          rows, totalResults, pagesFetched, stoppedBecause: 'error',
          truncated: true,
          error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
        }
      }
      json = await res.json()
    } catch (err) {
      return {
        rows, totalResults, pagesFetched, stoppedBecause: 'error',
        truncated: true,
        error: err instanceof Error ? err.message : 'request failed',
      }
    }

    const batch = Array.isArray(json?.data)
      ? (json.data as Array<Record<string, unknown>>)
      : []
    if (typeof json?.meta?.total_results === 'number') totalResults = json.meta.total_results

    rows.push(...batch)
    pagesFetched = page

    // An empty page, or one Telnyx says completes the set, ends the walk. We
    // do NOT compare against REQUEST_PAGE_SIZE: Telnyx returns 50 when asked
    // for 250, so "short page" would end the walk after page one — which is
    // exactly the bug this replaces.
    if (batch.length === 0) break
    if (totalResults !== null && rows.length >= totalResults) break
  }

  // Trimmed to the requested window, because the preset above is a superset
  // of it. totalResults stays as Telnyx reported it for the preset, so
  // `truncated` still answers "did we see everything the preset held".
  const windowed = (opts.from && opts.to)
    ? rows.filter(r => withinWindow(r, opts.from as string, opts.to as string))
    : rows

  return {
    rows: windowed,
    totalResults,
    pagesFetched,
    truncated: totalResults !== null && rows.length < totalResults,
    stoppedBecause: pagesFetched >= MAX_PAGES ? 'page_cap' : 'exhausted',
  }
}

/**
 * The smallest documented preset that contains the caller's window.
 *
 * An explicit dateRange always wins — a caller that named one meant it.
 */
export function coveringRange(opts: { dateRange?: string; from?: string | null; to?: string | null }): string {
  if (opts.dateRange) return opts.dateRange
  if (!opts.from) return 'today'

  const fromMs = Date.parse(opts.from)
  if (!Number.isFinite(fromMs)) return 'today'

  const startOfTodayUtc = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  if (fromMs >= startOfTodayUtc) return 'today'

  // Whole days back from the start of today, inclusive of the day `from`
  // lands in. last_N_days is the documented dynamic preset.
  const daysBack = Math.ceil((startOfTodayUtc - fromMs) / 86_400_000) + 1
  return `last_${Math.min(Math.max(daysBack, 2), 90)}_days`
}

/** Every timestamp field Telnyx uses across the record types we capture. */
const TIME_KEYS = ['created_at', 'started_at', 'occurred_at', 'completed_at', 'finished_at']

export function rowTimeMs(r: Record<string, unknown>): number | null {
  for (const k of TIME_KEYS) {
    const v = r[k]
    if (typeof v === 'string' && v.length > 0) {
      const t = Date.parse(v)
      if (Number.isFinite(t)) return t
    }
  }
  return null
}

/**
 * Half-open [from, to), matching the filter this replaced.
 *
 * A row carrying no readable timestamp is KEPT. Dropping it would silently
 * lose records over a formatting difference, and the caller dedupes anyway —
 * a stray row outside the window is far cheaper than a missing one inside it.
 */
export function withinWindow(r: Record<string, unknown>, from: string, to: string): boolean {
  const t = rowTimeMs(r)
  if (t === null) return true
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return true
  return t >= fromMs && t < toMs
}

/** One line a human can read to know whether to trust the number beside it. */
export function truncationNote(p: DetailRecordPage, recordType: string): string | null {
  if (!p.truncated) return null
  return (
    `${recordType}: fetched ${p.rows.length} of ${p.totalResults ?? 'unknown'} records ` +
    `over ${p.pagesFetched} page(s), stopped by ${p.stoppedBecause}. ` +
    `THE COST BELOW IS A PARTIAL SUM, not the total for this type.`
  )
}
