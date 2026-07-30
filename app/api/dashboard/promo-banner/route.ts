import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// Dashboard-facing read for the promo/announcement banner.
//
// Same audience rule and same shape of guarantees as
// /api/dashboard/dialer-down:
//   - Requires a signed-in user (401 otherwise).
//   - Requires an active Pro or Manager+ plan — lapsed/new/no-plan users
//     get { enabled: false } even if the banner is actually live.
//   - Returns only { enabled, message, textColor, bgColor } — never
//     updatedBy.
//   - When enabled is false, message/colors are always the defaults —
//     callers can render purely off of `enabled`.
//
// The plan check mirrors /api/stripe/status's computation exactly, same
// as the dialer-down read route, for the same reason: no dependency on
// that route or on lib/subscription.ts changing out from under it.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('dashboard/promo-banner')

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''

const EMPTY = { enabled: false, message: '', textColor: '#FFFFFF', bgColor: '#0A84FF' }

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, stripe_price_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: userRow } = await supabase
      .from('users')
      .select('wl_subscription_id, wl_onboarding_status')
      .eq('clerk_id', userId)
      .maybeSingle()

    const wlActive =
      !!userRow?.wl_subscription_id &&
      userRow?.wl_onboarding_status === 'complete'

    const subStatusActive = !!sub && sub.status === 'active'
    const subIsProPrice = !!PRO_PRICE_ID && sub?.stripe_price_id === PRO_PRICE_ID
    const proActive = subStatusActive && subIsProPrice

    const eligible = wlActive || proActive
    if (!eligible) {
      return NextResponse.json({ success: true, ...EMPTY })
    }

    const { data: statusRow, error } = await supabase
      .from('promo_banner_status')
      .select('enabled, message, text_color, bg_color')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error
    if (!statusRow?.enabled) {
      return NextResponse.json({ success: true, ...EMPTY })
    }

    return NextResponse.json({
      success: true,
      enabled: true,
      message: statusRow.message || '',
      textColor: statusRow.text_color || '#FFFFFF',
      bgColor: statusRow.bg_color || '#0A84FF',
    })
  } catch (err) {
    return apiError(err, { route: 'dashboard/promo-banner GET' })
  }
}
