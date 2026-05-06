import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Statuses that should block creation of a NEW sub.
// Note: 'incomplete' is NOT here — that's the state our own code creates
// while waiting for payment confirmation. Including it would create an
// infinite loop where retrying the billing page errors out.
// 'trialing' is also NOT here — we don't have trials anymore. If somehow a
// trialing row appears, it's stale data and shouldn't block new signups.
const BLOCKING_STATUSES = ['active', 'past_due']

// Statuses that mean "this is junk, delete it before retry"
const STALE_STATUSES = [
  'canceled',
  'incomplete_expired',
  'unpaid',
  'trialing', // legacy trial-era data
]

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

    // Optional: read promo code from body
    let promoCode: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      promoCode = (body?.code as string)?.trim() || null
    } catch {
      // body is optional
    }

    // 1) Ensure the user row exists in Supabase
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

    // 2) Look up or create the Stripe customer
    const { data: existingUser } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', userId)
      .single()

    let customerId = existingUser?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || undefined,
        metadata: { clerk_id: userId },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('clerk_id', userId)
    }

    // 3) Check Stripe directly for any LIVE subs that should block creation
    // (active, past_due — these are paying customers who shouldn't double-subscribe)
    const stripeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })

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

    // 4) Cancel ANY existing 'incomplete' subs for this customer in Stripe.
    // These are abandoned billing attempts. Without cleaning them up, the user
    // accumulates orphan subs in Stripe forever.
    const incompleteSubs = stripeSubs.data.filter((s) => s.status === 'incomplete')
    for (const sub of incompleteSubs) {
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch (err) {
        console.warn('Failed to cancel incomplete sub:', sub.id, err)
        // Non-fatal — Stripe sometimes already cleaned them up
      }
    }

    // 5) Clean up stale local rows (trialing, canceled, expired, etc.)
    // After this delete, the only sub rows that survive are 'active' / 'past_due'
    // ones, which the BLOCKING check above already handled.
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('status', STALE_STATUSES)

    // Also delete any 'incomplete' rows in Supabase. The webhook will
    // recreate the right one when we make the new sub below.
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'incomplete')

    // 6) Build subscription create params
    // Note: expand is set at the create() call below, not here — the Dahlia
    // API (2026-04-22+) renamed the field we expand to 'confirmation_secret'.
    const subParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: { clerk_id: userId },
    }

    // 7) Apply promo code if provided
    // Stripe accepts coupon IDs (created in dashboard) OR promotion codes (user-facing).
    // We use the `discounts` array which is the current Stripe API surface
    // and works across SDK versions.
    if (promoCode) {
      try {
        // Look up as a promotion code first (what users actually have)
        const promos = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        })

        if (promos.data.length > 0) {
          subParams.discounts = [{ promotion_code: promos.data[0].id }]
          subParams.metadata = {
            ...subParams.metadata,
            promo_code: promoCode,
          }
        } else {
          // Try as a coupon ID directly (admin path)
          try {
            const coupon = await stripe.coupons.retrieve(promoCode)
            if (coupon.valid) {
              subParams.discounts = [{ coupon: coupon.id }]
              subParams.metadata = {
                ...subParams.metadata,
                promo_code: promoCode,
              }
            } else {
              return NextResponse.json(
                { error: `Promo code "${promoCode}" is not valid.` },
                { status: 400 }
              )
            }
          } catch {
            // Not a coupon either — let the user know
            return NextResponse.json(
              { error: `Promo code "${promoCode}" not found or expired.` },
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

    // 8) Create the subscription
    // Dahlia API (2026-04-22+) replaced `latest_invoice.payment_intent` with
    // `latest_invoice.confirmation_secret`. The Element-side code (PaymentElement
    // + confirmPayment) doesn't change — only the field name on our end.
    const subscription = await stripe.subscriptions.create({
      ...subParams,
      expand: ['latest_invoice.confirmation_secret'],
    })

    const invoice = subscription.latest_invoice as any
    const confirmationSecret = invoice?.confirmation_secret?.client_secret

    // EDGE CASE: 100% off coupon means no payment needed.
    // The invoice is auto-paid, no confirmation_secret is created, sub goes straight to 'active'.
    if (!confirmationSecret) {
      // Free coupon path
      if (subscription.status === 'active') {
        return NextResponse.json({
          subscriptionId: subscription.id,
          clientSecret: null,
          freeWithCoupon: true,
        })
      }

      console.error('No confirmation_secret on first invoice', {
        subId: subscription.id,
        status: subscription.status,
        invoice: invoice?.id,
        invoiceStatus: invoice?.status,
        hasConfirmationSecret: !!invoice?.confirmation_secret,
      })
      return NextResponse.json(
        { error: 'Failed to initialize payment. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: confirmationSecret,
    })
  } catch (err: any) {
    console.error('create-subscription error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}