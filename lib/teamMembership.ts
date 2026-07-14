import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { userCacheTag } from '@/lib/tenant'

// If the team owner runs an active whitelabel tenant, a newly-active agent
// should see that brand, not the default DialerSeat experience. This is the
// one piece that was only ever wired into the slow manual-approval path —
// every other activation path (instant partner seats, agent-pays-after-
// checkout) needs to call this too, or the agent silently ends up on the
// wrong brand.
export async function assignOwnerTenantIfWhitelabeled(
  agentClerkId: string,
  ownerId: string
): Promise<string | null> {
  const { data: ownerTenant } = await supabaseAdmin
    .from('white_label_tenants')
    .select('id')
    .eq('owner_clerk_id', ownerId)
    .eq('status', 'active')
    .eq('is_active', true)
    .maybeSingle()

  if (!ownerTenant) return null

  const { error: tenantErr } = await supabaseAdmin
    .from('users')
    .update({ active_tenant_id: ownerTenant.id })
    .eq('clerk_id', agentClerkId)

  if (tenantErr) {
    console.warn('failed to set active_tenant_id:', tenantErr)
    return null
  }

  revalidateTag(userCacheTag(agentClerkId), { expire: 0 })
  return ownerTenant.id
}

// Symmetric with activatePendingTeamMember — when an agent-pays
// subscription is canceled, their team access shouldn't quietly continue
// forever. Revokes campaign access and marks the membership removed;
// doesn't touch the whitelabel tenant assignment, since losing dialer
// access isn't the same as needing to see different branding on whatever's
// left of their account.
export async function deactivateTeamMember(memberId: string): Promise<void> {
  await supabaseAdmin
    .from('team_campaign_access')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('team_member_id', memberId)
    .eq('is_active', true)

  await supabaseAdmin
    .from('team_members')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('status', 'active')
}
// Flips a pending team_members row to active, activates any campaign access
// grants that were created alongside it (but left inactive pending this
// moment), and assigns the owner's whitelabel tenant if applicable. This is
// the exact set of steps that used to live only in members/accept — now
// shared so the agent-pays-after-checkout path (triggered from the Stripe
// webhook, not a user click) gets identical behavior.
export async function activatePendingTeamMember(memberId: string): Promise<{
  activatedAccessGrants: number
  defaultedToTenantId: string | null
}> {
  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, user_id, team_id, teams!inner(owner_id)')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) {
    return { activatedAccessGrants: 0, defaultedToTenantId: null }
  }

  const ownerId = (member as any).teams.owner_id

  await supabaseAdmin
    .from('team_members')
    .update({ status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', memberId)

  const { data: activated } = await supabaseAdmin
    .from('team_campaign_access')
    .update({ is_active: true })
    .eq('team_member_id', memberId)
    .eq('is_active', false)
    .is('revoked_at', null)
    .select('id')

  const defaultedToTenantId = await assignOwnerTenantIfWhitelabeled(member.user_id, ownerId)

  return { activatedAccessGrants: activated?.length || 0, defaultedToTenantId }
}
