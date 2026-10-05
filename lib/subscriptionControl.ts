import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { logBillingEvent } from '@/lib/billingEvents'
import { lookupUserIdentity } from '@/lib/userDisplayName'

// =============================================================================
// PAUSE, RESUME, CANCEL, RENEW — WITH STRIPE AS THE THING CHECKED, NOT TRUSTED
// =============================================================================
// Hussein paused his Pro plan on 17 Sept. Our row says so (paused_at is only
// ever written after Stripe accepts the pause), and Stripe still charged him
// $35 on 23 and 30 Sept, both renewals paid in full. Whatever lifted the
// pause on Stripe's side, nothing here noticed: we wrote the marker once and
// never looked again.
//
// So every action below writes to Stripe and then READS the subscription
// back, and the reconciler (reconcilePausedSubscriptions) puts the pause back
// wherever our record and Stripe disagree. paused_at is the record of what
// the customer asked for; Stripe is made to match it.
// =============================================================================

const supabase = getServiceClient('subscriptionControl')

export type SubscriptionAction = 'pause' | 'resume' | 'cancel' | 'renew'

export interface SubscriptionActionResult {
  stripeSubscriptionId: string
  ok: boolean
  error?: string
  /** What Stripe holds after the change, read back rather than assumed. */
  stripe?: { status: string; paused: boolean; cancelAtPeriodEnd: boolean }
}

function planOf(plan: string | null | undefined): 'pro' | 'wl' | null {
  return plan === 'pro' || plan === 'wl' ? plan : null
}

/** Every subscription of this person that can still bill. */
async function liveSubscriptions(clerkId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status, plan, paused_at, cancel_at_period_end')
    .eq('user_id', clerkId)
    .in('status', ['active', 'past_due', 'trialing', 'unpaid'])
    .order('created_at', { ascending: false })
  return data || []
}

async function readBack(subId: string) {
  const s = await stripe.subscriptions.retrieve(subId)
  return {
    status: s.status,
    paused: !!s.pause_collection,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
  }
}

/**
 * Apply one action to every live subscription this person has. All of them,
 * not the newest: a customer with two (Hussein had two from one sign-up) is
 * exactly the case where acting on one leaves the other billing.
 */
export async function applySubscriptionAction(
  clerkId: string,
  action: SubscriptionAction,
  source: 'admin' | 'customer'
): Promise<SubscriptionActionResult[]> {
  const subs = await liveSubscriptions(clerkId)
  const results: SubscriptionActionResult[] = []

  for (const sub of subs) {
    const id = sub.stripe_subscription_id as string
    try {
      if (action === 'pause') {
        // Always written to Stripe, even when our row already says paused:
        // that row being right and Stripe being wrong is the failure this
        // file exists for.
        await stripe.subscriptions.update(id, { pause_collection: { behavior: 'void' } })
        if (!sub.paused_at) {
          await supabase.from('subscriptions')
            .update({ paused_at: new Date().toISOString() })
            .eq('stripe_subscription_id', id)
        }
      } else if (action === 'resume') {
        // Our marker is cleared FIRST. Stripe's subscription.updated webhook
        // re-pauses anything our record says is paused, so clearing Stripe
        // first would let that webhook put the pause straight back.
        await supabase.from('subscriptions').update({ paused_at: null }).eq('stripe_subscription_id', id)
        try {
          await stripe.subscriptions.update(id, { pause_collection: null })
        } catch (err) {
          if (sub.paused_at) {
            await supabase.from('subscriptions')
              .update({ paused_at: sub.paused_at })
              .eq('stripe_subscription_id', id)
          }
          throw err
        }
      } else if (action === 'cancel') {
        await stripe.subscriptions.update(id, { cancel_at_period_end: true })
        await supabase.from('subscriptions')
          .update({ cancel_at_period_end: true })
          .eq('stripe_subscription_id', id)
      } else {
        // renew: undo a scheduled cancel, keep the same subscription.
        await stripe.subscriptions.update(id, { cancel_at_period_end: false })
        await supabase.from('subscriptions')
          .update({ cancel_at_period_end: false })
          .eq('stripe_subscription_id', id)
      }

      const after = await readBack(id)
      results.push({ stripeSubscriptionId: id, ok: true, stripe: after })

      // The webhook logs scheduled cancels itself; pause and resume are only
      // logged where they are made, so here.
      if (action === 'pause' || action === 'resume') {
        const { name, email } = await lookupUserIdentity(clerkId)
        await logBillingEvent({
          event_type: action, clerk_id: clerkId, user_name: name, user_email: email,
          plan: planOf(sub.plan), stripe_subscription_id: id,
          detail: { source },
        })
      }
    } catch (err) {
      results.push({
        stripeSubscriptionId: id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

/**
 * Make Stripe match every pause we hold. Run hourly, and also called by the
 * webhook for the one subscription an event is about. Returns what it fixed.
 */
export async function reconcilePausedSubscriptions(
  onlySubscriptionId?: string
): Promise<Array<{ stripeSubscriptionId: string; clerkId: string; repaused: boolean; error?: string }>> {
  let q = supabase
    .from('subscriptions')
    .select('stripe_subscription_id, user_id')
    .not('paused_at', 'is', null)
    .in('status', ['active', 'past_due', 'trialing', 'unpaid'])
  if (onlySubscriptionId) q = q.eq('stripe_subscription_id', onlySubscriptionId)
  const { data } = await q

  const out: Array<{ stripeSubscriptionId: string; clerkId: string; repaused: boolean; error?: string }> = []
  for (const row of data || []) {
    const id = row.stripe_subscription_id as string
    try {
      const s = await stripe.subscriptions.retrieve(id)
      if (s.pause_collection) continue
      if (s.status === 'canceled' || s.status === 'incomplete_expired') continue
      await stripe.subscriptions.update(id, { pause_collection: { behavior: 'void' } })
      out.push({ stripeSubscriptionId: id, clerkId: row.user_id as string, repaused: true })
      console.warn(`[subscriptionControl] ${id} was paused here but billing in Stripe; pause re-applied`)
    } catch (err) {
      out.push({
        stripeSubscriptionId: id, clerkId: row.user_id as string, repaused: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}
