import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

const supabase = getServiceClient('stripe/create-subscription')

const BLOCKING_STATUSES = ['active', 'past_due']
const STALE_STATUSES = [
  'canceled',
  'incomplete_expired',
  'unpaid',
  'trialing',
]

// =============================================================================
// /api/stripe/create-subscription
// =============================================================================
// Creates a new Stripe subscription for the calling user. Supports two plans:
//
//   plan: 'standard' (default) → $35/wk via STRIPE_PRICE_ID
//   plan: 'wl'                 → $115/wk via STRIPE_PRICE_WL_BASE
//
// WL subscriptions get `metadata.sub_kind = 'whitelabel'` so the webhook
// branches into the tenant provisioning flow on payment success.
//
// REQUEST BODY (all optional):
//   { plan: 'standard' | 'wl', code?: string }
//
// If neither STRIPE_PRICE_ID nor STRIPE_PRICE_WL_BASE env var is set, we
// return a clear error instead of letting Stripe yell about a missing price.
//
// CONSTRAINT: a user can only have ONE active subscription. If they're trying
// to create a WL sub while having an active standard sub, they get blocked
// and told to manage from Settings. Same the other way around.
// =============================================================================

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

    // ── PARSE BODY: plan + promo code ─────────────────────────────────
    let plan: 'standard' | 'wl' = 'standard'
    let promoCode: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      if (body?.plan === 'wl') plan = 'wl'
      promoCode = (body?.code as string)?.trim() || null
    } catch {
      // body optional
    }

    // ── PICK THE PRICE ID ────────────────────────────────────────────
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

    // ── ENSURE USER ROW ──────────────────────────────────────────────
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

    // ── GET-OR-CREATE STRIPE CUSTOMER ────────────────────────────────
    const customerId = await getOrCreateCustomer(
      userId,
      email,
      user.firstName,
      user.lastName
    )

    // ── CHECK FOR BLOCKING ACTIVE SUBS ───────────────────────────────
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

    // ── CANCEL INCOMPLETE SUBS ───────────────────────────────────────
    // Includes incompletes from PLAN-SWITCHING: if the user just abandoned
    // a $35 incomplete to switch to $115, cancel the old $35 here.
    const incompleteSubs = stripeSubs.data.filter((s) => s.status === 'incomplete')
    for (const sub of incompleteSubs) {
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch (err) {
        console.warn('Failed to cancel incomplete sub:', sub.id, err)
      }
    }

    // ── CLEAN STALE LOCAL ROWS ──────────────────────────────────────
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

    // ── BUILD SUB PARAMS ────────────────────────────────────────────
    // metadata.sub_kind drives webhook routing:
    //   'whitelabel' → routeWhitelabel (creates tenant row + team)
    //   absent / 'standard' → routePersonal (existing $35 flow)
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
      },
    }

    // ── PROMO CODE LOOKUP ────────────────────────────────────────────
    if (promoCode) {
      try {
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

    // ── CREATE SUB ───────────────────────────────────────────────────
    const subscription = await stripe.subscriptions.create({
      ...subParams,
      expand: ['latest_invoice.confirmation_secret'],
    })

    const invoice = subscription.latest_invoice as any
    const confirmationSecret = invoice?.confirmation_secret?.client_secret

    if (!confirmationSecret) {
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
      })
      return NextResponse.json(
        { error: 'Failed to initialize payment. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: confirmationSecret,
      plan,
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