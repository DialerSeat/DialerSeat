import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { stripe } from '@/lib/stripe'
import { activatePendingTeamMember, deactivateTeamMember } from '@/lib/teamMembership'
import { sendAdminPush } from '@/lib/pushNotify'
import { takeOverAgentPaidSeats } from '@/lib/seatTakeover'
import { extractStripeFailureDetail, summariseStripeFailure } from '@/lib/stripeFailureDetail'
import { logBillingEvent } from '@/lib/billingEvents'
import { assembleAndSaveDisputeEvidence, recordDisputeClosed } from '@/lib/disputeEvidence'
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











































/**
 * The subscription an invoice belongs to, across Stripe API versions.
 *
 * ── THIS RETURNED UNDEFINED ON EVERY INVOICE FOR MONTHS ────────────────────
 * Stripe REMOVED the top-level `subscription` field from the Invoice object at
 * API version 2025-03-31.basil, replacing it with `parent.subscription_details
 * .subscription`. This client is pinned to 2026-04-22.dahlia, which is well
 * past that, so `invoice.subscription` was always undefined.
 *
 * The cost was silent and total. 90 invoice.payment_failed events were
 * received and recorded as "processed" while the guard below them never
 * opened: no routeSubscription, and no payment_failed notification, ever. A
 * declined card left a customer past_due with nobody told -- which is the
 * exact failure the comment inside that branch says it exists to prevent.
 *
 * Both shapes are read, new first. The old one is kept because a pinned
 * version does not protect against this -- Stripe's own changelog notes the
 * field can be absent on invoices created under the newer billing model
 * regardless of pinning -- so which shape arrives is not something this code
 * should assume either way.
 */
/**
 * The payment intent behind an invoice, across API versions.
 *
 * `invoice.payment_intent` was removed in the same 2025-03-31.basil change
 * that took `invoice.subscription`; it now hangs off payments. This only
 * feeds the human-readable decline reason and the billing_events row, both of
 * which are best effort -- but "best effort" was quietly returning nothing on
 * every single invoice, so the reason was never resolved and the row was
 * never written.
 */
function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { payment_intent?: string | { id?: string } }).payment_intent
  if (typeof legacy === 'string' && legacy) return legacy
  if (legacy && typeof legacy === 'object' && legacy.id) return legacy.id

  const payments = (invoice as unknown as {
    payments?: { data?: Array<{ payment?: { payment_intent?: string | { id?: string } } }> }
  }).payments?.data
  for (const p of payments ?? []) {
    const pi = p?.payment?.payment_intent
    if (typeof pi === 'string' && pi) return pi
    if (pi && typeof pi === 'object' && pi.id) return pi.id
  }
  return null
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id?: string } } }
  }).parent
  const fromParent = parent?.subscription_details?.subscription
  if (typeof fromParent === 'string' && fromParent) return fromParent
  if (fromParent && typeof fromParent === 'object' && fromParent.id) return fromParent.id

  const legacy = (invoice as unknown as { subscription?: string | { id?: string } }).subscription
  if (typeof legacy === 'string' && legacy) return legacy
  if (legacy && typeof legacy === 'object' && legacy.id) return legacy.id

  return null
}

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
        await routeSubscription(event.data.object as Stripe.Subscription, event.type, undefined, event.created)
        break

      case 'customer.subscription.deleted':
        await routeSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      // ── invoice.paid IS THE ONE STRIPE ACTUALLY SENDS ────────────────────
      // 53 invoice.paid events arrived and were skipped because only
      // invoice.payment_succeeded was listed here, so `renewal` had never
      // fired once in the platform's history. Both are handled now; the
      // idempotency claim upstream stops a double-send if Stripe delivers
      // both for one invoice.
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await routeSubscription(subscription, event.type, invoice.billing_reason ?? undefined, event.created)

          // ── A DECLINED CARD USED TO BE COMPLETELY SILENT ─────────────────
          // routeSubscription records the failure (chargeStatus 'failed' for
          // past_due) but nothing told anyone. The subscription would sit
          // past_due while the customer kept dialing, and the first signal was
          // a cancellation weeks later — or the customer emailing to ask why
          // they had been cut off. By then the relationship is the problem,
          // not the payment.
          //
          // This is the last revenue event that is still recoverable: a card
          // that declined today can be fixed today with one message.
          if (event.type === 'invoice.payment_failed') {
            try {
              const { data: subRow } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('stripe_subscription_id', subscriptionId)
                .maybeSingle()
              if (subRow?.user_id) {
                const { name } = await lookupNameAndEmail(subRow.user_id)
                const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2)

                // ── SAY WHY, NOT JUST THAT ───────────────────────────
                // This said "payment failed" and nothing else, which tells
                // whoever reads it to go and look it up in Stripe. The
                // invoice's own payment intent carries the reason, and the
                // charge carries Stripe's seller_message -- the sentence
                // written for the merchant rather than the cardholder.
                //
                // Best effort on purpose: a renewal failure is recoverable
                // and the notification matters more than the detail, so a
                // lookup that fails still sends the original message.
                let why = ''
                try {
                  const piId = invoicePaymentIntentId(invoice)
                  if (piId) {
                    const intent = await stripe.paymentIntents.retrieve(piId)
                    const chId = (intent as unknown as { latest_charge?: string }).latest_charge
                    const charge = typeof chId === 'string' ? await stripe.charges.retrieve(chId) : null
                    const detail = extractStripeFailureDetail(intent, charge)
                    why = ` ${summariseStripeFailure(detail)}`
                    await supabase.from('billing_events').insert({
                      clerk_id: subRow.user_id,
                      event_type: 'payment_failed',
                      plan: null,
                      amount_cents: invoice.amount_due ?? 0,
                      stripe_subscription_id: subscriptionId,
                      user_name: name,
                      user_email: null,
                      detail: { ...detail, summary: why.trim(), source: 'invoice.payment_failed' },
                    })
                  }
                } catch (e) {
                  console.error('[stripe/webhook] could not resolve invoice failure reason', e)
                }

                await sendAdminPush(
                  'payment_failed',
                  `${name}'s payment of $${amount} failed.${why} ` +
                  `Subscription is past due, recoverable if you reach them.`
                )
              }
            } catch (e) {
              // Never let a notification failure fail the webhook: Stripe would
              // retry the whole event and re-run everything above it.
              console.error('[stripe/webhook] payment_failed notification failed', e)
            }
          }
        }
        break
      }

      // ── STRIPE EXPLAINING, IN ITS OWN WORDS, WHY A PAYMENT FAILED ───────
      // Nothing listened for this, and it is the event that carries the real
      // story. invoice.payment_failed above says THAT a payment failed and
      // pushes a notification; this says WHY, with detail that never reaches
      // the browser:
      //
      //   charge.outcome.seller_message   Stripe's explanation written FOR
      //                                   THE MERCHANT, e.g. "The bank
      //                                   returned the decline code
      //                                   insufficient_funds."
      //   charge.outcome.network_status   declined_by_network means the bank
      //                                   refused. not_sent_to_network means
      //                                   WE blocked it before it ever left.
      //                                   Identical to the cardholder,
      //                                   opposite remedies.
      //   last_payment_error              code, decline_code, and the card
      //                                   that was tried -- brand, last4,
      //                                   funding, issuing country.
      //
      // Why this matters here: 19 of 34 users have tried to subscribe and
      // never succeeded, and until now not one of those failures left a
      // record of its cause anywhere.
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent

        // The charge holds `outcome`, which is the half worth having. A
        // payment blocked before reaching the network has no charge at all,
        // and that absence is itself the answer -- so a missing charge
        // produces partial detail rather than an aborted handler.
        let charge: Stripe.Charge | null = null
        try {
          const chargeId = (intent as unknown as { latest_charge?: string | Stripe.Charge }).latest_charge
          if (typeof chargeId === 'string') {
            charge = await stripe.charges.retrieve(chargeId)
          } else if (chargeId && typeof chargeId === 'object') {
            charge = chargeId
          }
        } catch (e) {
          console.error('[stripe/webhook] could not retrieve charge for outcome', e)
        }

        const detail = extractStripeFailureDetail(intent, charge)
        const summary = summariseStripeFailure(detail)

        // Who this was, resolved from the customer rather than trusted from
        // metadata, so the row is attributable even on an intent we did not
        // create ourselves.
        let clerkId: string | null =
          (intent.metadata?.clerk_id as string | undefined) ?? null
        if (!clerkId && typeof intent.customer === 'string') {
          const { data: byCustomer } = await supabase
            .from('users')
            .select('clerk_id')
            .eq('stripe_customer_id', intent.customer)
            .maybeSingle()
          clerkId = byCustomer?.clerk_id ?? null
        }

        console.error(
          `[stripe/webhook] payment_intent.payment_failed ${intent.id} ` +
          `(${clerkId ?? 'unknown user'}): ${summary}`
        )

        if (clerkId) {
          const { name, email } = await lookupNameAndEmail(clerkId)
          try {
            await supabase.from('billing_events').insert({
              clerk_id: clerkId,
              event_type: 'checkout_failed',
              plan: null,
              amount_cents: intent.amount ?? 0,
              stripe_subscription_id: null,
              user_name: name,
              user_email: email,
              detail: { ...detail, summary, source: 'webhook', payment_intent: intent.id },
            })
          } catch (e) {
            console.error('[stripe/webhook] failed to record checkout failure', e)
          }

          try {
            await sendAdminPush(
              'payment_failed',
              `${name} could not pay. ${summary}`,
              { title: 'Signup payment failed', url: '/dashboard/admin/desktop' }
            )
          } catch (e) {
            // Never let a notification failure fail the webhook -- Stripe
            // would retry the whole event and re-run everything above it.
            console.error('[stripe/webhook] payment-failed push failed', e)
          }
        }
        break
      }

      // ── A DISPUTE WAS PREVIOUSLY LOST BY DEFAULT ────────────────────────
      // Nothing listened for this. A dispute arrived as an email from Stripe
      // and, if nobody assembled evidence before the deadline, it was lost on
      // silence rather than on merit — while the evidence that would have won
      // it (the customer's own call records) sat in our database.
      //
      // The evidence is assembled and SAVED to Stripe, deliberately not
      // submitted: Stripe accepts evidence once and it cannot be amended
      // afterwards. A script filing unreviewed evidence at 3am converts a
      // recoverable situation into an unrecoverable one. What was actually
      // missing was never the typing — it was knowing in time.
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const result = await assembleAndSaveDisputeEvidence(dispute)
        try {
          await sendAdminPush('payment_failed', result.summary, {
            title: result.ok ? 'Dispute opened: evidence drafted' : 'Dispute opened: ACTION NEEDED',
            url: '/dashboard/admin/desktop',
          })
        } catch (e) {
          console.error('[stripe/webhook] dispute notification failed', e)
        }
        break
      }

      // Funds already moved when the dispute opened; this is the verdict.
      // Recorded so the dispute RATE is answerable from our own data — that
      // ratio, not any single loss, is what puts a merchant into Stripe's
      // monitoring programs.
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        await recordDisputeClosed(dispute)
        try {
          const amount = ((dispute.amount ?? 0) / 100).toFixed(2)
          await sendAdminPush(
            'payment_failed',
            `Dispute for $${amount} closed: ${dispute.status}.`,
            { title: `Dispute ${dispute.status}`, url: '/dashboard/admin/desktop' }
          )
        } catch (e) {
          console.error('[stripe/webhook] dispute close notification failed', e)
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










/**
 * Which product a Stripe subscription is, resolved from metadata first and the
 * PRICE ID second.
 *
 * WHY THE FALLBACK EXISTS: routing used to read subscription.metadata.sub_kind
 * alone, with personal/Pro as the untested default for anything else. So a
 * Manager+ subscription whose metadata was missing or written by an older
 * checkout flow fell silently into the Pro branch — and every admin push about
 * it read "subscribed to Pro" / "renewed Pro subscription", regardless of what
 * the customer actually bought. That is exactly the reported symptom: every
 * notification says Pro.
 *
 * Metadata is set by our own checkout code and can therefore be absent or
 * stale; the price id is assigned by Stripe on the subscription item and is
 * always present (confirmed against live data — 10 subscription rows have a
 * NULL plan column while every single row has a stripe_price_id). So the price
 * is the more trustworthy signal and is consulted whenever metadata doesn't
 * answer the question.
 */
function resolveSubKind(subscription: Stripe.Subscription): 'team_seat' | 'whitelabel' | 'personal' {
  const fromMetadata = subscription.metadata?.sub_kind
  if (fromMetadata === 'team_seat') return 'team_seat'
  if (fromMetadata === 'whitelabel') return 'whitelabel'

  const wlPriceId = process.env.STRIPE_PRICE_WL_BASE
  if (wlPriceId && subscription.items?.data?.some(i => i.price?.id === wlPriceId)) {
    console.warn(
      `[stripe/webhook] subscription ${subscription.id} has no sub_kind metadata but carries the ` +
      `Manager+ price, treating as whitelabel. Without this it would be reported to admins as Pro.`
    )
    return 'whitelabel'
  }

  return 'personal'
}

async function routeSubscription(
  subscription: Stripe.Subscription,
  eventType?: string,
  billingReason?: Stripe.Invoice.BillingReason,
  eventCreated?: number
) {
  const subKind = resolveSubKind(subscription)

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
  // Same metadata-or-price resolution as routeSubscription — a Manager+
  // cancellation with absent metadata would otherwise be reported to admins
  // as a Pro cancellation.
  const subKind = resolveSubKind(subscription)

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
          'nor a subscription item id: cannot void charge for sub:',
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
    (eventType === 'invoice.payment_succeeded' || eventType === 'invoice.paid') &&
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

    // ── ONLY IF THEY HAVE NOTHING ELSE ────────────────────────────────────
    // This set the user to 'canceled' unconditionally. Somebody who cancels
    // white-label while keeping an active Pro subscription would have been
    // marked cancelled on a plan they are still paying for, and locked out of
    // it. Found on a real account on 17 Sept: one owner, wl cancelled, pro
    // active, and the row said canceled.
    //
    // The subscription that just ended is already 'canceled' by the update
    // above, so anything still 'active' here is a DIFFERENT, live plan.
    const { count: stillActive } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', clerkId)
      .eq('status', 'active')

    if (!stillActive) {
      await supabase
        .from('users')
        .update({ subscription_status: 'canceled' })
        .eq('clerk_id', clerkId)
    } else {
      console.warn(
        `[whitelabel-cancel] ${clerkId} keeps ${stillActive} active subscription(s); ` +
        `tenant deactivated but account left active`
      )
    }

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

  // ── A DECLINE IS NOT AN EVICTION ────────────────────────────────────────
  // This revoked campaign access the instant Stripe said past_due — the FIRST
  // failed attempt. Every other part of the billing path assumes the opposite:
  // the grace period gives seven days, the daily job retries until a card is
  // attached, and the rule throughout is that a payment problem an agent cannot
  // see or fix must not stop them working.
  //
  // None of that could ever run. Access was already gone before the first retry,
  // so on a floor of fifty one expired card cut off fifty agents mid-shift.
  //
  // Only a TERMINAL state revokes now. past_due and unpaid are states we are
  // actively chasing, and cron/seat-billing-enforcement is what decides — after
  // the grace period, and by suspending the seat, which is visible and
  // reversible rather than silent.
  const terminal =
    subscription.status === 'canceled' || subscription.status === 'incomplete_expired'

  if (terminal) {
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

      // ── THEY PAY AGAIN, THEIR SEAT COMES BACK ───────────────────────
      // The mirror of lib/seatTakeover, and without it that function is a
      // one-way door. When a self-funding agent's own plan ends, their
      // agent-funded team seats are suspended with reason 'canceled'. Every
      // automatic un-suspend elsewhere filters on reason 'unpaid', so a
      // 'canceled' seat was never restored by anything: the agent could
      // resubscribe, get their own tier back, dial their OWN campaigns, and
      // still be permanently locked out of the team campaigns they were
      // suspended from — fixable only by an owner finding the manual lever.
      //
      // Scoped to reason 'canceled' on purpose. 'unpaid' belongs to the
      // enforcement job, which restores it when the OWNER's charge clears;
      // 'paused' is an owner's deliberate decision and an agent paying for
      // themselves must not overturn it.
      const { data: restored, error: restoreErr } = await supabase
        .from('team_members')
        .update({ seat_suspended_at: null, seat_suspend_reason: null })
        .eq('user_id', clerkId)
        .eq('status', 'active')
        .eq('seat_suspend_reason', 'canceled')
        .select('id')

      if (restoreErr) {
        console.error('[stripe/webhook] seat restore failed for', clerkId, restoreErr)
      } else if (restored && restored.length > 0) {
        // Campaign access was revoked with the seat, so it has to come back
        // with it — a live seat holding no grants is a seat that does not work.
        const { error: accessErr } = await supabase
          .from('team_campaign_access')
          .update({ is_active: true, revoked_at: null })
          .in('team_member_id', restored.map(r => r.id))
          .eq('is_active', false)
        if (accessErr) {
          console.error('[stripe/webhook] access restore failed for', clerkId, accessErr)
        }
        console.log(
          `[stripe/webhook] ${clerkId} resubscribed; restored ${restored.length} seat(s) ` +
          `suspended when their own plan ended.`
        )
      }
    }
  } else if (
    (eventType === 'invoice.payment_succeeded' || eventType === 'invoice.paid') &&
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

  // sub_kind metadata is set once at creation
  // (app/api/stripe/create-subscription/route.ts) and is normally present on
  // every event for the subscription's lifetime — but it is OUR field, so it
  // can be missing on anything created by an older flow. resolveSubKind falls
  // back to the Manager+ price id in that case, which is why the `plan` column
  // stops being written as 'pro' for Manager+ subscribers.
  const plan: 'pro' | 'wl' = resolveSubKind(subscription) === 'whitelabel' ? 'wl' : 'pro'

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
    plan,
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
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
    // ── THE FLOOR DOES NOT STOP BECAUSE ONE CARD DID ────────────────────
    // If this person held self-funded seats on somebody else's teams, those
    // seats would otherwise evaporate: access cut, dialing stopped, and the
    // owner finding out from an empty chair mid-shift. The owner picks them
    // up instead, and decides for themselves when to let them go.
    //
    // Awaited, not fired and forgotten: a promise left dangling when a
    // serverless response returns is simply discarded, and this one moves
    // money. Failures inside are caught and recorded per seat, so a billing
    // problem on one team cannot stop the cancellation being processed.
    try {
      await takeOverAgentPaidSeats(clerkId)
    } catch (e) {
      console.error('[stripe/webhook] seat takeover failed for', clerkId, e)
    }

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