import { getServiceClient } from '@/lib/supabase'
import { normalizeToE164 } from '@/lib/phoneNormalize'

// =============================================================================
// SUPPRESSION — numbers that must not be dialed
// =============================================================================
// "Do not call" previously existed only as a per-lead DISPOSITION, which has
// two holes worth naming, because both are the kind that surface as a
// complaint rather than a bug report:
//
//   1. The same person imported into a second campaign is a different lead
//      row, with no disposition, and gets dialed again.
//   2. Scrubbing a number out of one list says nothing about the next CSV.
//
// A disposition describes a lead. Suppression describes a NUMBER, which is
// what the person actually asked you to stop calling.
//
// SCOPE OF WHAT THIS IS: an internal suppression list. It is NOT National DNC
// Registry scrubbing — that requires a subscription and an organizational
// registration, and the Terms correctly place registry scrubbing on the
// customer today. This is the layer a registry feed would write into if that
// changes: add rows with scope 'platform' and source 'registry' and every
// enforcement path below picks them up with no further work.
// =============================================================================

const supabase = getServiceClient('suppression')

export type SuppressionScope = 'campaign' | 'user' | 'platform'

export interface SuppressionHit {
  scope: SuppressionScope
  reason: string | null
  source: string
}

/**
 * How widely an agent's DO NOT CALL disposition suppresses a number.
 *
 * 'campaign' by product decision: a campaign is one opt-in form, so another
 * campaign is a separate form the person filled out and a separate permission.
 * Suppressing everywhere on the strength of one campaign throws away a lead
 * they asked for.
 *
 * Isolated to a constant on purpose. A person saying "stop calling me" is a
 * company-specific do-not-call request under 16 CFR 310.4(b)(1)(iii)(A), which
 * attaches to the SELLER rather than to one form — so if that reading is ever
 * preferred, changing this single value to 'user' widens every DNC write
 * without touching any of the plumbing around it.
 */
export const DNC_DISPOSITION_SCOPE: SuppressionScope = 'campaign'

/**
 * Whether this number is suppressed for this caller.
 *
 * Checks the platform list and the caller's own list in ONE query — the dial
 * path cannot afford two round trips, and two sequential lookups would double
 * the added latency on every call for no benefit.
 *
 * Returns null when the number is clear. FAILS OPEN on error: a suppression
 * lookup that cannot complete must not stop a legitimate business from
 * dialing, and the per-lead disposition check still runs regardless.
 */
export async function checkSuppression(
  phone: string,
  userId: string | null | undefined,
  campaignId?: string | null
): Promise<SuppressionHit | null> {
  const e164 = normalizeToE164(phone)
  if (!e164) return null

  try {
    // scope=platform matches for everyone; scope=user matches only this
    // caller's own rows. `.or` keeps it to a single index-backed query.
    let query = supabase
      .from('suppression_list')
      .select('scope, reason, source, user_id, campaign_id')
      .eq('phone_e164', e164)
      .limit(5)

    // Three scopes, one query. platform matches everyone; user matches this
    // caller's own rows; campaign matches only the campaign being dialled —
    // which is the whole point, since a DNC on one form says nothing about
    // another form the same person filled out.
    const clauses = ['scope.eq.platform']
    if (userId) clauses.push(`and(scope.eq.user,user_id.eq.${userId})`)
    if (campaignId) clauses.push(`and(scope.eq.campaign,campaign_id.eq.${campaignId})`)
    query = query.or(clauses.join(','))

    const { data, error } = await query
    if (error) {
      console.error('[suppression] lookup failed, allowing dial:', error.message)
      return null
    }
    if (!data || data.length === 0) return null

    // Platform beats user when both match — it's the stronger statement and
    // the more useful one to show in a log line.
    const hit = data.find(r => r.scope === 'platform') ?? data[0]
    return {
      scope: hit.scope as 'user' | 'platform',
      reason: hit.reason ?? null,
      source: hit.source,
    }
  } catch (err) {
    console.error('[suppression] lookup threw, allowing dial:', err)
    return null
  }
}

/**
 * Add a number to a suppression list. Idempotent — re-suppressing an already
 * suppressed number is a no-op rather than an error, because the callers are
 * things like "agent marked DO NOT CALL", which can legitimately happen twice.
 */
export async function addSuppression(params: {
  phone: string
  userId?: string | null
  campaignId?: string | null
  scope?: SuppressionScope
  reason?: string | null
  source?: string
}): Promise<{ ok: boolean; error?: string }> {
  const e164 = normalizeToE164(params.phone)
  if (!e164) return { ok: false, error: 'Not a dialable number' }

  const scope = params.scope ?? 'user'
  if (scope === 'user' && !params.userId) {
    return { ok: false, error: 'user-scope suppression requires a user' }
  }
  // A campaign-scoped row with no campaign would silently suppress nothing:
  // every lookup filters on campaign_id, so the row could never match.
  if (scope === 'campaign' && !params.campaignId) {
    return { ok: false, error: 'campaign-scope suppression requires a campaign' }
  }

  const { error } = await supabase
    .from('suppression_list')
    .upsert(
      {
        scope,
        user_id: scope === 'user' ? params.userId : null,
        campaign_id: scope === 'campaign' ? params.campaignId : null,
        phone_e164: e164,
        reason: params.reason ?? null,
        source: params.source ?? 'manual',
      },
      {
        onConflict:
          scope === 'platform' ? 'phone_e164'
          : scope === 'campaign' ? 'campaign_id,phone_e164'
          : 'user_id,phone_e164',
        ignoreDuplicates: true,
      }
    )

  if (error) {
    console.error('[suppression] add failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Undo a suppression this platform created from a DISPOSITION.
 *
 * ── WHY THIS HAD TO EXIST ──────────────────────────────────────────────────
 * addSuppression had no counterpart, so "mark DO NOT CALL" was a one-way door
 * with no handle on the other side. Changing the lead's disposition back moved
 * status and disposition and looked like a restore -- the row left the DNC
 * filter, went dialable again on paper -- while checkSuppression still matched
 * the number and refused the dial. A lead that reads as restored and cannot be
 * called is worse than one that plainly reads as DNC.
 *
 * ── IT ONLY REMOVES WHAT A DISPOSITION PUT THERE ───────────────────────────
 * Narrowed to source='disposition' deliberately. The same table holds rows
 * from an uploaded scrub list, a platform-wide block, and an inbound STOP
 * text. Those are somebody exercising a right, and an agent re-dispositioning
 * a lead must never be able to delete them by accident -- so this can only
 * lift the suppression that this platform wrote from this action.
 *
 * Scope must match too. A campaign DNC lifts the campaign row; it leaves a
 * user- or platform-scoped block exactly where it is.
 */
export async function removeSuppression(params: {
  phone: string
  userId?: string | null
  campaignId?: string | null
  scope?: SuppressionScope
}): Promise<{ ok: boolean; removed: number; error?: string }> {
  const e164 = normalizeToE164(params.phone)
  if (!e164) return { ok: false, removed: 0, error: 'Not a dialable number' }

  const scope = params.scope ?? 'user'
  if (scope === 'campaign' && !params.campaignId) {
    return { ok: false, removed: 0, error: 'campaign-scope removal requires a campaign' }
  }
  if (scope === 'user' && !params.userId) {
    return { ok: false, removed: 0, error: 'user-scope removal requires a user' }
  }
  // Platform scope is not removable here at all. A platform block is an
  // operator decision and has no business being lifted by a disposition.
  if (scope === 'platform') {
    return { ok: false, removed: 0, error: 'platform suppressions are not lifted by a disposition' }
  }

  let q = supabase
    .from('suppression_list')
    .delete({ count: 'exact' })
    .eq('phone_e164', e164)
    .eq('scope', scope)
    .eq('source', 'disposition')

  q = scope === 'campaign'
    ? q.eq('campaign_id', params.campaignId as string)
    : q.eq('user_id', params.userId as string)

  const { error, count } = await q
  if (error) {
    console.error('[suppression] remove failed:', error.message)
    return { ok: false, removed: 0, error: error.message }
  }
  return { ok: true, removed: count ?? 0 }
}

/**
 * Bulk-add, for CSV uploads. Numbers that don't normalize are reported rather
 * than silently dropped — a customer uploading a scrub list needs to know
 * which rows didn't take, or they'll believe they're covered when they aren't.
 */
export async function addSuppressionBulk(
  phones: string[],
  userId: string,
  source = 'upload'
): Promise<{ added: number; invalid: string[] }> {
  const invalid: string[] = []
  const rows: { scope: string; user_id: string; phone_e164: string; source: string }[] = []
  const seen = new Set<string>()

  for (const raw of phones) {
    const e164 = normalizeToE164(raw)
    if (!e164) {
      invalid.push(raw)
      continue
    }
    if (seen.has(e164)) continue
    seen.add(e164)
    rows.push({ scope: 'user', user_id: userId, phone_e164: e164, source })
  }

  if (rows.length === 0) return { added: 0, invalid }

  // Chunked: a single insert of a large scrub list can exceed the request
  // limit, and a partial failure there would leave the customer thinking the
  // whole upload landed.
  const CHUNK = 1000
  let added = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('suppression_list')
      .upsert(chunk, { onConflict: 'user_id,phone_e164', ignoreDuplicates: true })
    if (error) {
      console.error('[suppression] bulk chunk failed:', error.message)
      continue
    }
    added += chunk.length
  }

  return { added, invalid }
}
