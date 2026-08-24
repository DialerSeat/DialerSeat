import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import { TRIAL_DAYS } from '@/lib/entitlement'

const supabase = getServiceClient('stripe/create-subscription')

const BLOCKING_STATUSES = ['active', 'past_due']
const STALE_STATUSES = [
  'canceled',
  'incomplete_expired',
  'unpaid',
  'trialing',
]

function isResourceMissing(err: any): boolean {
  return err?.code === 'resource_missing' || err?.raw?.code === 'resource_missing'
}

async function getOrCreateCustomer(
  userId: string,
  email: string,
  firstName: string | null,
  lastName: string | null
): Promise<string> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('clerk_id', userId)
    .single()

  let customerId = existingUser?.stripe_customer_id

  if (customerId) {
    try {
      const verify = await stripe.customers.retrieve(customerId)
      if (verify && !('deleted' in verify && verify.deleted)) {
        return customerId
      }
      console.warn(`[create-sub] stripe customer ${customerId} is marked deleted, recreating`)
      customerId = null
    } catch (err: any) {
      if (isResourceMissing(err)) {
        console.warn(`[create-sub] stripe customer ${customerId} not found, recreating`)
        customerId = null
      } else {
        throw err
      }
    }
  }

  if (!customerId) {
    await supabase
      .from('users')
      .update({ stripe_customer_id: null })
      .eq('clerk_id', userId)

    const customer = await stripe.customers.create({
      email,
      name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || undefined,
      metadata: { clerk_id: userId },
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('clerk_id', userId)
  }

  return customerId
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const email = user.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ error: 'No email on user' }, { status: 400 })
    }

    let plan: 'standard' | 'wl' = 'standard'
    let promoCode: string | null = null
    let pendingTeamMemberId: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      if (body?.plan === 'wl') plan = 'wl'
      promoCode = (body?.code as string)?.trim() || null
      pendingTeamMemberId = (body?.teamMemberId as string)?.trim() || null
    } catch {

    }

    if (pendingTeamMemberId) {
      const { data: pendingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', pendingTeamMemberId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle()
      // Doesn't belong to this user, or isn't actually pending — ignore it
      // rather than fail the whole subscription attempt.
      if (!pendingMember) pendingTeamMemberId = null
    }

    const priceId =
      plan === 'wl'
        ? process.env.STRIPE_PRICE_WL_BASE
        : process.env.STRIPE_PRICE_ID

    if (!priceId) {
      const envVarName = plan === 'wl' ? 'STRIPE_PRICE_WL_BASE' : 'STRIPE_PRICE_ID'
      console.error(`[create-sub] missing env var: ${envVarName}`)
      return NextResponse.json(
        {
          error:
            plan === 'wl'
              ? 'White-label pricing is not configured yet. Contact support.'
              : 'Subscription pricing is not configured.',
        },
        { status: 500 }
      )
    }

    const { error: upsertErr } = await supabase
      .from('users')
      .upsert(
        {
          clerk_id: userId,
          email,
          first_name: user.firstName ?? null,
          last_name: user.lastName ?? null,
        },
        { onConflict: 'clerk_id' }
      )

    if (upsertErr) {
      console.error('User upsert error:', upsertErr)
      return NextResponse.json(
        { error: 'Failed to sync user record' },
        { status: 500 }
      )
    }

    const customerId = await getOrCreateCustomer(
      userId,
      email,
      user.firstName,
      user.lastName
    )

    let stripeSubs: Stripe.ApiList<Stripe.Subscription>
    try {
      stripeSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      })
    } catch (err: any) {
      if (isResourceMissing(err)) {
        await supabase
          .from('users')
          .update({ stripe_customer_id: null })
          .eq('clerk_id', userId)
        return NextResponse.json(
          { error: 'Account sync issue — please try again.' },
          { status: 500 }
        )
      }
      throw err
    }

    const blockingSub = stripeSubs.data.find((s) =>
      BLOCKING_STATUSES.includes(s.status)
    )

    if (blockingSub) {
      return NextResponse.json(
        {
          error: 'You already have an active subscription. Manage it from Settings.',
          existingSubscriptionId: blockingSub.id,
        },
        { status: 400 }
      )
    }

    const incompleteSubs = stripeSubs.data.filter((s) => s.status === 'incomplete')
    for (const sub of incompleteSubs) {
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch (err) {
        console.warn('Failed to cancel incomplete sub:', sub.id, err)
      }
    }

    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('status', STALE_STATUSES)

    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'incomplete')

    // ── IS THIS A FIRST TRIAL? ────────────────────────────────────────────
    // Two conditions, both about this account: they have never started a trial,
    // and they have never had a subscription at all. A lapsed customer coming
    // back is not a new customer, and giving them a free week every time they
    // resubscribe would turn the trial into a discount for churning.
    //
    // The CARD check cannot happen here — the card is collected after this
    // subscription exists — so it runs when the card first becomes visible and
    // ends a repeat trial early rather than blocking checkout. See the webhook.
    const { data: trialRow } = await supabase
      .from('users')
      .select('trial_started_at')
      .eq('clerk_id', userId)
      .maybeSingle()

    const { data: priorSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    // ── ONCE PER ACCOUNT, FOREVER ─────────────────────────────────────────
    // trial_started_at is set the moment a trial begins and is NEVER cleared
    // — not on cancel, not when the trial expires, not when they resubscribe.
    // Cancelling during a trial does not return it, and neither does letting
    // it run out. After that there is one route back in and it is payment.
    //
    // It is also the durable half of the check. The prior-subscription test
    // below can be defeated: this route deletes abandoned `incomplete` rows,
    // so somebody who bails at checkout looks new again by that measure. The
    // flag does not move, which is why it is first.
    const eligibleForTrial =
      !trialRow?.trial_started_at && (priorSubs || []).length === 0

    const subParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      ...(eligibleForTrial
        ? {
            trial_period_days: TRIAL_DAYS,
            // A trial with no card on file must end, not roll into a free
            // subscription nobody is paying for. The card is collected during
            // checkout, so this only fires if something went wrong.
            trial_settings: {
              end_behavior: { missing_payment_method: 'cancel' as const },
            },
          }
        : {}),
      metadata: {
        clerk_id: userId,
        ...(eligibleForTrial ? { trial: 'first' } : {}),
        ...(plan === 'wl' ? { sub_kind: 'whitelabel' } : {}),
        ...(pendingTeamMemberId ? { pending_team_member_id: pendingTeamMemberId } : {}),
      },
    }

    let appliedCoupon: {
      percentOff: number | null
      amountOffCents: number | null
      duration: 'once' | 'repeating' | 'forever'
      durationInMonths: number | null
    } | null = null

    if (promoCode) {
      try {
        const promos = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
          expand: ['data.promotion.coupon'],
        })

        if (promos.data.length > 0) {
          subParams.discounts = [{ promotion_code: promos.data[0].id }]
          subParams.metadata = {
            ...subParams.metadata,
            promo_code: promoCode,
          }
          // promotion.coupon may come back as just an ID if expansion didn't
          // take (defensive — don't assume the expand always resolves it).
          const rawCoupon = promos.data[0].promotion.coupon
          const c = typeof rawCoupon === 'string'
            ? await stripe.coupons.retrieve(rawCoupon)
            : rawCoupon
          if (c) {
            appliedCoupon = {
              percentOff: c.percent_off ?? null,
              amountOffCents: c.amount_off ?? null,
              duration: c.duration,
              durationInMonths: c.duration_in_months ?? null,
            }
          }
        } else {
          try {
            const coupon = await stripe.coupons.retrieve(promoCode)
            if (coupon.valid) {
              subParams.discounts = [{ coupon: coupon.id }]
              subParams.metadata = {
                ...subParams.metadata,
                promo_code: promoCode,
              }
              appliedCoupon = {
                percentOff: coupon.percent_off ?? null,
                amountOffCents: coupon.amount_off ?? null,
                duration: coupon.duration,
                durationInMonths: coupon.duration_in_months ?? null,
              }
            } else {
              return NextResponse.json(
                { error: `"${promoCode}" is not a valid discount code or team invite code.` },
                { status: 400 }
              )
            }
          } catch {
            return NextResponse.json(
              // ── NAME BOTH NAMESPACES ────────────────────────────────
              // This box takes a Stripe discount code OR a DialerSeat team
              // invite, and the billing page only reaches Stripe after the
              // team-code lookup has already returned 404. So by the time
              // this fires, the code is genuinely neither — and saying
              // "promo code not found" sent people hunting through Stripe
              // for a team code that was mistyped, or vice versa.
              { error: `"${promoCode}" is not a valid discount code or team invite code. Check it for typos and try again.` },
              { status: 400 }
            )
          }
        }
      } catch (err: any) {
        console.warn('Promo code lookup failed:', err)
        return NextResponse.json(
          { error: `Could not apply promo code: ${err.message}` },
          { status: 400 }
        )
      }
    }

    const subscription = await stripe.subscriptions.create({
      ...subParams,
      // pending_setup_intent as well as the invoice secret. A trial has
      // nothing to charge today, so there is no PaymentIntent to confirm —
      // Stripe puts a SetupIntent there instead, and confirming THAT is what
      // saves the card for when the trial ends.
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
    })

    const invoice = subscription.latest_invoice as any
    const confirmationSecret = invoice?.confirmation_secret?.client_secret

    // The actual, Stripe-computed amounts for THIS invoice — always derived
    // from the real invoice, never from a hardcoded plan price. This is what
    // the billing page now displays instead of a static "$35/$75" label that
    // never moved when a coupon was applied.
    const amounts = invoice
      ? {
          subtotalCents: invoice.subtotal as number,
          totalCents: invoice.total as number,
          currency: (invoice.currency as string) || 'usd',
        }
      : null

    // ── A TRIAL CONFIRMS A SETUP, NOT A PAYMENT ───────────────────────────
    // Nothing is owed today, so there is no PaymentIntent. Stripe puts a
    // SetupIntent on pending_setup_intent instead, and the client confirms
    // that to save the card for when the trial ends. Same Elements form, a
    // different confirm call — which is why `mode` travels with the secret
    // rather than the client guessing from the amount.
    if (subscription.status === 'trialing') {
      const setupIntent = (subscription as any).pending_setup_intent
      const setupSecret = setupIntent?.client_secret ?? null

      if (!setupSecret) {
        console.error('Trial subscription has no pending_setup_intent', {
          subId: subscription.id,
          status: subscription.status,
        })
        return NextResponse.json(
          { error: 'Failed to start your trial. Please try again.' },
          { status: 500 }
        )
      }

      const trialEnd = (subscription as any).trial_end
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: setupSecret,
        // The client needs to call confirmSetup rather than confirmPayment.
        mode: 'setup',
        plan,
        trial: {
          days: TRIAL_DAYS,
          endsAt: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
        },
        amounts,
        coupon: appliedCoupon,
      })
    }

    if (!confirmationSecret) {
      if (subscription.status === 'active') {
        return NextResponse.json({
          subscriptionId: subscription.id,
          clientSecret: null,
          freeWithCoupon: true,
          amounts,
          coupon: appliedCoupon,
        })
      }

      console.error('No confirmation_secret on first invoice', {
        subId: subscription.id,
        status: subscription.status,
        invoice: invoice?.id,
        invoiceStatus: invoice?.status,
      })
      return NextResponse.json(
        { error: 'Failed to initialize payment. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: confirmationSecret,
      // Explicit rather than implied by omission, so the client never has to
      // infer which confirm call to make.
      mode: 'payment',
      plan,
      amounts,
      coupon: appliedCoupon,
    })
  } catch (err: any) {
    console.error('create-subscription error:', err)

    if (isResourceMissing(err)) {
      try {
        const { userId } = await auth()
        if (userId) {
          await supabase
            .from('users')
            .update({ stripe_customer_id: null })
            .eq('clerk_id', userId)
        }
      } catch {}
      return NextResponse.json(
        { error: 'Account out of sync — please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: err.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}