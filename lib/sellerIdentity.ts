import { getServiceClient } from '@/lib/supabase'
import { canRunMultiLine } from '@/lib/tsrAbandonMessage'

// =============================================================================
// WHO IS NAMED WHEN NOBODY IS FREE
// =============================================================================
// Predictive's recorded message (lib/tsrAbandonMessage) names the seller and a
// callback number. The seller is the business on whose behalf the call was
// placed, so the two details are set once per account in Settings, and a
// campaign uses its OWNER's: a team campaign speaks for the team owner, never
// for the agent who happened to dial it.
//
// Predictive is gated on them. Every gate asks this file, so "is this campaign
// allowed to run predictive" has one answer: the campaign update and create
// routes, /api/dialer/arm, the controller and the abandon message itself.
// =============================================================================

const db = getServiceClient('seller-identity')

export interface SellerIdentity {
  name: string | null
  callbackNumber: string | null
  /** Both present and a message can be built from them. */
  ready: boolean
}

export interface CampaignSeller extends SellerIdentity {
  ownerClerkId: string
}

function toIdentity(row: { tsr_seller_name?: string | null; tsr_callback_number?: string | null } | null): SellerIdentity {
  const name = row?.tsr_seller_name ?? null
  const callbackNumber = row?.tsr_callback_number ?? null
  return { name, callbackNumber, ready: canRunMultiLine({ name, callbackNumber }) }
}

export async function sellerIdentityForUser(clerkId: string): Promise<SellerIdentity> {
  const { data } = await db
    .from('users')
    .select('tsr_seller_name, tsr_callback_number')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  return toIdentity(data)
}

/**
 * The owner's details for each campaign. A campaign that cannot be read is
 * absent from the map, and callers treat absent as not ready.
 */
export async function sellerIdentityForCampaigns(campaignIds: string[]): Promise<Map<string, CampaignSeller>> {
  const out = new Map<string, CampaignSeller>()
  const ids = Array.from(new Set(campaignIds.filter(Boolean)))
  if (ids.length === 0) return out

  const { data: camps } = await db.from('campaigns').select('id, user_id').in('id', ids)
  const owners = Array.from(new Set((camps || []).map(c => c.user_id as string).filter(Boolean)))
  if (owners.length === 0) return out

  const { data: users } = await db
    .from('users')
    .select('clerk_id, tsr_seller_name, tsr_callback_number')
    .in('clerk_id', owners)
  const byOwner = new Map((users || []).map(u => [u.clerk_id as string, u]))

  for (const c of camps || []) {
    const owner = c.user_id as string
    out.set(c.id as string, { ownerClerkId: owner, ...toIdentity(byOwner.get(owner) ?? null) })
  }
  return out
}

/** The error every predictive gate returns, so the browser can open the popup. */
export const SELLER_INFO_REQUIRED = 'SELLER_INFO_REQUIRED'
