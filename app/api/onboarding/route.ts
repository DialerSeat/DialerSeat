// ── ONBOARDING FLAGS, ONE SET PER ACCOUNT ────────────────────────────────
// Whether this person has seen the welcome popup, is on the demo tour, and
// has finished or skipped the post-payment tutorial. Kept on the users row so
// it is once per account on any device, and never again after that.
//
// The tutorial teaches an agent to dial, so it is owed to someone who looked
// around first (popup_done) and then bought Pro. Customers from before this flow
// never set popup_done, and a Manager+ owner goes to brand setup instead.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('onboarding')

const FLAGS = ['onboard_popup_done', 'onboard_tour_on', 'onboard_tour_done', 'onboard_tut_done', 'onboard_gd_min'] as const

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('users').select(FLAGS.join(', ')).eq('clerk_id', userId).maybeSingle()
  const row = (data || {}) as Record<string, unknown>
  let tutPending = false
  if (row.onboard_popup_done && !row.onboard_tut_done) {
    const { data: subs } = await supabase.from('subscriptions').select('stripe_price_id').eq('user_id', userId).eq('status', 'active')
    tutPending = (subs || []).some((s: { stripe_price_id: string | null }) => s.stripe_price_id === process.env.STRIPE_PRICE_ID)
  }
  return NextResponse.json({
    success: true,
    popupDone: !!row.onboard_popup_done,
    tourOn: !!row.onboard_tour_on,
    tourDone: !!row.onboard_tour_done,
    tutPending,
    tutDone: !!row.onboard_tut_done,
    minimised: !!row.onboard_gd_min,
  })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const map: Record<string, (typeof FLAGS)[number]> = {
    popupDone: 'onboard_popup_done', tourOn: 'onboard_tour_on', tourDone: 'onboard_tour_done',
    tutDone: 'onboard_tut_done', minimised: 'onboard_gd_min',
  }
  const patch: Record<string, boolean> = {}
  for (const [k, col] of Object.entries(map)) if (typeof body[k] === 'boolean') patch[col] = body[k]
  if (!Object.keys(patch).length) return NextResponse.json({ success: true })
  const { error } = await supabase.from('users').update(patch).eq('clerk_id', userId)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
