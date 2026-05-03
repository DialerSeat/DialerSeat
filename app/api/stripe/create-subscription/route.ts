import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BLOCKING_STATUSES = ['trialing', 'active', 'past_due', 'incomplete']

export async function POST() {
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

    // 1) Ensure the user row exists in Supabase BEFORE we do anything else
    // (Stripe webhook will reference users.clerk_id via foreign key)
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

    // 3) Check Stripe directly for any live subscriptions on this customer
    const stripeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })

    const liveSub = stripeSubs.data.find((s) =>
      BLOCKING_STATUSES.includes(s.status)
    )

    if (liveSub) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      )
    }

    // 4) Clean up stale local rows
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('status', ['canceled', 'incomplete_expired', 'unpaid'])

    // 5) Create the fresh subscription with 7-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      trial_period_days: 7,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
      expand: ['pending_setup_intent'],
      metadata: { clerk_id: userId },
    })

    const setupIntent = subscription.pending_setup_intent as any

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: setupIntent?.client_secret,
    })
  } catch (err: any) {
    console.error('create-subscription error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}