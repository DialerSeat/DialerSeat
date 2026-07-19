import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { stripe } from '@/lib/stripe'
import { activatePendingTeamMember, deactivateTeamMember } from '@/lib/teamMembership'
import { sendAdminPush } from '@/lib/pushNotify'
import { logBillingEvent } from '@/lib/billingEvents'
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
        await routeSubscription(event.data.object as Stripe.Subscription, event.type, undefined, event.created)
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
          await routeSubscription(subscription, event.type, invoice.billing_reason ?? undefined, event.created)
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










async function routeSubscription(
  subscription: Stripe.Subscription,
  eventType?: string,
  billingReason?: Stripe.Invoice.BillingReason,
  eventCreated?: number
) {
  const subKind = subscription.metadata?.sub_kind

  if (subKind === 'team_seat') {
    await syncSeatCharge(subscription)
    return
  }

  if (subKind === 'whitelabel') {
    await routeWhitelabel(subscription, eventType, billingReason, eventCreated)
    return
  }

  await syncPersonalSubscription(subscription, eventType, billingReason, eventCreated)
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





async function routeWhitelabel(
  subscription: Stripe.Subscription,
  eventType?: string,
  billingReason?: Stripe.Invoice.BillingReason,
  eventCreated?: number
) {
  
  
  
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('[wl] no clerk_id for subscription', subscription.id)
    return
  }

  // THE REAL GATE: log/notify only on the genuine transition into 'active'
  // status, never on the raw 'created' event alone. Per Stripe's own docs,
  // customer.subscription.created fires the INSTANT checkout begins, with
  // status still 'incomplete' — logging there means every failed/retried
  // checkout attempt (declined card, abandoned payment sheet, etc.) writes
  // its own premature "subscribed" entry, even though the person hadn't
  // actually paid yet. Since 'created' and 'updated' share this same
  // function (see routeSubscription's switch), checking the subscription's
  // CURRENT status here — combined with what was already stored before
  // this write — catches the real moment regardless of which event type
  // happened to deliver it.
  if (
    subscription.status === 'active' &&
    (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated')
  ) {
    const { data: existingRow } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    // Already logged as active on a previous event for this exact
    // subscription — don't log again (e.g. a later 'updated' event that
    // doesn't change anything meaningful, or a redelivered event that
    // slipped past claimStripeEvent's id-based dedup for some reason).
    const alreadyActive = existingRow?.status === 'active'

    if (!alreadyActive) {
      // Same fix as before, still needed: exclude incomplete/
      // incomplete_expired rows from counting as a genuine PRIOR
      // subscription — a failed/retried earlier attempt by the same
      // person shouldn't make their real first paid subscription look
      // like a resub.
      const { data: priorSubs } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', clerkId)
        .neq('stripe_subscription_id', subscription.id)
        .not('status', 'in', '(incomplete,incomplete_expired)')
        .limit(1)

      const isResub = !!(priorSubs && priorSubs.length > 0)
      const { name, email } = await lookupNameAndEmail(clerkId)
      // "Manager+" matches PLAN_INFO.wl.label in app/billing/page.tsx.
      const planLabel = 'Manager+'
      if (isResub) {
        await sendAdminPush('resub', `${name} resubscribed to ${planLabel}.`)
        await logBillingEvent({
          event_type: 'resub', clerk_id: clerkId, user_name: name, user_email: email,
          plan: 'wl', amount_cents: 7500, stripe_subscription_id: subscription.id,
        })
      } else {
        await sendAdminPush('new_sub', `${name} subscribed to ${planLabel}.`)
        await logBillingEvent({
          event_type: 'initial_sub', clerk_id: clerkId, user_name: name, user_email: email,
          plan: 'wl', amount_cents: 7500, stripe_subscription_id: subscription.id,
        })
      }
    }
  } else if (
    eventType === 'invoice.payment_succeeded' &&
    billingReason === 'subscription_cycle'
  ) {
    const { name, email } = await lookupNameAndEmail(clerkId)
    await sendAdminPush('renewal', `${name} renewed Manager+ subscription.`)
    await logBillingEvent({
      event_type: 'renewal', clerk_id: clerkId, user_name: name, user_email: email,
      plan: 'wl', amount_cents: 7500, stripe_subscription_id: subscription.id,
    })
  }

  
  await upsertPersonalSubscription(subscription, clerkId, eventCreated)
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

    const { name, email } = await lookupNameAndEmail(clerkId)
    await sendAdminPush('cancel', `${name} cancelled Manager+ subscription.`)

    const retentionWeeks = subscription.start_date
      ? Math.max(0, Math.round((Date.now() / 1000 - subscription.start_date) / (7 * 24 * 60 * 60)))
      : null

    await logBillingEvent({
      event_type: 'cancel', clerk_id: clerkId, user_name: name, user_email: email,
      plan: 'wl', stripe_subscription_id: subscription.id, retention_weeks: retentionWeeks,
    })
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





async function syncPersonalSubscription(
  subscription: Stripe.Subscription,
  eventType?: string,
  billingReason?: Stripe.Invoice.BillingReason,
  eventCreated?: number
) {
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('No user found for subscription', subscription.id)
    return
  }

  // THE REAL GATE: log/notify only on the genuine transition into 'active'
  // status, never on the raw 'created' event alone — see the matching
  // comment in routeWhitelabel for the full reasoning (Stripe's own docs
  // confirm customer.subscription.created fires while status is still
  // 'incomplete' under default_incomplete payment_behavior).
  if (
    subscription.status === 'active' &&
    (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated')
  ) {
    const { data: existingRow } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    const alreadyActive = existingRow?.status === 'active'

    if (!alreadyActive) {
      // Only count a PRIOR subscription that actually succeeded at some
      // point — never one still stuck in 'incomplete'/'incomplete_expired'.
      // A failed/retried earlier attempt shouldn't make a real first-ever
      // successful subscription look like a resub.
      const { data: priorSubs } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', clerkId)
        .neq('stripe_subscription_id', subscription.id)
        .not('status', 'in', '(incomplete,incomplete_expired)')
        .limit(1)

      const isResub = !!(priorSubs && priorSubs.length > 0)
      const { name, email } = await lookupNameAndEmail(clerkId)
      // "Pro" matches PLAN_INFO.standard.label in app/billing/page.tsx —
      // this function only ever runs for the standard personal plan
      // (routeSubscription already branched whitelabel/team_seat away
      // before calling here), so this is never ambiguous.
      const planLabel = 'Pro'
      if (isResub) {
        await sendAdminPush('resub', `${name} resubscribed to ${planLabel}.`)
        await logBillingEvent({
          event_type: 'resub', clerk_id: clerkId, user_name: name, user_email: email,
          plan: 'pro', amount_cents: 3500, stripe_subscription_id: subscription.id,
        })
      } else {
        await sendAdminPush('new_sub', `${name} subscribed to ${planLabel}.`)
        await logBillingEvent({
          event_type: 'initial_sub', clerk_id: clerkId, user_name: name, user_email: email,
          plan: 'pro', amount_cents: 3500, stripe_subscription_id: subscription.id,
        })
      }
    }
  } else if (
    eventType === 'invoice.payment_succeeded' &&
    billingReason === 'subscription_cycle'
  ) {
    const { name, email } = await lookupNameAndEmail(clerkId)
    await sendAdminPush('renewal', `${name} renewed Pro subscription.`)
    await logBillingEvent({
      event_type: 'renewal', clerk_id: clerkId, user_name: name, user_email: email,
      plan: 'pro', amount_cents: 3500, stripe_subscription_id: subscription.id,
    })
  }

  await upsertPersonalSubscription(subscription, clerkId, eventCreated)
  await updatePersonalUserStatus(clerkId, subscription)

  // An agent-pays team seat rides on a completely ordinary personal
  // subscription (same price, no special sub_kind) — the only thing that
  // marks it as "also unlocks a team seat" is this metadata. Only fire once
  // the subscription is genuinely active, not on intermediate states like
  // incomplete/incomplete_expired while the first payment is still being
  // collected.
  const pendingTeamMemberId = subscription.metadata?.pending_team_member_id
  if (pendingTeamMemberId && subscription.status === 'active') {
    try {
      await activatePendingTeamMember(pendingTeamMemberId)

      const { data: member } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('id', pendingTeamMemberId)
        .maybeSingle()

      if (member) {
        await supabase
          .from('team_agent_payments')
          .update({ status: 'active', stripe_subscription_id: subscription.id })
          .eq('team_id', member.team_id)
          .eq('agent_id', clerkId)
          .eq('status', 'pending')
      }
    } catch (err) {
      console.error('[agent-pays] failed to activate pending team member', pendingTeamMemberId, err)
    }
  }
}

async function lookupNameAndEmail(clerkId: string): Promise<{ name: string; email: string | null }> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  if (!data) return { name: 'A customer', email: null }
  const full = `${data.first_name || ''} ${data.last_name || ''}`.trim()
  return {
    name: full || data.email?.split('@')[0] || 'A customer',
    email: data.email ?? null,
  }
}

// Kept as a thin wrapper — several call sites only need the name and
// predate this refactor; no need to touch every one of them just to widen
// what they ask for.
async function lookupDisplayName(clerkId: string): Promise<string> {
  return (await lookupNameAndEmail(clerkId)).name
}

async function lookupEmail(clerkId: string): Promise<string | null> {
  return (await lookupNameAndEmail(clerkId)).email
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
  clerkId: string,
  eventCreated?: number
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  // Guard against out-of-order Stripe webhook delivery (see
  // migrations/SUBSCRIPTIONS_EVENT_ORDERING_2026-07-18.sql for the full
  // reasoning). Stripe does not guarantee delivery order — an `updated`
  // event (status: active, fired the instant payment succeeds) can arrive
  // before the earlier `created` event (status: incomplete, fired the
  // moment checkout started) finishes retrying. Without this guard, an
  // unconditional upsert lets whichever event happens to arrive LAST win,
  // which could stomp a real 'active' status back down to 'incomplete' if
  // the created event lands after the updated event.
  //
  // eventCreated is the Stripe *event's* own `created` timestamp (when
  // Stripe originated it, not when we received it) — compare against
  // whatever timestamp is already stored for this row, and skip the write
  // entirely if this event is older than the last one that touched it.
  if (eventCreated != null) {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('last_event_at')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    if (existing?.last_event_at) {
      const existingEventTime = new Date(existing.last_event_at).getTime()
      const incomingEventTime = eventCreated * 1000 // Stripe's `created` is Unix seconds
      if (incomingEventTime < existingEventTime) {
        console.log(
          `[stripe/webhook] skipping out-of-order write for ${subscription.id}: ` +
          `incoming event (${new Date(incomingEventTime).toISOString()}) is older than ` +
          `last-applied event (${existing.last_event_at})`
        )
        return
      }
    }
  }

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
    last_event_at: eventCreated != null ? new Date(eventCreated * 1000).toISOString() : undefined,
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

  const clerkId = await lookupClerkIdByCustomer(subscription)
  if (clerkId) {
    const { name, email } = await lookupNameAndEmail(clerkId)
    await sendAdminPush('cancel', `${name} cancelled Pro subscription.`)

    // subscription.start_date is a real Stripe field (Unix seconds) marking
    // when this subscription object first began — used here purely for the
    // audit record, not for anything that gates behavior.
    const retentionWeeks = subscription.start_date
      ? Math.max(0, Math.round((Date.now() / 1000 - subscription.start_date) / (7 * 24 * 60 * 60)))
      : null

    await logBillingEvent({
      event_type: 'cancel', clerk_id: clerkId, user_name: name, user_email: email,
      plan: 'pro', stripe_subscription_id: subscription.id, retention_weeks: retentionWeeks,
    })
  }

  // Symmetric with the agent-pays activation path — this metadata key stays
  // on the subscription for its whole life once set, not just while pending.
  const teamMemberId = subscription.metadata?.pending_team_member_id
  if (teamMemberId) {
    try {
      await deactivateTeamMember(teamMemberId)

      const { data: member } = await supabase
        .from('team_members')
        .select('team_id, user_id')
        .eq('id', teamMemberId)
        .maybeSingle()

      if (member) {
        await supabase
          .from('team_agent_payments')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('team_id', member.team_id)
          .eq('agent_id', member.user_id)
          .eq('status', 'active')
      }
    } catch (err) {
      console.error('[agent-pays] failed to deactivate team member on cancel', teamMemberId, err)
    }
  }
}