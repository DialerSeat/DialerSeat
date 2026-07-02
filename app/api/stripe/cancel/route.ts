import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireNotAdmin } from '@/lib/subscription'

const supabase = getServiceClient('stripe/cancel')

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
      .in('status', ['active', 'past_due'])  // cancelable: an active or still-retrying sub
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