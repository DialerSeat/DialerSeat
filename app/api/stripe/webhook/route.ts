import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { stripe } from '@/lib/stripe'
import {
  claimStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
  markStripeEventSkipped,
} from '@/lib/stripe-idempotency'

const supabase = getServiceClient('stripe/webhook')

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

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

  const claim = await claimStripeEvent(event)
  if (!claim.shouldProcess) {
    console.log(`> Stripe webhook ${event.id} skipped: ${claim.reason}`)
    return NextResponse.json({ received: true, reason: claim.reason })
  }

  console.log(`> Stripe webhook received: ${event.type} (${event.id}, ${claim.reason})`)

  try {
    let handled = true

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end':
        await routeSubscription(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await routeSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string | null
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await routeSubscription(subscription)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
        handled = false
    }

    if (handled) {
      await markStripeEventProcessed(event.id)
    } else {
      await markStripeEventSkipped(event.id)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    await markStripeEventFailed(event.id, err)
    
    
    
    return apiError(err, { route: 'stripe/webhook', context: { event_id: event.id, event_type: event.type } })
  }
}










async function routeSubscription(subscription: Stripe.Subscription) {
  const subKind = subscription.metadata?.sub_kind

  if (subKind === 'team_seat') {
    await syncSeatCharge(subscription)
    return
  }

  if (subKind === 'whitelabel') {
    await routeWhitelabel(subscription)
    return
  }

  await syncPersonalSubscription(subscription)
}

async function routeSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subKind = subscription.metadata?.sub_kind

  if (subKind === 'team_seat') {
    
    
    
    
    
    
    const seatChargeId = subscription.metadata?.seat_charge_id
    if (seatChargeId) {
      const { error } = await supabase
        .from('team_seat_charges')
        .update({ status: 'voided' })
        .eq('id', seatChargeId)
      if (error) {
        console.error('[team_seat] failed to void by seat_charge_id:', error)
      }
    } else {
      const itemId = subscription.items.data[0]?.id
      if (itemId) {
        const { error } = await supabase
          .from('team_seat_charges')
          .update({ status: 'voided' })
          .eq('stripe_subscription_item_id', itemId)
        if (error) {
          console.error('[team_seat] failed to void by item id:', error)
        }
      } else {
        console.error(
          '[team_seat] subscription.deleted has neither seat_charge_id metadata ' +
          'nor a subscription item id — cannot void charge for sub:',
          subscription.id
        )
      }
    }
    return
  }

  if (subKind === 'whitelabel') {
    await markWhitelabelCanceled(subscription)
    return
  }

  await markPersonalSubCanceled(subscription)
}





async function routeWhitelabel(subscription: Stripe.Subscription) {
  
  
  
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('[wl] no clerk_id for subscription', subscription.id)
    return
  }

  
  await upsertPersonalSubscription(subscription, clerkId)
  await updatePersonalUserStatus(clerkId, subscription)

  
  
  
  
  
  
  if (subscription.status === 'active') {
    
    const { data: u } = await supabase
      .from('users')
      .select('wl_onboarding_status')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    const updates: Record<string, any> = {
      wl_subscription_id: subscription.id,
    }
    if (!u?.wl_onboarding_status || u.wl_onboarding_status === 'not_started') {
      updates.wl_onboarding_status = 'pending'
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('clerk_id', clerkId)
    if (error) {
      console.error('[wl] failed to mark wl_onboarding_status pending:', error)
    }
  }

  
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    await supabase
      .from('white_label_tenants')
      .update({ is_active: false })
      .eq('owner_clerk_id', clerkId)
  }

  
  if (subscription.status === 'active') {
    await supabase
      .from('white_label_tenants')
      .update({ is_active: true })
      .eq('owner_clerk_id', clerkId)
  }
}

async function markWhitelabelCanceled(subscription: Stripe.Subscription) {
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (clerkId) {
    
    
    await supabase
      .from('white_label_tenants')
      .update({ is_active: false })
      .eq('owner_clerk_id', clerkId)

    await supabase
      .from('users')
      .update({ subscription_status: 'canceled' })
      .eq('clerk_id', clerkId)
  }
}





async function syncSeatCharge(subscription: Stripe.Subscription) {
  const seatChargeId = subscription.metadata?.seat_charge_id

  if (!seatChargeId) {
    console.error('Seat sub missing seat_charge_id metadata:', subscription.id)
    return
  }

  let chargeStatus: 'paid' | 'failed' | 'voided' | 'pending'
  switch (subscription.status) {
    case 'active':
      
      chargeStatus = 'paid'
      break
    case 'past_due':
      chargeStatus = 'failed'
      break
    case 'canceled':
    case 'incomplete_expired':
    case 'unpaid':
      chargeStatus = 'voided'
      break
    case 'incomplete':
      chargeStatus = 'pending'
      break
    default:
      chargeStatus = 'pending'
  }

  const periodStart =
    (subscription as any).current_period_start ??
    subscription.items.data[0]?.current_period_start
  const periodEnd =
    (subscription as any).current_period_end ??
    subscription.items.data[0]?.current_period_end

  const updates: Record<string, any> = { status: chargeStatus }
  if (periodStart) updates.period_start = new Date(periodStart * 1000).toISOString()
  if (periodEnd) updates.period_end = new Date(periodEnd * 1000).toISOString()

  await supabase
    .from('team_seat_charges')
    .update(updates)
    .eq('id', seatChargeId)

  if (chargeStatus === 'failed' || chargeStatus === 'voided') {
    const teamMemberId = subscription.metadata?.team_member_id
    if (teamMemberId) {
      await supabase
        .from('team_campaign_access')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('team_member_id', teamMemberId)
        .eq('payer', 'owner')
        .eq('is_active', true)
    }
  }

  
  
  
  
  
  
  if (chargeStatus === 'paid') {
    const teamMemberId = subscription.metadata?.team_member_id
    if (teamMemberId) {
      await supabase
        .from('team_campaign_access')
        .update({ is_active: true, revoked_at: null })
        .eq('team_member_id', teamMemberId)
        .eq('payer', 'owner')
        .eq('is_active', false)
        .not('revoked_at', 'is', null)
    }
  }
}





async function syncPersonalSubscription(subscription: Stripe.Subscription) {
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('No user found for subscription', subscription.id)
    return
  }

  await upsertPersonalSubscription(subscription, clerkId)
  await updatePersonalUserStatus(clerkId, subscription)
}

async function lookupClerkIdByCustomer(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const { data: userByCustomer } = await supabase
    .from('users')
    .select('clerk_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return userByCustomer?.clerk_id ?? null
}

async function upsertPersonalSubscription(
  subscription: Stripe.Subscription,
  clerkId: string
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? ''

  // Newer Stripe API versions moved these fields off the top-level
  // Subscription object onto each item. Falling back to the item-level
  // value (already done in syncSeatCharge below) keeps this populated
  // instead of always landing on null.
  const periodStart =
    (subscription as any).current_period_start ??
    (item as any)?.current_period_start
  const periodEnd =
    (subscription as any).current_period_end ??
    (item as any)?.current_period_end

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
    console.error('Failed to upsert personal subscription:', error)
    throw error
  }
}

async function updatePersonalUserStatus(
  clerkId: string,
  subscription: Stripe.Subscription
) {
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: subscription.status,
    })
    .eq('clerk_id', clerkId)

  if (error) {
    console.error('Failed to update user status:', error)
  }
}

async function markPersonalSubCanceled(subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Failed to mark personal subscription canceled:', error)
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  await supabase
    .from('users')
    .update({ subscription_status: 'canceled' })
    .eq('stripe_customer_id', customerId)
}