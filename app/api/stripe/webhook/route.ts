import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Disable Next.js body parsing for this route — Stripe needs the raw body for signature verification
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  console.log('> Stripe webhook received:', event.type)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string | null
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await syncSubscription(subscription)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const clerkId = subscription.metadata?.clerk_id

  if (!clerkId) {
    // Fall back to looking up by Stripe customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id

    const { data: userByCustomer } = await supabase
      .from('users')
      .select('clerk_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (!userByCustomer) {
      console.error('No user found for subscription', subscription.id)
      return
    }

    await upsertSubscription(subscription, userByCustomer.clerk_id)
    await updateUserStatus(userByCustomer.clerk_id, subscription)
    return
  }

  await upsertSubscription(subscription, clerkId)
  await updateUserStatus(clerkId, subscription)
}

async function upsertSubscription(subscription: Stripe.Subscription, clerkId: string) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? ''

  const periodStart = (subscription as any).current_period_start
  const periodEnd = (subscription as any).current_period_end

  const payload = {
    user_id: clerkId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'stripe_subscription_id' })

  if (error) {
    console.error('Failed to upsert subscription:', error)
    throw error
  }
}

async function updateUserStatus(clerkId: string, subscription: Stripe.Subscription) {
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: subscription.status,
      trial_ends_at: trialEnd,
    })
    .eq('clerk_id', clerkId)

  if (error) {
    console.error('Failed to update user status:', error)
  }
}

async function markSubscriptionCanceled(subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Failed to mark subscription canceled:', error)
  }

  // Also update users.subscription_status
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  await supabase
    .from('users')
    .update({ subscription_status: 'canceled' })
    .eq('stripe_customer_id', customerId)
}