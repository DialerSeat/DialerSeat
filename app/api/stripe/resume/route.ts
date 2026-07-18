import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireNotAdmin } from '@/lib/subscription'

const supabase = getServiceClient('stripe/resume')

// Undoes a scheduled cancellation. Cancel only ever sets
// cancel_at_period_end: true on Stripe — the subscription's status stays
// 'active' right up until the current period actually ends. "Resume" is the
// inverse of that same operation: clear cancel_at_period_end on the
// existing subscription. It must NOT go through create-subscription, which
// creates a brand new subscription object — the whole point of resuming is
// to keep the customer on the subscription (and billing period) they
// already have, not start a new one.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminBlock = await requireNotAdmin(userId)
    if (adminBlock) return adminBlock

    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Resume lookup error:', error)
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

    if (!sub.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is not scheduled to cancel' },
        { status: 400 }
      )
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('stripe_subscription_id', sub.stripe_subscription_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('resume error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to resume subscription' },
      { status: 500 }
    )
  }
}
