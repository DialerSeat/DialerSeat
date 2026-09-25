import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { checkSellerIdentity, formatCallbackNumber } from '@/lib/sellerIdentityFormat'
import { sellerIdentityForUser, sellerIdentityForCampaigns } from '@/lib/sellerIdentity'

// =============================================================================
// THE BUSINESS NAME AND CALLBACK NUMBER PREDICTIVE NEEDS
// =============================================================================
// GET  -> this account's two details, and whether predictive may use them.
//         ?campaignId=... also says whether THAT campaign may run predictive,
//         which is its owner's details, not necessarily the caller's.
// POST { name, callbackNumber } -> save them. Both empty clears them.
//
// Written from Settings and from the popup the dialer, the campaign editor and
// the team campaign page open when someone picks predictive without them.
// =============================================================================

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const own = await sellerIdentityForUser(userId)
    const campaignId = new URL(req.url).searchParams.get('campaignId')

    let campaign: { ownerIsYou: boolean; ready: boolean } | null = null
    if (campaignId && !campaignId.includes(':')) {
      const seller = (await sellerIdentityForCampaigns([campaignId])).get(campaignId)
      campaign = seller
        ? { ownerIsYou: seller.ownerClerkId === userId, ready: seller.ready }
        : null
    }

    return NextResponse.json({
      success: true,
      name: own.name ?? '',
      callbackNumber: formatCallbackNumber(own.callbackNumber),
      ready: own.ready,
      campaign,
    })
  } catch (error) {
    return apiError(error, { route: 'account/seller-identity' })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const checked = checkSellerIdentity(body?.name, body?.callbackNumber)
    if (!checked.ok) {
      return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        tsr_seller_name: checked.name,
        tsr_callback_number: checked.callbackNumber,
      })
      .eq('clerk_id', userId)
    if (error) throw error

    const saved = await sellerIdentityForUser(userId)
    return NextResponse.json({
      success: true,
      name: saved.name ?? '',
      callbackNumber: formatCallbackNumber(saved.callbackNumber),
      ready: saved.ready,
    })
  } catch (error) {
    return apiError(error, { route: 'account/seller-identity' })
  }
}
