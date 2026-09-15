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
const MAX_PAGES = 200

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
    if (opts.from && opts.to) {
      qs.set('filter[created_at][gte]', opts.from)
      qs.set('filter[created_at][lt]', opts.to)
    } else {
      qs.set('filter[date_range]', opts.dateRange || 'today')
    }
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

  return {
    rows,
    totalResults,
    pagesFetched,
    truncated: totalResults !== null && rows.length < totalResults,
    stoppedBecause: pagesFetched >= MAX_PAGES ? 'page_cap' : 'exhausted',
  }
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
