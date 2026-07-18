import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { stripe } from '@/lib/stripe'
import { activatePendingTeamMember, deactivateTeamMember } from '@/lib/teamMembership'
import { sendAdminPush } from '@/lib/pushNotify'
import {
  claimStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
  markStripeEventSkipped,
} from '@/lib/stripe-idempotency'

const supabase = getServiceClient('stripe/webhook')

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Subscription rows in these statuses never had a completed payment — they're
// either the throwaway `incomplete` subscription Stripe creates the instant
// someone loads the billing page (before a card is even entered), or one that
// expired without ever being paid. create-subscription/route.ts routinely
// cancels one of these and creates a fresh subscription object on plan
// switches, promo code changes, and retries — none of that is a real
// cancellation or resubscription by the user. Counting these rows as "prior
// subscription history" is what made a brand-new subscriber look like a
// resub, and made the throwaway sub's cancellation show up as a real CANCEL
// log line. Mirrors NEVER_PAID_STATUSES in app/api/admin/logs/route.ts, which
// already excludes them when computing initial-sub-vs-resub for the same
// reason.
const NEVER_PAID_STATUSES = ['incomplete', 'incomplete_expired']

// A subscription only becomes a real, billable customer once it reaches one
// of these — 'incomplete' (the placeholder created the instant someone
// loads the billing page, before a card is entered) doesn't count.
const LIVE_STATUSES = ['active', 'trialing']

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
        await routeSubscriptionDeleted(event.data.object as Stripe.Subscription, event.created)
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
  eventCreatedAt?: number
) {
  const subKind = subscription.metadata?.sub_kind

  if (subKind === 'team_seat') {
    await syncSeatCharge(subscription)
    return
  }

  if (subKind === 'whitelabel') {
    await routeWhitelabel(subscription, eventType, billingReason, eventCreatedAt)
    return
  }

  await syncPersonalSubscription(subscription, eventType, billingReason, eventCreatedAt)
}

async function routeSubscriptionDeleted(subscription: Stripe.Subscription, eventCreatedAt?: number) {
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
    await markWhitelabelCanceled(subscription, eventCreatedAt)
    return
  }

  await markPersonalSubCanceled(subscription, eventCreatedAt)
}





// Shared by syncPersonalSubscription and routeWhitelabel. Stripe does not
// guarantee webhook delivery order — a later event (e.g. status flipping to
// active the moment payment succeeds) can arrive at our endpoint before an
// earlier one (e.g. the initial incomplete-status created event), especially
// under retries. Comparing against last_event_at (the Stripe event's own
// `created` timestamp, not our receipt time) lets us detect and ignore a
// stale, out-of-order event instead of letting it clobber newer state — this
// is what previously let a real subscribe get mislabeled as "just
// subscribed" happening at account-creation time and "resubscribed" at the
// moment of actual payment: an older event landed last and overwrote the
// correct 'active' status back down to 'incomplete'.
async function resolveSubscriptionEventOrdering(
  subscriptionId: string,
  eventCreatedAt: number | undefined
): Promise<{ isStale: boolean; wasLive: boolean; existingStatus: string | null }> {
  const { data: existingRow } = await supabase
    .from('subscriptions')
    .select('status, last_event_at')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  const wasLive = existingRow ? LIVE_STATUSES.includes(existingRow.status) : false
  const existingStatus = existingRow?.status ?? null

  if (!existingRow || !existingRow.last_event_at || eventCreatedAt === undefined) {
    // Nothing stored yet, or we don't have enough info to compare — treat
    // as not stale so the first write always goes through.
    return { isStale: false, wasLive, existingStatus }
  }

  const storedEventTime = new Date(existingRow.last_event_at).getTime()
  const incomingEventTime = eventCreatedAt * 1000
  return { isStale: incomingEventTime < storedEventTime, wasLive, existingStatus }
}

async function routeWhitelabel(
  subscription: Stripe.Subscription,
  eventType?: string,
  billingReason?: Stripe.Invoice.BillingReason,
  eventCreatedAt?: number
) {
  
  
  
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('[wl] no clerk_id for subscription', subscription.id)
    return
  }

  const { isStale, wasLive } = await resolveSubscriptionEventOrdering(subscription.id, eventCreatedAt)
  if (isStale) {
    console.log(`[wl] ignoring stale/out-of-order event for subscription ${subscription.id}`)
    return
  }

  const isLive = LIVE_STATUSES.includes(subscription.status)
  const justActivated = isLive && !wasLive

  if (justActivated) {
    const { data: priorSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', clerkId)
      .neq('stripe_subscription_id', subscription.id)
      .not('status', 'in', `(${NEVER_PAID_STATUSES.join(',')})`)
      .limit(1)

    const isResub = !!(priorSubs && priorSubs.length > 0)
    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    const amountCents = weeklyCentsForPrice(subscription.items.data[0]?.price.id)

    if (isResub) {
      await sendAdminPush('resub', `${name} resubscribed to Manager+ (white label).`)
      await recordBillingEvent({
        clerkId, eventType: 'resub', plan: 'wl', amountCents,
        stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
      })
    } else {
      await sendAdminPush('new_sub', `${name} subscribed to Manager+ (white label).`)
      await recordBillingEvent({
        clerkId, eventType: 'initial_sub', plan: 'wl', amountCents,
        stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
      })
    }
  } else if (
    eventType === 'invoice.payment_succeeded' &&
    billingReason === 'subscription_cycle'
  ) {
    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    const amountCents = weeklyCentsForPrice(subscription.items.data[0]?.price.id)
    await sendAdminPush('renewal', `${name}'s Manager+ subscription renewed.`)
    await recordBillingEvent({
      clerkId, eventType: 'renewal', plan: 'wl', amountCents,
      stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
    })
  }

  
  await upsertPersonalSubscription(subscription, clerkId, eventCreatedAt)
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

async function markWhitelabelCanceled(subscription: Stripe.Subscription, eventCreatedAt?: number) {
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  // Same throwaway-incomplete-subscription issue as markPersonalSubCanceled
  // above: Stripe fires this same deleted event when create-subscription
  // cancels a never-paid incomplete sub during a normal checkout retry, not
  // just on a genuine cancellation. Only treat it as real if the row had
  // actually reached 'active' at some point.
  const { data: existingRow } = await supabase
    .from('subscriptions')
    .select('status, created_at, stripe_price_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  const wasEverActive = existingRow?.status === 'active' || subscription.status === 'active'

  if (!wasEverActive) {
    // Throwaway incomplete subscription being cleaned up, not a real
    // cancellation — delete rather than stamp canceled_at (see
    // markPersonalSubCanceled for the full explanation).
    await supabase
      .from('subscriptions')
      .delete()
      .eq('stripe_subscription_id', subscription.id)
    return
  }

  const canceledAt = new Date()
  const lastEventAt = new Date((eventCreatedAt ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: canceledAt.toISOString(),
      last_event_at: lastEventAt,
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

    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    await sendAdminPush('cancel', `${name} canceled their Manager+ (white label) subscription.`)

    const retentionWeeks = existingRow?.created_at
      ? Math.floor((canceledAt.getTime() - new Date(existingRow.created_at).getTime()) / (7 * 86400000))
      : null
    await recordBillingEvent({
      clerkId,
      eventType: 'cancel',
      plan: 'wl',
      amountCents: weeklyCentsForPrice(existingRow?.stripe_price_id),
      retentionWeeks,
      stripeSubscriptionId: subscription.id,
      userName: name,
      userEmail: email,
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
  eventCreatedAt?: number
) {
  const clerkId =
    subscription.metadata?.clerk_id ||
    (await lookupClerkIdByCustomer(subscription))

  if (!clerkId) {
    console.error('No user found for subscription', subscription.id)
    return
  }

  // Ignore a stale/out-of-order event outright (see
  // resolveSubscriptionEventOrdering) — an older event arriving after a
  // newer one has already written 'active' must not clobber it back down
  // to 'incomplete', which is what previously caused a real subscribe to
  // read as "just subscribed" at signup time and "resubscribed" at the
  // moment of actual payment.
  const { isStale, wasLive } = await resolveSubscriptionEventOrdering(subscription.id, eventCreatedAt)
  if (isStale) {
    console.log(`[personal-sub] ignoring stale/out-of-order event for subscription ${subscription.id}`)
    return
  }

  const isLive = LIVE_STATUSES.includes(subscription.status)
  const justActivated = isLive && !wasLive

  if (justActivated) {
    // Mirrors the same first-sub-vs-resub logic the admin Logs app already
    // computes read-side (earliest subscription per user) — including
    // excluding incomplete/incomplete_expired rows, which never had a
    // completed payment and are routinely created and discarded during a
    // normal first-time checkout (plan switches, promo retries, etc).
    const { data: priorSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', clerkId)
      .neq('stripe_subscription_id', subscription.id)
      .not('status', 'in', `(${NEVER_PAID_STATUSES.join(',')})`)
      .limit(1)

    const isResub = !!(priorSubs && priorSubs.length > 0)
    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    const amountCents = weeklyCentsForPrice(subscription.items.data[0]?.price.id)

    if (isResub) {
      await sendAdminPush('resub', `${name} resubscribed.`)
      await recordBillingEvent({
        clerkId, eventType: 'resub', plan: 'pro', amountCents,
        stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
      })
    } else {
      await sendAdminPush('new_sub', `${name} subscribed.`)
      await recordBillingEvent({
        clerkId, eventType: 'initial_sub', plan: 'pro', amountCents,
        stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
      })
    }
  } else if (
    eventType === 'invoice.payment_succeeded' &&
    billingReason === 'subscription_cycle'
  ) {
    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    const amountCents = weeklyCentsForPrice(subscription.items.data[0]?.price.id)
    await sendAdminPush('renewal', `${name}'s subscription renewed.`)
    await recordBillingEvent({
      clerkId, eventType: 'renewal', plan: 'pro', amountCents,
      stripeSubscriptionId: subscription.id, userName: name, userEmail: email,
    })
  }

  await upsertPersonalSubscription(subscription, clerkId, eventCreatedAt)
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

async function lookupDisplayName(clerkId: string): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  if (!data) return 'A customer'
  const full = `${data.first_name || ''} ${data.last_name || ''}`.trim()
  return full || data.email?.split('@')[0] || 'A customer'
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

async function lookupEmail(clerkId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  return data?.email ?? null
}

const PRO_WEEKLY_CENTS = 35 * 100
const WL_WEEKLY_CENTS = 75 * 100

function weeklyCentsForPrice(priceId: string | null | undefined): number {
  if (priceId && priceId === process.env.STRIPE_PRICE_WL_BASE) return WL_WEEKLY_CENTS
  if (priceId && priceId === process.env.STRIPE_PRICE_ID) return PRO_WEEKLY_CENTS
  return 0
}

// Writes a durable, denormalized row to billing_events. This is the single
// place every lifecycle notification (new_sub, resub, renewal, cancel) also
// gets logged permanently — independent of whether the users/subscriptions
// rows it was computed from still exist later. See
// migrations/BILLING_EVENTS_AUDIT_LOG_2026-07-18.sql for the full
// rationale. Never throws — a logging failure should never break the
// webhook's actual business logic.
async function recordBillingEvent(evt: {
  clerkId: string
  eventType: 'account_created' | 'initial_sub' | 'resub' | 'renewal' | 'cancel'
  plan?: 'pro' | 'wl' | null
  amountCents?: number
  retentionWeeks?: number | null
  stripeSubscriptionId?: string | null
  userName: string
  userEmail?: string | null
}): Promise<void> {
  try {
    const { error } = await supabase.from('billing_events').insert({
      clerk_id: evt.clerkId,
      event_type: evt.eventType,
      plan: evt.plan ?? null,
      amount_cents: evt.amountCents ?? 0,
      retention_weeks: evt.retentionWeeks ?? null,
      stripe_subscription_id: evt.stripeSubscriptionId ?? null,
      user_name: evt.userName,
      user_email: evt.userEmail ?? null,
    })
    if (error) {
      console.error('[recordBillingEvent] insert failed:', error)
    }
  } catch (err) {
    console.error('[recordBillingEvent] unexpected error:', err)
  }
}

async function upsertPersonalSubscription(
  subscription: Stripe.Subscription,
  clerkId: string,
  eventCreatedAt?: number
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
    // Stripe event `created` timestamp (when Stripe originated this event),
    // not our own receipt time — this is what lets a future event detect
    // whether it's older than what's already stored and skip if so. Falls
    // back to "now" only when the caller genuinely has no event context.
    last_event_at: new Date((eventCreatedAt ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
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

async function markPersonalSubCanceled(subscription: Stripe.Subscription, eventCreatedAt?: number) {
  // create-subscription/route.ts cancels a user's leftover `incomplete`
  // subscription (the placeholder Stripe creates the moment someone loads
  // the billing page, before any card is entered) every time they reload
  // billing, switch plans, or retry a promo code. Stripe fires the exact
  // same customer.subscription.deleted event for that as it does for a real
  // paying customer canceling — the object's status reads 'canceled'
  // either way. The only way to tell them apart is to check whether this
  // subscription row ever actually reached 'active' in our own database; an
  // incomplete sub that got canceled before ever being paid never did. Only
  // a subscription that was genuinely active is a real cancellation worth
  // logging or pushing a notification for.
  const { data: existingRow } = await supabase
    .from('subscriptions')
    .select('status, created_at, stripe_price_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  const wasEverActive = existingRow?.status === 'active' || subscription.status === 'active'

  if (!wasEverActive) {
    // Throwaway incomplete subscription being cleaned up, not a real
    // cancellation. Delete the row rather than stamping canceled_at on it —
    // the admin Logs route treats any row with canceled_at set as a real
    // CANCEL event, so leaving that timestamp on a never-paid row would
    // still surface it there even though nothing user-facing happened.
    await supabase
      .from('subscriptions')
      .delete()
      .eq('stripe_subscription_id', subscription.id)
    return
  }

  const canceledAt = new Date()
  const lastEventAt = new Date((eventCreatedAt ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: canceledAt.toISOString(),
      last_event_at: lastEventAt,
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
    const name = await lookupDisplayName(clerkId)
    const email = await lookupEmail(clerkId)
    await sendAdminPush('cancel', `${name} canceled their subscription.`)

    const retentionWeeks = existingRow?.created_at
      ? Math.floor((canceledAt.getTime() - new Date(existingRow.created_at).getTime()) / (7 * 86400000))
      : null
    await recordBillingEvent({
      clerkId,
      eventType: 'cancel',
      plan: 'pro',
      amountCents: weeklyCentsForPrice(existingRow?.stripe_price_id),
      retentionWeeks,
      stripeSubscriptionId: subscription.id,
      userName: name,
      userEmail: email,
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