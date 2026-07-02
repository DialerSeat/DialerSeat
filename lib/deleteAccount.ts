import { supabaseAdmin } from '@/lib/supabase'

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

        return { ok: false, dryRun, counts, blocked: `${table}: ${error.message}` }
      }
      counts[table] = count ?? 0
    }
  }

  return { ok: true, dryRun, counts }
}
