import { supabaseAdmin } from '@/lib/supabase'
import { isSubscriptionTrulyActive } from '@/lib/subscriptionStatus'

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
      .select('id, status, cancel_at_period_end')
      .eq('user_id', clerkUserId)
      .in('status', ['active', 'past_due'])

    // Canceling a subscription only ever sets cancel_at_period_end: true —
    // Stripe leaves status: 'active' until the period actually ends. A user
    // who cancels and then immediately asks to delete their account has
    // already done the right thing; blocking them here because the status
    // column hasn't caught up yet just traps them with no way to actually
    // delete until the billing period runs out on its own. Only a
    // subscription that's genuinely still open-ended (not scheduled to
    // cancel) — or past_due, which is ambiguous and should be resolved in
    // Stripe first — should block deletion. This mirrors the same
    // isSubscriptionTrulyActive definition every admin surface already uses
    // to answer "is this really a live subscription right now".
    const genuinelyLive = (liveSubs || []).filter(
      (s) => s.status === 'past_due' || isSubscriptionTrulyActive(s)
    )

    if (genuinelyLive.length > 0) {
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
      if (table === 'subscriptions') {
        // A subscription that reached here was either never live, or was
        // scheduled to cancel (allowed above) rather than genuinely active.
        // Either way, don't leave it sitting in Stripe pointing at an
        // account that's about to be gone — cancel it immediately instead
        // of waiting for the period to run out on its own.
        const { data: rowsToCancel } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_subscription_id, status')
          .eq('user_id', clerkUserId)
          .in('status', ['active', 'past_due'])

        for (const row of rowsToCancel || []) {
          if (!row.stripe_subscription_id) continue
          try {
            const { stripe } = await import('@/lib/stripe')
            await stripe.subscriptions.cancel(row.stripe_subscription_id)
          } catch (err) {
            console.warn('[deleteAccount] failed to cancel Stripe subscription', row.stripe_subscription_id, err)
          }
        }
      }

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
