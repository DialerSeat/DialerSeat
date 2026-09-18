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

/**
 * Hold one lead at the top, whatever the rotation says.
 *
 * A lead being worked must not move until its whole 1x/2x/3x sequence is
 * over. The client cannot achieve that by simply not stamping it, because the
 * server stamps leads.last_called_at on its own — see the queue-rotation
 * stamp and the attempt-release writes in app/api/calls/events/route.ts — so
 * the next queue refetch sank a lead that was still mid-sequence, between its
 * first and second dial.
 *
 * Pinning states the rule directly instead of racing those writes: whoever is
 * in the dialer's hands right now is the top row. It is released the moment
 * the sequence ends and currentLead is cleared, and the ordinary rotation
 * then applies.
 *
 * Display only. The dial order must never pin, or the server would be handed
 * the same lead as its next pick; in-sequence redials do not consult it
 * anyway, because they call dialLeadCall directly against the held lead.
 */
export function pinToTop<T extends { id: string }>(
  order: readonly T[],
  pinnedLeadId?: string | null
): T[] {
  if (!pinnedLeadId) return [...order]
  const index = order.findIndex(lead => lead.id === pinnedLeadId)
  if (index <= 0) return [...order]
  const copy = [...order]
  const [pinned] = copy.splice(index, 1)
  return [pinned, ...copy]
}
