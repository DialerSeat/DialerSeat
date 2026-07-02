import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AccessTier = 'active' | 'lapsed' | 'new'

const ACTIVE_STATUSES = ['active']  // strict: only a paid, active sub grants access (no trials; past_due is locked)

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