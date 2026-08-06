// =============================================================================
// TELNYX RECORDING PLAYBACK
// =============================================================================
// WHY THIS FILE EXISTS — the bug it fixes:
//
// Telnyx's `call.recording.saved` webhook hands you `recording_urls.mp3`, and
// it looks like a permanent link. It is not. It is a presigned S3 URL:
//
//   https://s3.amazonaws.com/telephony-recorder-prod/...?X-Amz-Expires=600&...
//
// X-Amz-Expires=600. Ten minutes. Every recording URL written to the database
// was dead before anyone opened the Recordings tab, which is exactly what the
// player showed: a 502 from the proxy, an <audio> element with no audio, and
// a scrubber reading 0:00 / 0:00.
//
// Two things were wrong, and the second would have broken playback even
// inside those ten minutes:
//
//   1. The URL expires. Storing it is storing a receipt, not a recording.
//   2. The old proxy sent `Authorization: Bearer <TELNYX_API_KEY>` when
//      fetching it. S3 rejects a request that carries BOTH a presigned query
//      signature and an Authorization header — "Only one auth mechanism
//      allowed". The header was added defensively, on the theory that an
//      extra header is harmless. On presigned S3 URLs it is fatal.
//
// THE APPROACH: store the recording's own stable id (calls.recording_id) and
// mint a fresh download URL at play time. The id never expires; the URL is
// generated seconds before it's used. `recording_url` stays in the table as
// evidence a recording exists and for legacy rows, but nothing plays from it.
//
// Range requests are forwarded and 206 responses passed through intact.
// Without that, seeking in the player doesn't work and some browsers can't
// determine duration at all — the other half of "0:00 / 0:00".
// =============================================================================

const TELNYX_API = 'https://api.telnyx.com/v2'

export interface RecordingRow {
  id: string
  recording_id?: string | null
  recording_url?: string | null
  call_control_id?: string | null
}

/**
 * Look up a recording's id from its call, for rows saved before recording_id
 * existed. Telnyx's list endpoint accepts a call_control_id filter, so this
 * is one request, not a page-scan.
 */
async function findRecordingIdByCall(
  callControlId: string,
  apiKey: string
): Promise<string | null> {
  const url = `${TELNYX_API}/recordings?filter[call_control_id]=${encodeURIComponent(callControlId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return null

  const json = await res.json().catch(() => null)
  const rows: Array<{ id?: string; status?: string }> = json?.data || []
  // Prefer a completed one; a recording still being written has no usable audio.
  const done = rows.find(r => r.status === 'completed') || rows[0]
  return done?.id || null
}

/**
 * Hard-delete a recording at Telnyx.
 *
 * This used to be attempted by regexing an id out of recording_url — but the
 * stored URL is an S3 link (`s3.amazonaws.com/telephony-recorder-prod/...`)
 * with no `/recordings/<id>` segment in it, so the regex never matched and
 * NOTHING was ever deleted provider-side. Retention cleared the local column
 * and left the audio sitting on Telnyx indefinitely. With a real id, deletion
 * works.
 *
 * Returns true when the recording is gone (404 counts — it's already gone).
 */
export async function deleteTelnyxRecording(
  call: RecordingRow,
  apiKey: string
): Promise<boolean> {
  let id = call.recording_id || null
  if (!id && call.call_control_id) {
    id = await findRecordingIdByCall(call.call_control_id, apiKey)
  }
  if (!id) return false

  try {
    const res = await fetch(`${TELNYX_API}/recordings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

/** Ask Telnyx for a download URL that is valid right now. */
async function freshDownloadUrl(
  recordingId: string,
  apiKey: string
): Promise<string | null> {
  const res = await fetch(`${TELNYX_API}/recordings/${encodeURIComponent(recordingId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return null

  const json = await res.json().catch(() => null)
  const urls = json?.data?.download_urls
  return urls?.mp3 || urls?.wav || null
}

/**
 * Is this stored URL still worth trying? Only true for the handful of seconds
 * after a call ends, and only for URLs that carry an expiry we can read.
 */
export function presignedStillValid(url: string, now: number = Date.now()): boolean {
  try {
    const q = new URL(url).searchParams
    const date = q.get('X-Amz-Date')       // 20260805T112018Z
    const expires = Number(q.get('X-Amz-Expires') || 0)
    if (!date || !expires) return false

    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T` +
                `${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`
    const signedAt = Date.parse(iso)
    if (Number.isNaN(signedAt)) return false

    // 30s of headroom so we never hand back a URL that dies mid-stream.
    return now < signedAt + (expires - 30) * 1000
  } catch {
    return false
  }
}

export interface ResolveResult {
  url: string
  /** Set when we learned the id and the caller should persist it. */
  discoveredRecordingId?: string
}

/**
 * Produce a URL that will actually serve audio when fetched, or null.
 */
export async function resolvePlayableUrl(
  call: RecordingRow,
  apiKey: string
): Promise<ResolveResult | null> {
  if (call.recording_id) {
    const url = await freshDownloadUrl(call.recording_id, apiKey)
    if (url) return { url }
  }

  // Legacy row, or the id lookup failed. Recover the id from the call itself.
  if (call.call_control_id) {
    const found = await findRecordingIdByCall(call.call_control_id, apiKey)
    if (found) {
      const url = await freshDownloadUrl(found, apiKey)
      if (url) return { url, discoveredRecordingId: found }
    }
  }

  // Last resort: the stored URL, but only if it hasn't expired yet — which
  // in practice means the call ended in the last few minutes.
  if (call.recording_url && presignedStillValid(call.recording_url)) {
    return { url: call.recording_url }
  }

  return null
}

/**
 * Stream a recording to the client, forwarding Range so the player can seek.
 *
 * NOTE the deliberate absence of an Authorization header on this fetch: the
 * URL is presigned, and S3 refuses requests that present two auth mechanisms.
 */
export async function streamRecording(
  url: string,
  opts: { range?: string | null; download?: boolean; filename?: string }
): Promise<Response> {
  const upstream = await fetch(url, {
    headers: opts.range ? { Range: opts.range } : {},
    cache: 'no-store',
  })

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Recording fetch failed: ${upstream.status}`, { status: 502 })
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
    // Never cache at the CDN: the response is per-user audio behind auth.
    'Cache-Control': 'private, max-age=0, no-store',
    'Accept-Ranges': 'bytes',
  })

  // Content-Length is what lets the browser compute duration up front. Pass
  // it through, along with Content-Range on a partial response.
  const len = upstream.headers.get('Content-Length')
  if (len) headers.set('Content-Length', len)
  const contentRange = upstream.headers.get('Content-Range')
  if (contentRange) headers.set('Content-Range', contentRange)

  if (opts.download) {
    headers.set('Content-Disposition', `attachment; filename="${opts.filename || 'recording.mp3'}"`)
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}
