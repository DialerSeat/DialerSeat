import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// Dashboard-facing read for the Dialer Down emergency banner.
//
// Deliberately narrow and separate from /api/admin/dialer-down:
//   - Requires a signed-in user (401 otherwise) — landing pages and
//     anonymous visitors never call this route at all, so they can never
//     see the banner regardless of its enabled state.
//   - Requires an active Pro or Manager+ plan — lapsed/new/no-plan users
//     get { enabled: false } even if the banner is actually live, same as
//     if it were off. The banner is scoped to paying dashboard users only.
//   - Returns only { enabled, message } — never the password hash/salt,
//     never updatedBy. There's nothing here for anyone to misuse even if
//     this response were somehow inspected.
//   - When enabled is false, message is always '' — callers can render
//     purely off of `enabled` without needing to separately check message.
//
// The plan check mirrors /api/stripe/status's computation exactly (same
// tables, same columns, same active-price check) rather than importing
// shared plan logic, so this endpoint has no dependency on that route or
// on lib/subscription.ts changing out from under it.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('dashboard/dialer-down')

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''

const EMPTY = { enabled: false, message: '' }

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
      .from('dialer_down_status')
      .select('enabled, message')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error
    if (!statusRow?.enabled) {
      return NextResponse.json({ success: true, ...EMPTY })
    }

    return NextResponse.json({ success: true, enabled: true, message: statusRow.message || '' })
  } catch (err) {
    return apiError(err, { route: 'dashboard/dialer-down GET' })
  }
}
