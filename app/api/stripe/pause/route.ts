import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireNotAdmin } from '@/lib/subscription'
import { sendAdminPush } from '@/lib/pushNotify'
import { lookupUserIdentity } from '@/lib/userDisplayName'

const supabase = getServiceClient('stripe/pause')

// =============================================================================
// PAUSE / RESUME A SUBSCRIPTION
// =============================================================================
// Billing here is WEEKLY, which means a subscriber makes 52 keep-or-quit
// decisions a year instead of 12. That is excellent for getting someone
// started and unforgiving on retention — and this product's users are in
// seasonal businesses where "I'm not dialing for a few weeks" is a normal
// thing to want, and currently the only way to express it is Cancel.
//
// Pause is the smaller ask. Their leads, campaigns, dispositions and history
// all stay exactly where they were, and coming back is one click instead of a
// re-signup.
//
// MECHANISM: Stripe's pause_collection with behavior 'void' — invoices for the
// paused period are voided rather than accrued, so nobody comes back to a
// surprise bill. It does NOT cancel, so the payment method, the price they
// signed up at, and the subscription id all survive.
//
// THE TRAP THIS AVOIDS: pause_collection leaves subscription.status as
// 'active'. Every access check in this app keys off status, so pausing
// without the explicit subscriptions.paused_at marker would hand the user
// free unlimited dialing. getAccessState in proxy.ts reads that marker.
// =============================================================================

async function loadSubscription(userId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status, cancel_at_period_end, paused_at')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminBlock = await requireNotAdmin(userId)
    if (adminBlock) return adminBlock

    let action: string
    try {
      const body = await req.json()
      action = body?.action
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (action !== 'pause' && action !== 'resume') {
      return NextResponse.json({ error: 'action must be "pause" or "resume"' }, { status: 400 })
    }

    const sub = await loadSubscription(userId)
    if (!sub) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (action === 'pause') {
      if (sub.paused_at) {
        return NextResponse.json({ error: 'Subscription is already paused' }, { status: 400 })
      }
      if (sub.cancel_at_period_end) {
        // Pausing something already on its way out would be a confusing
        // half-state — and they've already made the harder decision.
        return NextResponse.json(
          { error: 'This subscription is already set to cancel. Resume it first if you want to pause instead.' },
          { status: 400 }
        )
      }

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        pause_collection: { behavior: 'void' },
      })

      // Written AFTER Stripe confirms. If the order were reversed and Stripe
      // failed, the user would lose access while still being billed — the
      // worst of both.
      const { error } = await supabase
        .from('subscriptions')
        .update({ paused_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.stripe_subscription_id)

      if (error) {
        // Stripe is paused but our marker didn't land: they'd keep access and
        // stop being billed. Undo the pause rather than leave that standing.
        console.error('[stripe/pause] marker write failed, reverting Stripe pause:', error.message)
        await stripe.subscriptions.update(sub.stripe_subscription_id, { pause_collection: null })
        return NextResponse.json({ error: 'Could not pause: nothing was changed' }, { status: 500 })
      }

      // Named, because "a customer paused" isn't actionable and "Marcus
      // Alvarez paused" is — a pause is the one churn signal you can still do
      // something about. Non-fatal: a push failure must not fail the pause.
      try {
        const { name } = await lookupUserIdentity(userId)
        await sendAdminPush('sub_paused', `${name} paused their subscription. Billing is stopped; their data is preserved.`)
      } catch (pushErr) {
        console.error('[stripe/pause] pause notification failed:', pushErr)
      }

      return NextResponse.json({ success: true, paused: true })
    }

    // ── resume ──────────────────────────────────────────────────────────────
    if (!sub.paused_at) {
      return NextResponse.json({ error: 'Subscription is not paused' }, { status: 400 })
    }

    // Clearing pause_collection puts the subscription back on schedule. If the
    // paid period already elapsed while paused, Stripe bills on resume — which
    // is the one moment this can fail.
    const resumed = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      pause_collection: null,
    })

    // ── DID THE CARD ACTUALLY GO THROUGH? ─────────────────────────────────
    // Product rule: a successful resume is SILENT — they just have access
    // again, no confirmation to dismiss. A failure is the only thing worth
    // interrupting someone for, and it needs to point at the fix rather than
    // just saying no.
    //
    // 'past_due' and 'unpaid' mean Stripe tried and the card refused;
    // 'incomplete' means the first payment never completed. Any of the three
    // and they need a working card before access returns.
    const billingFailed = ['past_due', 'unpaid', 'incomplete'].includes(resumed.status)

    const { error } = await supabase
      .from('subscriptions')
      .update({
        paused_at: null,
        // Keep our copy of the status honest — the webhook will confirm it,
        // but the UI shouldn't have to wait on that round trip to know.
        status: resumed.status,
      })
      .eq('stripe_subscription_id', sub.stripe_subscription_id)

    if (billingFailed) {
      console.warn(`[stripe/pause] resume left subscription ${resumed.id} in status ${resumed.status}`)
      return NextResponse.json({
        success: false,
        billingFailed: true,
        status: resumed.status,
        error: 'Your card was declined, so billing could not restart. Update your payment method to resume.',
        redirectTo: '/billing',
      }, { status: 402 })
    }

    if (error) {
      // Billing resumed but the marker says paused: they'd be charged with no
      // access. Log loudly — this needs a human, and re-pausing would be the
      // wrong reflex since money is now moving again.
      console.error('[stripe/pause] CRITICAL: resumed in Stripe but marker still set:', error.message)
      return NextResponse.json(
        { error: 'Billing resumed but access did not. Contact support, do not retry.' },
        { status: 500 }
      )
    }

    try {
      const { name } = await lookupUserIdentity(userId)
      await sendAdminPush('sub_resumed', `${name} resumed their subscription. Billing has restarted.`)
    } catch (pushErr) {
      console.error('[stripe/pause] resume notification failed:', pushErr)
    }

    return NextResponse.json({ success: true, paused: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update subscription'
    console.error('[stripe/pause] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await loadSubscription(userId)
    return NextResponse.json({
      success: true,
      paused: !!sub?.paused_at,
      pausedAt: sub?.paused_at ?? null,
      canPause: !!sub && !sub.paused_at && !sub.cancel_at_period_end,
    })
  } catch (err) {
    console.error('[stripe/pause:GET] error:', err)
    return NextResponse.json({ error: 'Failed to read subscription' }, { status: 500 })
  }
}
