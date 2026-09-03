// ─────────────────────────────────────────────────────────────────────────
// LARGE UPLOADS, POSTED IN PIECES
//
// Vercel rejects any request body over 4.5MB with a 413 raised before our
// handler runs, so a fifty-thousand-row file cannot be one request no matter
// what the server does. The campaign lead cap is gone; this is what makes that
// actually usable rather than merely permitted.
//
// SIZED BY BYTES, NOT BY ROWS. A row-count chunk is a guess about width: a bare
// name-and-phone list and a CRM export carrying twenty custom fields differ by
// an order of magnitude per row, so any fixed row count is too small for one
// and too large for the other. Measuring the encoded size is exact, and costs a
// JSON.stringify per row that we were going to pay anyway.
//
// SEQUENTIAL, NOT PARALLEL. Each chunk's dedupe reads what previous chunks
// wrote, so overlapping requests would race and let duplicates through — the
// exact thing dedupe exists to stop. In-order also means a failure has an
// unambiguous meaning: everything before it landed, nothing after it did.
//
// SAFE TO RETRY. The endpoint dedupes each call against what is already in the
// campaign, so re-uploading the same file after a partial failure re-adds
// nothing. That is what makes "just upload it again" honest advice rather than
// a way to double somebody's list.
// ─────────────────────────────────────────────────────────────────────────

/** Well under Vercel's 4.5MB limit, leaving room for the JSON envelope and
 *  headers. Smaller chunks also mean a failure loses less progress. */
const TARGET_CHUNK_BYTES = 2_000_000

/** A single row larger than this cannot be made to fit by chunking at all. */
const MAX_SINGLE_ROW_BYTES = 4_000_000

export interface UploadRejection {
  reason: string
  count: number
  examples?: string[]
}

export interface UploadFailure {
  error: string
  detail?: string
  rejected?: number
  rejections?: UploadRejection[]
  warnings?: UploadRejection[]
}

export interface UploadResult {
  ok: boolean
  /** Rows the server confirmed it saved, across every chunk. */
  saved: number
  /** Rows we attempted to send. */
  attempted: number
  withConsent: number
  /** The campaign's true total after the last successful chunk. */
  total: number | null
  rejections: UploadRejection[]
  rejectedTotal: number
  /** Imported, but not dialable — same per-reason shape as rejections. */
  warnings: UploadRejection[]
  /** Set when the subscription has lapsed — the caller shows its own banner. */
  lapsed: boolean
  failure: UploadFailure | null
}

export interface UploadProgress {
  chunk: number
  chunks: number
  sent: number
  totalRows: number
}

function chunkBySize(leads: any[]): any[][] {
  const chunks: any[][] = []
  let current: any[] = []
  let currentBytes = 0

  for (const lead of leads) {
    // +1 for the separating comma; close enough, and erring high is the safe
    // direction when the consequence of erring low is a 413.
    const bytes = JSON.stringify(lead).length + 1

    if (current.length > 0 && currentBytes + bytes > TARGET_CHUNK_BYTES) {
      chunks.push(current)
      current = []
      currentBytes = 0
    }
    current.push(lead)
    currentBytes += bytes
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/** Merge per-reason rejection tallies across chunks without losing examples. */
function mergeRejections(into: Map<string, UploadRejection>, from: any) {
  if (!Array.isArray(from)) return
  for (const r of from) {
    if (!r || typeof r.reason !== 'string') continue
    const existing = into.get(r.reason)
    if (existing) {
      existing.count += Number(r.count) || 0
      if (Array.isArray(r.examples) && existing.examples) {
        for (const ex of r.examples) {
          if (existing.examples.length < 3) existing.examples.push(ex)
        }
      }
    } else {
      into.set(r.reason, {
        reason: r.reason,
        count: Number(r.count) || 0,
        examples: Array.isArray(r.examples) ? r.examples.slice(0, 3) : [],
      })
    }
  }
}

export async function uploadLeadsInChunks(
  campaignId: string,
  leads: any[],
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  const result: UploadResult = {
    ok: false,
    saved: 0,
    attempted: leads.length,
    withConsent: 0,
    total: null,
    rejections: [],
    rejectedTotal: 0,
    warnings: [],
    lapsed: false,
    failure: null,
  }

  const rejectionMap = new Map<string, UploadRejection>()
  const warningMap = new Map<string, UploadRejection>()
  const finish = (): UploadResult => {
    result.rejections = Array.from(rejectionMap.values())
    result.warnings = Array.from(warningMap.values())
    return result
  }

  // One row too big to ever fit. Naming the row is the whole point — otherwise
  // the user is told their file is too large when in fact one cell is.
  const oversize = leads.findIndex(l => JSON.stringify(l).length > MAX_SINGLE_ROW_BYTES)
  if (oversize !== -1) {
    result.failure = {
      error: `Row ${oversize + 1} is too large to upload on its own.`,
      detail:
        'One row in this file is several megabytes, which usually means a note ' +
        'or custom field contains pasted content. Shorten that row and try again.',
    }
    return finish()
  }

  const chunks = chunkBySize(leads)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    onProgress?.({
      chunk: i + 1,
      chunks: chunks.length,
      sent: result.saved,
      totalRows: leads.length,
    })

    let res: Response
    try {
      res = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, leads: chunk }),
      })
    } catch {
      // The network, not the server. Distinguished because the advice differs:
      // nothing to fix in the file.
      result.failure = {
        error: result.saved > 0
          ? `Saved ${result.saved.toLocaleString()} leads, then the connection dropped.`
          : 'Could not reach DialerSeat to upload these leads.',
        detail: result.saved > 0
          ? 'Upload the same file again, leads already saved are skipped as duplicates.'
          : 'Check your connection and try again. Nothing was uploaded.',
      }
      return finish()
    }

    if (res.status === 403) {
      result.lapsed = true
      return finish()
    }

    // 413 means the sizing above was wrong. It should not happen, and saying so
    // plainly beats a generic failure that sends somebody hunting in their file.
    if (res.status === 413) {
      result.failure = {
        error: result.saved > 0
          ? `Saved ${result.saved.toLocaleString()} leads, then a batch was rejected as too large.`
          : 'This file could not be split into small enough uploads.',
        detail: 'Try splitting the file in half and uploading each part.',
      }
      return finish()
    }

    let data: any = null
    try {
      data = await res.json()
    } catch {
      // A gateway timeout or platform error returns HTML, not JSON. Without
      // this branch it surfaced as a bare "upload could not be completed".
      data = null
    }

    if (!data) {
      result.failure = {
        error: result.saved > 0
          ? `Saved ${result.saved.toLocaleString()} of ${leads.length.toLocaleString()} leads, then the server stopped responding.`
          : 'The server did not respond to this upload.',
        detail: result.saved > 0
          ? 'Upload the same file again, leads already saved are skipped as duplicates.'
          : 'Try again in a moment.',
      }
      return finish()
    }

    result.saved += Number(data.count) || 0
    result.withConsent += Number(data.withConsent) || 0
    if (typeof data.total === 'number') result.total = data.total
    result.rejectedTotal += Number(data.rejected) || 0
    mergeRejections(rejectionMap, data.rejections)
    mergeRejections(warningMap, data.warnings)

    if (!res.ok || !data.success) {
      // A chunk that rejected every row for a real reason (all duplicates, say)
      // is not a failure of the upload — it is a result, and the tallies above
      // already carry it. Only stop when the server reports an actual problem.
      const everyRowRejected =
        (Number(data.rejected) || 0) > 0 && (Number(data.count) || 0) === 0
      if (everyRowRejected && chunks.length > 1 && res.status === 400) {
        continue
      }

      result.failure = {
        error: typeof data.error === 'string'
          ? data.error
          : 'The upload could not be completed.',
        detail: typeof data.detail === 'string' ? data.detail : undefined,
        rejected: result.rejectedTotal,
        rejections: Array.from(rejectionMap.values()),
        warnings: Array.from(warningMap.values()),
      }
      return finish()
    }
  }

  onProgress?.({
    chunk: chunks.length,
    chunks: chunks.length,
    sent: result.saved,
    totalRows: leads.length,
  })

  result.ok = true
  return finish()
}
