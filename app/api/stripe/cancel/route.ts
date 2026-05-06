import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { requireNotAdmin } from '@/lib/subscription'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hard-block admins server-side. The settings page hides the cancel UI for
    // admins, but a determined admin could POST here directly. This closes that.
    const adminBlock = await requireNotAdmin(userId)
    if (adminBlock) return adminBlock

    // Find the user's most recent active subscription.
    // Use limit(1) instead of maybeSingle() in case duplicate rows exist
    // from prior cancel→resubscribe edge cases.
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Cancel lookup error:', error)
      return NextResponse.json(
        { error: 'Failed to look up subscription' },
        { status: 500 }
      )
    }

    const sub = subs?.[0]
    if (!sub) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    if (sub.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is already scheduled to cancel' },
        { status: 400 }
      )
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('stripe_subscription_id', sub.stripe_subscription_id)

    return NextResponse.json({
      success: true,
      cancelAt: updated.cancel_at
        ? new Date(updated.cancel_at * 1000).toISOString()
        : null,
    })
  } catch (err: any) {
    console.error('cancel error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}