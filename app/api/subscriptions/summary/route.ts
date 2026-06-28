import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

/**
 * Unified subscriptions summary for the authenticated user.
 *
 * Returns:
 *   - personalSub: their own $35/wk DialerSeat subscription, if any
 *   - ownerPaidSeats: team seats where someone else (the team owner) is paying for them
 *   - agentPaidSeats: team seats where the user is paying themselves
 *
 * Used by:
 *   - Sidebar (tier-with-seat label)
 *   - Settings page (stacked subscriptions display)
 *
 * No tier gate — lapsed users still need to see their own subs to act on them.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Personal subscription — read from /api/stripe/status's source of truth (users table)
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('subscription_status, stripe_customer_id, is_admin')
      .eq('clerk_id', userId)
      .maybeSingle()

    let personalSub: any = null
    if (u && u.subscription_status) {
      // Status mapping mirrors lib/subscription.ts tier logic
      const status = u.subscription_status
      const isActive = status === 'active'
      const isLapsed = ['past_due', 'unpaid', 'canceled', 'incomplete_expired'].includes(status)
      personalSub = {
        status,
        isActive,
        isLapsed,
        isAdmin: !!u.is_admin,
      }
    }

    // Owner-paid seats — others paying for THIS user
    // team_seat_charges rows where agent_id = current user, status = active
    const { data: ownerPaidRows } = await supabaseAdmin
      .from('team_seat_charges')
      .select(`
        id,
        team_id,
        owner_id,
        team_member_id,
        amount_cents,
        status,
        period_start,
        period_end,
        stripe_subscription_id,
        teams(id, name, owner_id)
      `)
      .eq('agent_id', userId)
      .in('status', ['active', 'pending'])

    const ownerIdsForLookup = Array.from(new Set(
      (ownerPaidRows || [])
        .map((r: any) => r.teams?.owner_id || r.owner_id)
        .filter(Boolean)
    ))

    // Agent-paid seats — THIS user is paying for their own seat on someone's team
    const { data: agentPaidRows } = await supabaseAdmin
      .from('team_agent_payments')
      .select(`
        id,
        team_id,
        campaign_id,
        stripe_subscription_id,
        status,
        teams(id, name, owner_id),
        campaigns(id, name)
      `)
      .eq('agent_id', userId)
      .in('status', ['active', 'pending'])

    const moreOwnerIds = (agentPaidRows || [])
      .map((r: any) => r.teams?.owner_id)
      .filter(Boolean)

    const allOwnerIds = Array.from(new Set([...ownerIdsForLookup, ...moreOwnerIds]))

    // Resolve owner identities
    const ownerById: Record<string, { name: string; email: string | null }> = {}
    if (allOwnerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', allOwnerIds)
      for (const o of owners || []) {
        const fullName = [o.first_name, o.last_name].filter(Boolean).join(' ').trim()
        ownerById[o.clerk_id] = {
          name: fullName || o.email || 'Team owner',
          email: o.email,
        }
      }
    }

    const ownerPaidSeats = (ownerPaidRows || []).map((r: any) => {
      const ownerId = r.teams?.owner_id || r.owner_id
      const owner = ownerById[ownerId]
      return {
        id: r.id,
        teamId: r.team_id,
        teamName: r.teams?.name || 'Team',
        ownerName: owner?.name || 'Team owner',
        ownerEmail: owner?.email || null,
        amountCents: r.amount_cents,
        status: r.status,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        payer: 'owner' as const,
      }
    })

    const agentPaidSeats = (agentPaidRows || []).map((r: any) => {
      const owner = r.teams?.owner_id ? ownerById[r.teams.owner_id] : null
      return {
        id: r.id,
        teamId: r.team_id,
        teamName: r.teams?.name || 'Team',
        ownerName: owner?.name || 'Team owner',
        campaignId: r.campaign_id,
        campaignName: r.campaigns?.name || null,
        status: r.status,
        payer: 'agent' as const,
      }
    })

    return NextResponse.json({
      success: true,
      personalSub,
      ownerPaidSeats,
      agentPaidSeats,
      counts: {
        ownerPaid: ownerPaidSeats.length,
        agentPaid: agentPaidSeats.length,
        totalSeats: ownerPaidSeats.length + agentPaidSeats.length,
      },
    })
  } catch (error: any) {
    console.error('Subscriptions summary error:', error)
    return apiError(error, { route: 'subscriptions/summary' })
  }
}