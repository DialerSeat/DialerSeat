import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import { closeFailedPlans, endedOnFailedPayment } from '@/lib/failedPlan'

const supabase = getServiceClient('stripe/create-subscription')

// 'past_due' used to be here too, which made RESUBSCRIBE a dead end for
// anybody whose renewal had declined: checkout refused them for holding the
// very plan that had stopped working. A failed plan is now replaced rather
// than obeyed. See FAILED_RENEWAL_STATUSES and lib/failedPlan.
const BLOCKING_STATUSES = ['active']
// A plan whose renewal payment failed. Stripe is still retrying (past_due) or
// has stopped (unpaid); either way the account is read-only and the plan is
// what stands between this person and paying again.
const FAILED_RENEWAL_STATUSES = ['past_due', 'unpaid']
// 'trialing' stays in this list even though nothing creates a trial any more.
// It is a CLEANUP list, and its job is to clear historical rows out of the way
// before a new subscription is written — legacy trialing rows still exist and
// still need removing.
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
        // Every visit to billing creates a subscription and the next one
        // cancels it, so ten was a handful of page loads. The checks below
        // read this customer's HISTORY (did a payment fail before?), and a
        // plan that ended on a declined card must not scroll out of view.
        limit: 100,
      })
    } catch (err: any) {
      if (isResourceMissing(err)) {
        await supabase
          .from('users')
          .update({ stripe_customer_id: null })
          .eq('clerk_id', userId)
        return NextResponse.json(
          { error: 'Account sync issue, please try again.' },
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

    // Seat subscriptions pay for somebody's seat on a team. They are never this
    // person's own plan, and one falling behind is the team's business, so
    // nothing here replaces one or counts it against the buyer.
    const ownPlans = stripeSubs.data.filter((s) => s.metadata?.sub_kind !== 'team_seat')
    const failedRenewals = ownPlans.filter((s) => FAILED_RENEWAL_STATUSES.includes(s.status))

    // ── NO DISCOUNT FOR COMING BACK FROM A DECLINE ──────────────────────
    // Somebody whose card declined on renewal restarts at the plan's price.
    // Otherwise a failed payment becomes a way to buy the same plan cheaper.
    //
    // Checked against the whole history, not only a plan failing right now:
    // the first visit to billing replaces the failed plan, so a code typed a
    // moment later would find nothing failing, and so would a return visit
    // after Stripe gave up and cancelled the plan itself. Plans that never
    // took a first payment (incomplete, incomplete_expired) don't count; a
    // stalled signup is exactly who a code is for.
    const failedBefore = failedRenewals.length > 0 || ownPlans.some(endedOnFailedPayment)
    if (promoCode && failedBefore) {
      return NextResponse.json(
        { error: "Discount codes can't be used when restarting a plan after a failed payment." },
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


    // Except a plan that failed on a declined card. Its row is this person's
    // history, and it is what tells the webhook their next payment is a
    // resubscribe rather than a first-time signup. Its access is already cut
    // to the moment it ended (lib/failedPlan), so it unlocks nothing.
    const failedPlanIds = [...failedRenewals, ...ownPlans.filter(endedOnFailedPayment)].map((s) => s.id)
    let staleRows = supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('status', STALE_STATUSES)
    if (failedPlanIds.length > 0) {
      staleRows = staleRows.not('stripe_subscription_id', 'in', `(${failedPlanIds.join(',')})`)
    }
    await staleRows

    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'incomplete')


    const subParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        clerk_id: userId,
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

    // Last step before the new plan exists, after every check that can still
    // turn this request away: ending a plan is not something to undo.
    const toClose = [...failedRenewals, ...ownPlans.filter(endedOnFailedPayment)]
    if (toClose.length > 0) {
      let closed: Awaited<ReturnType<typeof closeFailedPlans>>
      try {
        closed = await closeFailedPlans(failedRenewals, toClose)
      } catch (err) {
        // Handled here, never passed on: the catch at the bottom of this
        // route reads a missing-resource error as a broken customer record
        // and unlinks the customer, which would orphan their payment history.
        console.error('[create-sub] could not close failed plan:', err)
        return NextResponse.json(
          { error: "We couldn't close your old plan, so nothing was charged. Try again in a minute." },
          { status: 500 }
        )
      }
      if (closed) {
        console.error(`[create-sub] ${closed.paidMeanwhile} was paid as it was being replaced; not starting a new plan`)
        return NextResponse.json(
          { error: 'Your last payment just went through, so this week is already paid for. Nothing more was charged.' },
          { status: 409 }
        )
      }
    }

    const subscription = await stripe.subscriptions.create({
      ...subParams,
      // pending_setup_intent is still expanded even though nothing here
      // creates a subscription that defers payment. A 100% promo code leaves
      // an invoice with nothing to charge, and Stripe puts a SetupIntent
      // there instead of a PaymentIntent — the card still has to be saved for
      // the renewal. Dropping the expand would make that path return no
      // secret at all.
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
    })

    const invoice = subscription.latest_invoice as any
    const confirmationSecret = invoice?.confirmation_secret?.client_secret

    // ── SOMEBODY REACHED THE PAYMENT FORM ─────────────────────────────────
    // /api/stripe/checkout-failed records WHY a payment failed, and after four
    // days it held zero rows against three signups stuck at 'incomplete'. It
    // was not broken: it fires from stripe.confirmPayment's error branch, and
    // those three never produced an error because they never submitted. They
    // reached the form and left.
    //
    // So the missing signal was never the failure, it was the ARRIVAL. With
    // this, a stalled signup is finally readable:
    //
    //   started, then active            converted
    //   started, then checkout_failed   a real decline, reason on file
    //   started, then nothing           abandoned at the form -- OUR problem
    //
    // That last row is the one that could not be told from the second, and
    // they have opposite fixes: one is somebody's bank, the other is our
    // payment step losing people.
    //
    // Server-side on purpose. An abandonment cannot be reported by a page the
    // person has already closed, so a beforeunload beacon would miss exactly
    // the case it exists for. This fires the moment Stripe hands back a
    // payable invoice, which is the last instant we are certain they got that
    // far.
    //
    // Fire-and-forget, and NOT awaited: a diagnostic must never delay or fail
    // a checkout. amount_cents is NOT NULL on this table and no money has
    // moved yet, so it records the invoice total as the intended amount.
    void supabase.from('billing_events').insert({
      clerk_id: userId,
      event_type: 'checkout_started',
      plan: typeof plan === 'string' ? plan.slice(0, 40) : null,
      amount_cents: typeof invoice?.total === 'number' ? invoice.total : 0,
      stripe_subscription_id: subscription.id,
      detail: {
        subscription_status: subscription.status,
        has_confirmation_secret: !!confirmationSecret,
        invoice_id: invoice?.id ?? null,
        at: new Date().toISOString(),
      },
    }).then(({ error }) => {
      if (error) console.error('[create-subscription] checkout_started insert failed:', error.message)
    })

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
        { error: 'Account out of sync, please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: err.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}