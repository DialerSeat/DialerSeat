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

export interface SuppressionHit {
  scope: 'user' | 'platform'
  reason: string | null
  source: string
}

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
  userId: string | null | undefined
): Promise<SuppressionHit | null> {
  const e164 = normalizeToE164(phone)
  if (!e164) return null

  try {
    // scope=platform matches for everyone; scope=user matches only this
    // caller's own rows. `.or` keeps it to a single index-backed query.
    let query = supabase
      .from('suppression_list')
      .select('scope, reason, source, user_id')
      .eq('phone_e164', e164)
      .limit(5)

    if (userId) {
      query = query.or(`scope.eq.platform,and(scope.eq.user,user_id.eq.${userId})`)
    } else {
      query = query.eq('scope', 'platform')
    }

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
  scope?: 'user' | 'platform'
  reason?: string | null
  source?: string
}): Promise<{ ok: boolean; error?: string }> {
  const e164 = normalizeToE164(params.phone)
  if (!e164) return { ok: false, error: 'Not a dialable number' }

  const scope = params.scope ?? 'user'
  if (scope === 'user' && !params.userId) {
    return { ok: false, error: 'user-scope suppression requires a user' }
  }

  const { error } = await supabase
    .from('suppression_list')
    .upsert(
      {
        scope,
        user_id: scope === 'user' ? params.userId : null,
        phone_e164: e164,
        reason: params.reason ?? null,
        source: params.source ?? 'manual',
      },
      { onConflict: scope === 'platform' ? 'phone_e164' : 'user_id,phone_e164', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[suppression] add failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
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
