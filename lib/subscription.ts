import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { ENTITLED_STATUSES } from '@/lib/entitlement'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AccessTier = 'active' | 'lapsed' | 'new'

// One shared definition — see lib/entitlement.ts. This and proxy.ts each had
// their own copy, which is the difference between a customer being locked out
// and a stranger dialling for free, kept in step by a comment.
const ACTIVE_STATUSES: readonly string[] = ENTITLED_STATUSES

export interface DetailedAccess {
  tier: AccessTier
  via: 'self' | 'seat' | null      // why active (or null if not active)
  hasSelfSub: boolean              // user has own $35/week
  activeSeatTeamIds: string[]      // team IDs where user has an owner-paid seat
}

async function checkSelfSubActive(clerkId: string): Promise<{ active: boolean; hasHistory: boolean }> {
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', clerkId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[subscription] self-sub lookup failed:', error)

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

async function getActiveTeamSeats(clerkId: string): Promise<string[]> {
  const now = new Date().toISOString()

  // ── A SEAT IS ACCESS, NOT A RECEIPT ──────────────────────────────────────
  // This required an !inner join to a team_seat_charges row with status 'paid'
  // covering today. So an agent admitted on an owner-paid code could not dial
  // until money had actually moved — and since the charge is created when the
  // owner approves, and settles some time after that, a new hire's first
  // experience was being bounced to a billing page for a seat somebody else
  // had already agreed to pay for.
  //
  // Product decision, deliberate: entry is granted by MEMBERSHIP, and billing
  // is settled alongside rather than in front of it. An owner whose card
  // declines still has an agent working — that is the owner's problem to fix,
  // and they hold the lever, because pausing the seat (seat_suspended_at) cuts
  // access immediately.
  //
  // The gate that remains is the one that means something: the membership is
  // active and the seat has not been suspended. Agent-pays members stay
  // 'pending' until their own checkout succeeds, so they are excluded by the
  // status filter and this does not open a door for them.
  void now
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, status, seat_suspended_at')
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .is('seat_suspended_at', null)

  if (error) {
    console.error('[subscription] team seat lookup failed:', error)
    return []
  }

  if (!data || data.length === 0) return []

  return Array.from(new Set(data.map((r: any) => r.team_id)))
}

export async function getAccessTier(clerkId: string): Promise<AccessTier> {
  const self = await checkSelfSubActive(clerkId)
  if (self.active) return 'active'

  const activeSeats = await getActiveTeamSeats(clerkId)
  if (activeSeats.length > 0) return 'active'

  if (self.hasHistory) return 'lapsed'

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
 * Is this person waiting on a seat SOMEBODY ELSE has agreed to pay for?
 *
 * Two different questions get conflated otherwise. "Which teams may I work" is
 * answered by getActiveTeamSeats and requires an accepted membership — a
 * team's campaigns must not open to someone the owner has not yet approved.
 * "May I be in DialerSeat at all" is a different question, and for an agent
 * handed an owner-paid invite the answer is yes from the moment they redeem it.
 *
 * Sending them to a billing page instead is the product contradicting the one
 * promise the invite made. They wait for approval inside the app, not outside
 * it behind a checkout for a seat that is not theirs to buy.
 *
 * Agent-pays memberships are deliberately excluded: nobody has agreed to cover
 * those, so a checkout is exactly where that person should be.
 */
async function hasOwnerFundedPendingSeat(clerkId: string): Promise<boolean> {
  const { data: pendingRows, error } = await supabase
    .from('team_members')
    .select('id, billing_override, joined_via_code')
    .eq('user_id', clerkId)
    .eq('status', 'pending')
    .is('seat_suspended_at', null)
    .limit(25)

  if (error) {
    // Fail closed. This only ever GRANTS access, so a lookup failure must not
    // hand it out for free.
    console.error('[subscription] owner-funded pending seat lookup failed:', error)
    return false
  }
  if (!pendingRows || pendingRows.length === 0) return false

  // An explicit override on the membership settles it without another query.
  if (pendingRows.some((m: any) => m.billing_override === 'owner')) return true

  // Otherwise the code they joined with decides. joined_via_code holds the code
  // TEXT, not a foreign key — team_members has no relationship to team_codes —
  // so this is a second lookup rather than an embed. An embed would have been
  // rejected by PostgREST and, because this fails closed, would have quietly
  // granted nobody anything.
  const codes = pendingRows
    .map((m: any) => m.joined_via_code)
    .filter((c: string | null): c is string => !!c)
  if (codes.length === 0) return false

  const { data: codeRows, error: codeErr } = await supabase
    .from('team_codes')
    .select('code, payer')
    .in('code', codes)

  if (codeErr) {
    console.error('[subscription] pending seat code lookup failed:', codeErr)
    return false
  }

  return (codeRows || []).some((c: any) => c.payer === 'owner')
}

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
  } else if (await hasOwnerFundedPendingSeat(clerkId)) {
    // In the product, with no team access yet. activeSeatTeamIds stays empty
    // on purpose: they can look around and wait, not dial someone else's list.
    tier = 'active'
    via = 'seat'
  } else if (self.hasHistory) {
    tier = 'lapsed'
  } else {

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

export async function shouldSeeWelcome(clerkId: string): Promise<boolean> {

  const self = await checkSelfSubActive(clerkId)
  if (self.active) return false

  const activeSeats = await getActiveTeamSeats(clerkId)
  if (activeSeats.length > 0) return false

  const { data: preservedRow, error } = await supabase
    .from('data_preserved_users')
    .select('clerk_id')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] shouldSeeWelcome preserved check failed:', error)

    return false
  }

  if (preservedRow) return false

  return true
}