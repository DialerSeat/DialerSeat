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
 * Detailed access info — used by UI to show what's keeping the user active.
 * Existing gates (proxy.ts, requireActive) use the simpler getAccessTier()
 * which collapses this to 'active' | 'lapsed' | 'new'.
 */
export interface DetailedAccess {
  tier: AccessTier
  via: 'self' | 'seat' | null      // why active (or null if not active)
  hasSelfSub: boolean              // user has own $35/week
  activeSeatTeamIds: string[]      // team IDs where user has an owner-paid seat
}

/**
 * Returns true if the user has an own subscription that grants active access.
 * Pulled out so seat-checking and self-checking can share the same logic.
 */
async function checkSelfSubActive(clerkId: string): Promise<{ active: boolean; hasHistory: boolean }> {
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', clerkId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[subscription] self-sub lookup failed:', error)
    // Fail open: treat as active so a Supabase outage doesn't lock everyone out.
    return { active: true, hasHistory: true }
  }

  if (!subs || subs.length === 0) {
    return { active: false, hasHistory: false }
  }

  const now = Date.now()

  for (const sub of subs) {
    if (ACTIVE_STATUSES.includes(sub.status)) {
      return { active: true, hasHistory: true }
    }
    if (
      sub.status === 'canceled' &&
      sub.current_period_end &&
      new Date(sub.current_period_end).getTime() > now
    ) {
      return { active: true, hasHistory: true }
    }
  }

  return { active: false, hasHistory: true }
}

/**
 * Returns team IDs where this user has an active member row AND the seat is
 * currently being paid for by the owner (recent paid charge for current period).
 *
 * For 'recruit' codes there's no owner payment — those don't grant access via
 * this path; recruit-code users still need their own $35 sub.
 *
 * For 'public' team campaigns, no charge exists at all — those bypass tier
 * checks entirely at the campaign level (handled later, not here).
 */
async function getActiveTeamSeats(clerkId: string): Promise<string[]> {
  const now = new Date().toISOString()

  // Find active memberships joined via seat (not recruit) codes that have a
  // current paid charge covering today.
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      team_id,
      status,
      team_seat_charges!inner (
        status,
        period_start,
        period_end
      )
    `)
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .eq('team_seat_charges.status', 'paid')
    .lte('team_seat_charges.period_start', now)
    .gte('team_seat_charges.period_end', now)

  if (error) {
    console.error('[subscription] team seat lookup failed:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Dedupe team_ids in case multiple charges overlap
  return Array.from(new Set(data.map((r: any) => r.team_id)))
}

/**
 * Determines a user's access tier (collapsed to 3 states for backward compat).
 *
 *   active  - own sub active OR has at least one paid team seat
 *   lapsed  - has subscription history OR was previously on a paid seat,
 *             but nothing currently grants access
 *   new     - never had a sub AND never been on a paid seat
 *
 * Used by proxy.ts and requireActive(). Existing call sites keep working.
 */
export async function getAccessTier(clerkId: string): Promise<AccessTier> {
  const self = await checkSelfSubActive(clerkId)
  if (self.active) return 'active'

  const activeSeats = await getActiveTeamSeats(clerkId)
  if (activeSeats.length > 0) return 'active'

  // Not currently active — figure out 'lapsed' vs 'new'.
  if (self.hasHistory) return 'lapsed'

  // Check if they were ever on a paid seat (for lapsed-via-seat detection).
  const { data: seatHistory } = await supabase
    .from('team_seat_charges')
    .select('id')
    .eq('agent_id', clerkId)
    .eq('status', 'paid')
    .limit(1)

  if (seatHistory && seatHistory.length > 0) return 'lapsed'

  return 'new'
}

/**
 * Detailed access — for UI use only. Tells the dashboard whether to show
 * "PRO PLAN" (own sub), "SEAT (Team X)" badge, or "UNSUBSCRIBED".
 */
export async function getDetailedAccess(clerkId: string): Promise<DetailedAccess> {
  const self = await checkSelfSubActive(clerkId)
  const activeSeats = await getActiveTeamSeats(clerkId)

  let tier: AccessTier = 'new'
  let via: 'self' | 'seat' | null = null

  if (self.active) {
    tier = 'active'
    via = 'self'
  } else if (activeSeats.length > 0) {
    tier = 'active'
    via = 'seat'
  } else if (self.hasHistory) {
    tier = 'lapsed'
  } else {
    // Check seat history for lapsed-via-seat
    const { data: seatHistory } = await supabase
      .from('team_seat_charges')
      .select('id')
      .eq('agent_id', clerkId)
      .eq('status', 'paid')
      .limit(1)

    if (seatHistory && seatHistory.length > 0) tier = 'lapsed'
  }

  return {
    tier,
    via,
    hasSelfSub: self.active,
    activeSeatTeamIds: activeSeats,
  }
}

/**
 * Server-side guard for API routes that mutate state and require active subscription.
 * Returns NextResponse 401/403 if user is unauthenticated or not active.
 * Returns null if check passes — call site continues normally.
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
 * Stricter guard: requires the user's OWN $35 sub, not a team seat.
 * Used for actions only available to self-paying users:
 *   - Creating a team
 *   - Uploading own leads / running own campaigns
 */
export async function requireSelfSub(): Promise<NextResponse | null> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const self = await checkSelfSubActive(userId)
  if (!self.active) {
    return NextResponse.json(
      {
        error: 'Personal subscription required',
        reason: 'self_sub_required',
        redirectTo: '/billing',
      },
      { status: 403 }
    )
  }

  return null
}

export interface AuthTierResult {
  error: NextResponse | null
  userId: string | null
  tier: AccessTier | null
}

/**
 * Server-side guard that returns the authenticated userId and tier together.
 * Use when the route needs the userId regardless of tier.
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
 */
export async function requireNotAdmin(clerkId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] admin check failed:', error)
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