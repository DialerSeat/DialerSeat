import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// ACCOUNT DELETION (FK-safe, ordered, dry-run capable)
// =============================================================================
// Deletes everything a user owns, in an order that respects the real foreign-key
// constraints in the database (verified 2026-06-28):
//
//   - leads → campaigns is CASCADE; lead_notes → leads is CASCADE; so deleting
//     campaigns alone would cascade to leads+notes. We still delete leads/notes
//     explicitly first (they also carry a direct user_id) so the counts are
//     exact and nothing depends on cascade ordering.
//   - calls reference campaign/lead/team with SET NULL — calls are historical
//     records and survive parent deletion (we delete them explicitly by user_id).
//   - subscriptions → users(clerk_id) is CASCADE, team_members → teams is CASCADE.
//   - users is deleted LAST.
//
// BILLING SAFETY: a user with a LIVE Stripe subscription must NOT be hard-deleted
// while Stripe keeps billing a ghost account. This function REFUSES to delete an
// account that still has an active/past_due subscription unless the caller passes
// `allowActiveSubscription: true` (meaning they've already cancelled it in Stripe).
//
// SAFETY: pass { dryRun: true } to get exact per-table counts of what WOULD be
// deleted, touching nothing. Always dry-run first.
// =============================================================================

// Ordered so children are removed before parents where there is no cascade.
//
// NOTE on call_events: it is intentionally EXCLUDED. call_events is an
// append-only forensic log (service_role's UPDATE/DELETE were revoked to
// guarantee immutability). It cannot be row-deleted by the app, and re-granting
// DELETE just to support account deletion would weaken that guarantee globally.
// Its only user identifier is the opaque Clerk id (no name/email/phone), so
// retaining it as an immutable operational audit trail is the right tradeoff.
// If a strict "erase everything" is ever legally required, purge it separately
// as a postgres-superuser maintenance task, not through the app.
const DELETE_ORDER: Array<[string, string]> = [
  ['call_rooms', 'user_id'],
  ['dial_attempts', 'user_id'],
  ['calls', 'user_id'],
  ['lead_notes', 'user_id'],
  ['leads', 'user_id'],
  ['scripts', 'user_id'],
  ['custom_themes', 'user_id'],
  ['campaigns', 'user_id'],
  ['team_members', 'user_id'],
  ['teams', 'owner_id'],
  ['desktop_prefs', 'clerk_id'],
  ['desktop_icons', 'clerk_id'],
  ['desktop_windows', 'clerk_id'],
  ['support_submissions', 'clerk_id'],
  ['subscriptions', 'user_id'],
  ['users', 'clerk_id'], // LAST
]

export interface DeleteAccountResult {
  ok: boolean
  dryRun: boolean
  counts: Record<string, number>
  blocked?: string
}

export async function deleteAccount(
  clerkUserId: string,
  opts: { dryRun?: boolean; allowActiveSubscription?: boolean } = {}
): Promise<DeleteAccountResult> {
  const dryRun = opts.dryRun !== false // default to dry-run unless explicitly false
  const counts: Record<string, number> = {}

  // ── Billing guard ──────────────────────────────────────────────────────
  // Never hard-delete an account that still has a live Stripe subscription;
  // that would orphan billing. The caller must cancel in Stripe first and then
  // pass allowActiveSubscription: true.
  if (!opts.allowActiveSubscription) {
    const { data: liveSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', clerkUserId)
      .in('status', ['active', 'past_due'])
    if (liveSubs && liveSubs.length > 0) {
      return {
        ok: false,
        dryRun,
        counts,
        blocked:
          'Account has a live subscription. Cancel it in Stripe first, then ' +
          'retry with allowActiveSubscription: true.',
      }
    }
  }

  // ── Count (dry-run) or delete (live), in FK-safe order ─────────────────
  for (const [table, col] of DELETE_ORDER) {
    if (dryRun) {
      const { count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(col, clerkUserId)
      counts[table] = count ?? 0
    } else {
      const { count, error } = await supabaseAdmin
        .from(table)
        .delete({ count: 'exact' })
        .eq(col, clerkUserId)
      if (error) {
        // Stop on first error rather than continuing a partial delete.
        return { ok: false, dryRun, counts, blocked: `${table}: ${error.message}` }
      }
      counts[table] = count ?? 0
    }
  }

  return { ok: true, dryRun, counts }
}
