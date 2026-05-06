import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AccessTier = 'active' | 'lapsed' | 'new'

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

/**
 * Determines a user's access tier.
 *
 *   active  - currently paying OR canceled-but-still-within-paid-period
 *   lapsed  - has at least one subscription row, but no current access (paid for a period before)
 *   new     - never had a subscription row (forced to /billing)
 *
 * Single source of truth: the `subscriptions` table (has period_end + cancel_at_period_end).
 * `users.subscription_status` is treated as a denormalized cache only.
 */
export async function getAccessTier(clerkId: string): Promise<AccessTier> {
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', clerkId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[subscription] tier lookup failed:', error)
    // Fail open on DB errors so a Supabase outage doesn't lock everyone out.
    // Webhook is still source of truth, chargeback defense unaffected.
    return 'active'
  }

  if (!subs || subs.length === 0) {
    return 'new'
  }

  const now = Date.now()

  for (const sub of subs) {
    // Currently in an active billing state
    if (ACTIVE_STATUSES.includes(sub.status)) {
      return 'active'
    }

    // Canceled but still within their paid-for period
    if (
      sub.status === 'canceled' &&
      sub.current_period_end &&
      new Date(sub.current_period_end).getTime() > now
    ) {
      return 'active'
    }
  }

  // Has subscription history, but nothing currently active and no remaining paid period.
  return 'lapsed'
}

/**
 * Server-side guard for API routes that mutate state and require active subscription.
 * Returns NextResponse 401/403 if user is unauthenticated or not active.
 * Returns null if check passes — call site continues normally.
 *
 * Usage:
 *   const gate = await requireActive()
 *   if (gate) return gate
 *   // ... proceed with mutation
 */
export async function requireActive(): Promise<NextResponse | null> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tier = await getAccessTier(userId)
  if (tier !== 'active') {
    return NextResponse.json(
      {
        error: 'Active subscription required',
        tier,
        redirectTo: '/billing',
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Result of getAuthAndTier — either an error response, or a userId + tier.
 * Check `result.error` first; if null, `result.userId` and `result.tier` are populated.
 */
export interface AuthTierResult {
  error: NextResponse | null
  userId: string | null
  tier: AccessTier | null
}

/**
 * Server-side guard that returns the authenticated userId and tier together.
 * Use when the route needs the userId regardless of tier (e.g. read-only routes
 * that allow lapsed users but still need ownership checks).
 *
 * Usage:
 *   const { error, userId, tier } = await getAuthAndTier()
 *   if (error) return error
 *   // userId and tier are now non-null
 */
export async function getAuthAndTier(): Promise<AuthTierResult> {
  const { userId } = await auth()
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      userId: null,
      tier: null,
    }
  }
  const tier = await getAccessTier(userId)
  return { error: null, userId, tier }
}

/**
 * Server-side guard that blocks admin users from performing the action.
 * Used on cancel-sub to prevent admin-account self-cancellation.
 */
export async function requireNotAdmin(clerkId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] admin check failed:', error)
    // Fail closed on this one — better to incorrectly block than incorrectly allow
    // an admin to cancel their own sub.
    return NextResponse.json({ error: 'Permission check failed' }, { status: 500 })
  }

  if (data?.is_admin) {
    return NextResponse.json(
      { error: 'Admin accounts cannot perform this action.' },
      { status: 403 }
    )
  }

  return null
}