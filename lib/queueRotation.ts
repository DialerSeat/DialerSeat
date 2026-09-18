/**
 * Queue rotation — where a lead sits after it has been dialled.
 *
 * The rule: a lead is dialled, it moves to the bottom of the queue, the next
 * lead starts. It is never blocked from being dialled again; when it comes
 * back round it is dialable like any other.
 *
 * Getting this wrong produced the 1x redial. Sorting on the lead row's
 * last_called_at alone is not enough, because placing a call writes nothing to
 * the lead row — /api/calls/outbound only reads it. last_called_at is written
 * by exactly one thing, disposeLead, and the voicemail path deliberately
 * writes no disposition, so for that outcome the column stays null forever.
 * The lead held position 0 and was handed straight back by the next fetch.
 *
 * So rotation reads two sources and takes the later:
 *   - the server's last_called_at, which covers earlier sessions
 *   - this session's dial log, which covers everything the server was never
 *     told about, and which a queue refetch cannot overwrite
 *
 * One timestamp per lead, not a list: the only question rotation asks is "when
 * was this last dialled". An earlier version kept every timestamp to enforce a
 * per-lead cap; that cap was the thing making INITIATE DIAL SEQUENCE dead, and
 * with it gone the list has no remaining purpose. A plain record also works
 * unchanged as React state and as a ref, which is what lets the panel and the
 * dial path share exactly this logic.
 */

/** Lead id → when it was last dialled, ms since epoch. */
export type DialLog = Record<string, number>

export interface RotatableLead {
  id: string
  last_called_at?: string | null
}

/**
 * When this lead was last dialled, as ms. 0 means never — which sorts to the
 * top, ahead of anything that has been called.
 */
export function rotationKey(lead: RotatableLead, log: DialLog): number {
  const parsed = lead.last_called_at ? Date.parse(lead.last_called_at) : 0
  const server = Number.isFinite(parsed) ? parsed : 0
  return Math.max(server, log[lead.id] ?? 0)
}

/**
 * Reorder so recently dialled leads sink. Reorders only — every lead stays in
 * the list and stays dialable. Stable, so the panel's own order (created_at,
 * or an active shuffle) survives among leads that share a key.
 */
export function sinkDialedLeads<T extends RotatableLead>(
  order: readonly T[],
  log: DialLog
): T[] {
  return order
    .map((lead, index) => ({ lead, index, key: rotationKey(lead, log) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map(entry => entry.lead)
}

/**
 * Record a dial, returning a new log. Every dial goes through here, including
 * the in-sequence redials of a 2x or 3x.
 */
export function recordDial(log: DialLog, leadId: string, now: number): DialLog {
  return { ...log, [leadId]: now }
}
