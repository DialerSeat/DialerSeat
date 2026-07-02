import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

const supabase = getServiceClient('stripe/abandon-billing')

// Statuses we will NEVER touch. If the user has a sub in any of these
// states, abandon-billing is a no-op. We protect paying customers from
// any accidental disruption no matter how the endpoint is invoked.
// 'trialing' is kept here on purpose even though we no longer offer trials:
// this is a PROTECTIVE guard (statuses that make abandon-billing a no-op), so
// listing an extra status only ever protects more, never less. Do not confuse
// this with the ACCESS gates, where 'trialing' was correctly removed.
const PROTECTED_STATUSES = ['active', 'past_due', 'trialing']

// Statuses safe to clean up. These represent the abandoned billing
// attempt the user just made — Stripe subs created with
// payment_behavior: 'default_incomplete' that never got confirmed.
const CLEANUP_STATUSES = ['incomplete']

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step log for debuggability. Logged to console + returned in response
  // so the frontend can surface it if something goes weird.
  const log: string[] = []
  const step = (msg: string) => {
    console.log(`[abandon-billing ${userId}] ${msg}`)
    log.push(msg)
  }

  try {
    step('start')

    // 1. Look up Stripe customer (if any).
    // No customer = user never reached the create-subscription endpoint,
    // so there's nothing to clean up. Return success.
    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    const customerId = userRow?.stripe_customer_id

    if (!customerId) {
      step('no stripe customer — nothing to clean')
      return NextResponse.json({
        success: true,
        action: 'noop_no_customer',
        log,
      })
    }

    // 2. Pull every sub for this customer (any status, up to 20).
    let allSubs: { id: string; status: string }[] = []
    try {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      })
      allSubs = list.data.map((s) => ({ id: s.id, status: s.status }))
      step(`stripe: ${allSubs.length} sub(s) found`)
    } catch (err: any) {
      step(`stripe list failed: ${err.message}`)
      // Non-fatal — we can still clean up Supabase rows below.
    }

    // 3. PROTECT: if any sub is in a paying status, this is a no-op.
    // A user with active/past_due/trialing should never have this
    // endpoint disrupt their account, no matter what triggered the call.
    const hasProtected = allSubs.some((s) =>
      PROTECTED_STATUSES.includes(s.status)
    )

    if (hasProtected) {
      step('protected sub exists — no-op (paying customer)')
      return NextResponse.json({
        success: true,
        action: 'noop_protected',
        log,
      })
    }

    // 4. Cancel any incomplete Stripe subs. These are the abandoned
    // billing attempts we want to clean up.
    const incomplete = allSubs.filter((s) =>
      CLEANUP_STATUSES.includes(s.status)
    )

    for (const sub of incomplete) {
      try {
        await stripe.subscriptions.cancel(sub.id)
        step(`canceled stripe sub ${sub.id}`)
      } catch (err: any) {
        // Stripe sometimes auto-expires incomplete subs. Cancel-on-
        // already-canceled returns an error but it's the state we
        // wanted anyway. Non-fatal — keep going.
        step(`skip cancel ${sub.id}: ${err.message}`)
      }
    }

    // 5. Delete local 'incomplete' rows in Supabase.
    // Active / canceled / past_due rows are untouched — those are real
    // account history that survives across resubscription cycles.
    const { error: delErr, count } = await supabase
      .from('subscriptions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('status', CLEANUP_STATUSES)

    if (delErr) {
      step(`supabase delete error: ${delErr.message}`)
    } else {
      step(`deleted ${count ?? 0} incomplete supabase row(s)`)
    }

    step('done')

    return NextResponse.json({
      success: true,
      action: 'cleaned',
      log,
    })
  } catch (err: any) {
    // We still return 200 with success: false rather than 500 so the
    // frontend reliably proceeds with the redirect to landing. The
    // user's billing-abandonment shouldn't be blocked by a server hiccup.
    console.error('[abandon-billing] error:', err)
    return NextResponse.json({
      success: false,
      action: 'error',
      error: err.message || 'Unknown error',
      log,
    })
  }
}