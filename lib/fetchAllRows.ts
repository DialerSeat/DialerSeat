// =============================================================================
// fetchAllRows — page through a Supabase select instead of silently losing rows
// =============================================================================
// PostgREST caps every request at a maximum row count. On Supabase that default
// is 1000, and — this is the dangerous part — it is not an error. A query that
// matches 5,000 rows returns 200 OK with 1,000 of them, and nothing in the
// response says so. Any total computed from that data is simply wrong, and
// wrong in the direction that looks plausible.
//
// That is exactly how it got missed: /api/analytics/summary and
// /api/analytics/timeseries both selected from `calls` with no limit, so every
// user with more than 1000 calls in range was shown a call count, talk time and
// conversion rate computed from an arbitrary 1000-row slice. The numbers looked
// reasonable. They were not.
//
// Anything aggregating a full table for a user should page through it with this
// rather than trusting a bare select.
//
// ORDERING IS REQUIRED, NOT OPTIONAL. range() is offset pagination: without a
// stable sort the database may return rows in a different order per page, which
// duplicates some rows and drops others. Every caller here sorts by created_at.
// =============================================================================

type PageResult<T> = { data: T[] | null; error: unknown }

export interface FetchAllRowsResult<T> {
  rows: T[]
  error: unknown
  /** True when maxRows stopped the walk early, so `rows` is incomplete. */
  truncated: boolean
}

export async function fetchAllRows<T>(
  /**
   * Builds ONE page. Must apply .range(from, to) and a stable .order().
   * Called repeatedly, so it has to construct a fresh query each time —
   * a Supabase query builder cannot be re-executed with a new range.
   */
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = 1000, maxRows = 250_000 }: { pageSize?: number; maxRows?: number } = {}
): Promise<FetchAllRowsResult<T>> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { rows, error, truncated: false }

    const batch = data ?? []
    rows.push(...batch)

    // A short page means the end of the result set. This is the normal exit
    // and the only one that guarantees rows is complete.
    if (batch.length < pageSize) return { rows, error: null, truncated: false }

    from += pageSize

    // A ceiling so a runaway query cannot pull an unbounded result into memory.
    // Reported rather than hidden — a caller that hits this is showing partial
    // data and should say so, which is the whole failure this file exists to
    // stop repeating.
    if (rows.length >= maxRows) return { rows, error: null, truncated: true }
  }
}
